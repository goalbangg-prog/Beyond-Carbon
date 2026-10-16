"""Looply AI insights API. Run: uvicorn api.main:app --reload"""
import json
import csv
import math
import logging
import os
import time
from collections import defaultdict, deque
from threading import Lock
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from api.insight_policy import audited, safe_explanation

logger = logging.getLogger("looply.ai")

app = FastAPI(title="Looply AI Insights", version="0.1.0")
allowed = [x.strip() for x in os.getenv("LOOPLY_ALLOWED_ORIGINS", "http://localhost:8000,https://goalbangg-prog.github.io").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
STATS = json.loads((Path(__file__).resolve().parents[1] / "data" / "ai_facts.json").read_text(encoding="utf-8"))
# In-memory controls for this single-instance MVP; restart resets counters.
AI_CACHE = {}
REQUEST_TIMES = defaultdict(deque)
GUARD_LOCK = Lock()
RATE_LIMIT = 6  # requests per IP per hour; cache hits do not consume model tokens
MAX_GENERATIONS = 30  # per process lifetime; conservative demo budget
GENERATIONS = 0
SYSTEM = """당신은 일반인을 위한 환경 데이터 해설자입니다. 제공된 검증된 수치만 사용하세요.
발견/의미/주의점을 한국어로 각각 1~3문장으로 간결하게 설명하세요.
숫자·출처·원인을 지어내지 말고, 상관관계를 인과관계로 표현하지 마세요.
서로 다른 기준 단위의 계수를 직접 비교하거나, 결측을 0으로 취급하지 마세요.
개별 평가계수 비교를 제품 전체 LCA나 공식 인증 결과로 단정하지 마세요.\n평가계수는 특정 기준 단위에 대한 데이터이며 실제 제품의 확정 배출량처럼 표현하지 마세요.\n계수 차이의 원인을 입력 사실만으로 설명할 수 없다면 추측하지 마세요.
독자는 환경 분야를 처음 접하는 일반인입니다. 중학생도 이해할 수 있는 쉬운 한국어로 쓰세요.\n어려운 용어는 처음 나올 때 일상적인 말로 풀어 설명하세요. 수치는 필요할 때만 반올림하여 사용하고, 원자료의 단위를 확신할 수 없다면 임의의 단위를 붙이지 마세요.\n발견은 핵심 차이 한 문장, 의미는 생활 속 의미 한두 문장, 주의점은 오해를 막는 한두 문장으로 작성하세요.\n자료에 없는 제조 원인, 재활용 여부, 환경 개선 효과를 추정해서 쓰지 마세요.\n항상 JSON 객체 {"finding":"...","meaning":"...","caution":"..."}만 반환하세요."""

class InsightRequest(BaseModel):
    topic: str = Field(pattern=r"^(coverage|cement|report|calc|explore|cluster)$")
    question: str = Field(default="", max_length=240)

@app.get("/health")
def health():
    return {"ok": True, "model_configured": bool(os.getenv("OPENAI_API_KEY"))}

@app.post("/api/insights")
def insights(req: InsightRequest, request: Request):
    global GENERATIONS
    # The question is not used as a cache key: MVP supports two audited topics only.
    # Public users cannot force arbitrary new prompts or unbounded OpenAI spending.
    with GUARD_LOCK:
        if req.topic in AI_CACHE:
            return AI_CACHE[req.topic]
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        history = REQUEST_TIMES[ip]
        while history and now - history[0] > 3600:
            history.popleft()
        if len(history) >= RATE_LIMIT:
            raise HTTPException(429, "AI 요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.")
        if GENERATIONS >= MAX_GENERATIONS:
            raise HTTPException(503, "AI 데모 생성 한도에 도달했습니다.")
        history.append(now)
        GENERATIONS += 1
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503, "AI 해설 서비스가 아직 설정되지 않았습니다.")
    facts = {"topic": req.topic, "audited": audited(req.topic, STATS)}
    from openai import OpenAI
    try:
        response = OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=20.0).chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[{"role":"system","content":SYSTEM},{"role":"user","content":json.dumps({"topic":req.topic,"question":req.question,"facts":facts},ensure_ascii=False)}],
            response_format={"type":"json_object"}, max_tokens=450, temperature=0.2)
        parsed = json.loads(response.choices[0].message.content)
        if not isinstance(parsed, dict) or not all(isinstance(parsed.get(k),str) and 0 < len(parsed[k]) <= 600 for k in ("finding","meaning","caution")):
            raise ValueError("invalid AI response")
        # Finding and caution are always generated from audited source facts.
        # AI may only provide a short, number-free explanation of their meaning.
        base = audited(req.topic, STATS)
        explanation = parsed["meaning"]
        accepted = safe_explanation(explanation)
        result = {"topic": req.topic,
                  "insight": {**base, "meaning": explanation if accepted else base["meaning"]},
                  "source": "data/ai_facts.json",
                  "generation": "ai" if accepted else "audited_fallback"}
        with GUARD_LOCK:
            AI_CACHE[req.topic] = result
        return result
    except Exception as exc:
        logger.warning("AI insight rejected: topic=%s error_type=%s reason=%s", req.topic, type(exc).__name__, "numeric_validation" if isinstance(exc, ValueError) and str(exc) == "unverified numeric claim" else "response_or_provider_error")
        raise HTTPException(502, "AI 해설을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.") from exc

# Calculation explanations are recomputed against the canonical CSV; client totals are never trusted.
_CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "lca_factors_clean.csv"
with _CSV_PATH.open(encoding="utf-8-sig", newline="") as _file:
    FACTOR_ROWS = list(csv.DictReader(_file))
IMPACT_COLUMNS = [
    "탄소발자국(kg CO2 eq)", "자원발자국(kg Sb eq)",
    "산성비(kg SO2 eq)", "부영양화(kg PO43- eq)",
    "물소모계수(m3 H2O eq)"
]
IMPACT_NAMES = ["탄소발자국", "자원발자국", "산성화", "부영양화", "물발자국"]
IMPACT_SYMBOLS = ["kg CO₂ eq", "kg Sb eq", "kg SO₂ eq", "kg PO₄³⁻ eq", "m³ H₂O eq"]

class CalculationItem(BaseModel):
    id: int = Field(ge=0, lt=398)
    quantity: float = Field(ge=0, le=1e9, allow_inf_nan=False)

class CalculationInsightRequest(BaseModel):
    impact: int = Field(ge=0, le=4)
    items: list[CalculationItem] = Field(min_length=1, max_length=20)

def calculation_facts(req: CalculationInsightRequest):
    if len({x.id for x in req.items}) != len(req.items):
        raise HTTPException(422, "같은 항목을 중복해서 제출할 수 없습니다.")
    col = IMPACT_COLUMNS[req.impact]
    contributions = []
    missing = []
    for item in req.items:
        row = FACTOR_ROWS[item.id]
        value = row[col].strip()
        if not value:
            missing.append(row["원료_에너지"])
            continue
        amount = float(value) * item.quantity
        if not math.isfinite(amount):
            raise HTTPException(422, "계산 결과가 허용 범위를 벗어났습니다.")
        contributions.append({"name": row["원료_에너지"], "value": amount})
    total = sum(x["value"] for x in contributions)
    if not math.isfinite(total):
        raise HTTPException(422, "계산 결과가 허용 범위를 벗어났습니다.")
    biggest = max(contributions, key=lambda x: x["value"]) if contributions else None
    positive_total = sum(x["value"] for x in contributions if x["value"] > 0)
    ranked = sorted(contributions, key=lambda x: x["value"], reverse=True)
    finding = (f"{IMPACT_NAMES[req.impact]} 부분 합계는 {total:.6g} {IMPACT_SYMBOLS[req.impact]}이며 "
               f"유효 항목 {len(contributions)}개, 결측 항목 {len(missing)}개입니다.")
    if biggest and positive_total > 0:
        share = biggest["value"] / positive_total * 100
        finding += f" 가장 큰 기여 항목은 {biggest['name']}이며 양수 기여량 합계의 {share:.1f}%를 차지합니다."
    if len(ranked) >= 2 and ranked[0]["value"] > 0:
        gap = ranked[0]["value"] - ranked[1]["value"]
        finding += (f" 두 번째 항목 {ranked[1]['name']}과의 기여량 차이는 "
                    f"{gap:.6g} {IMPACT_SYMBOLS[req.impact]}입니다.")
    if missing:
        finding += " 결측 항목은 합계에서 제외되므로 실제 전체 영향과 다를 수 있습니다."
    return {
        "finding": finding,
        "meaning": ("기여도가 큰 항목부터 입력량이나 대체 가능성을 검토할 우선순위를 정할 수 있습니다. " if biggest else "해당 범주에 유효한 계수가 없어 비교할 수 없습니다. ") + "다만 항목 간 기능적 동등성과 시스템 경계를 먼저 확인해야 합니다.",
        "caution": "결측값은 0이 아닙니다. 이 결과는 제품 전체의 LCA나 공식 인증 결과가 아닙니다.",
        "total": total,
        "valid_count": len(contributions),
        "missing_count": len(missing),
        "contributions": contributions,
        "impact_name": IMPACT_NAMES[req.impact],
        "impact_symbol": IMPACT_SYMBOLS[req.impact],
    }

@app.post("/api/calculation-insight")
def calculation_insight(req: CalculationInsightRequest, request: Request):
    global GENERATIONS
    facts = calculation_facts(req)
    # No AI tokens spent for identical calculations or missing API credentials.
    cache_key = "calc:" + json.dumps(req.model_dump(), sort_keys=True)
    with GUARD_LOCK:
        if cache_key in AI_CACHE:
            return AI_CACHE[cache_key]
    base = {k: facts[k] for k in ("finding", "meaning", "caution")}
    result = {"insight": base, "facts": {k: facts[k] for k in ("total", "valid_count", "missing_count", "impact_name", "impact_symbol")}, "generation": "audited_fallback", "source": "data/lca_factors_clean.csv"}
    if not os.getenv("OPENAI_API_KEY"):
        return result
    with GUARD_LOCK:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        history = REQUEST_TIMES[ip]
        while history and now - history[0] > 3600:
            history.popleft()
        if len(history) >= RATE_LIMIT or GENERATIONS >= MAX_GENERATIONS:
            return result
        history.append(now)
        GENERATIONS += 1
    try:
        from openai import OpenAI
        response = OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=20).chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": SYSTEM + "\n추가 숫자를 쓰지 말고 meaning에만 쉬운 설명을 작성하세요."},
                {"role": "user", "content": json.dumps({"facts": facts}, ensure_ascii=False)}
            ], response_format={"type": "json_object"}, max_tokens=320, temperature=0.2
        )
        parsed = json.loads(response.choices[0].message.content)
        meaning = parsed.get("meaning", "")
        if safe_explanation(meaning):
            result["insight"]["meaning"] = meaning
            result["generation"] = "ai"
    except Exception as exc:
        logger.warning("Calculation AI fallback: %s", type(exc).__name__)
    with GUARD_LOCK:
        AI_CACHE[cache_key] = result
    return result


# Reproducible descriptive statistics, independent of model output.
from statistics import median

class StatisticalInsightRequest(BaseModel):
    stage: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=32)
    impact: int = Field(ge=0, le=4)

@app.post("/api/statistical-insight")
def statistical_insight(req: StatisticalInsightRequest, request: Request):
    scope = [r for r in FACTOR_ROWS if r["대분류"] == req.stage and r["단위"] == req.unit]
    if not scope:
        raise HTTPException(422, "선택한 범위에 데이터가 없습니다.")
    col = IMPACT_COLUMNS[req.impact]
    valid = sorted(float(r[col]) for r in scope if r[col].strip() and math.isfinite(float(r[col])))
    missing = len(scope) - len(valid)
    if not valid:
        return {"finding": "이 범위에는 계산 가능한 계수가 없습니다.", "meaning": "결측 패턴을 먼저 확인해야 합니다.", "caution": "빈 값을 0으로 취급할 수 없습니다.", "facts": {"total":len(scope),"valid":0,"missing":missing}, "generation":"statistical"}
    def percentile(p):
        position = (len(valid)-1)*p
        lo = math.floor(position)
        hi = math.ceil(position)
        return valid[lo] + (valid[hi]-valid[lo])*(position-lo)
    q1,q3 = percentile(.25),percentile(.75)
    iqr = q3-q1
    outliers = sum(x < q1-1.5*iqr or x > q3+1.5*iqr for x in valid) if iqr else 0
    med = median(valid)
    coverage = 100*len(valid)/len(scope)
    finding = (f"{req.stage} / {req.unit}에서 {IMPACT_NAMES[req.impact]} 계수가 있는 항목은 "
               f"{len(valid)}/{len(scope)}개({coverage:.1f}%)입니다. 중앙값은 {med:.5g}, "
               f"사분위범위는 {q1:.5g}~{q3:.5g}이며, IQR 기준 이상치는 {outliers}개입니다.")
    if missing:
        meaning = f"전체 {len(scope)}개 중 {missing}개는 이 영향범주의 값이 비어 있습니다. 유효한 항목의 분포와 결측된 항목을 나누어 살펴보는 것이 좋습니다."
    elif outliers:
        meaning = "일부 항목이 일반적인 분포 범위에서 벗어납니다. 원자료와 단위를 확인해 특이값인지 검토할 수 있습니다."
    else:
        meaning = "선택한 범위에서는 IQR 기준 이상치가 발견되지 않았습니다. 분포의 치우침 여부는 그래프와 함께 확인하세요."
    base = {"finding":finding,"meaning":meaning,
            "caution":"이상치는 오류나 환경적 우열을 뜻하지 않습니다. 동일 단위의 계수 분포만 비교한 결과이며 제품 LCA가 아닙니다.",
            "facts":{"total":len(scope),"valid":len(valid),"missing":missing,"median":med,"q1":q1,"q3":q3,"outliers":outliers},
            "generation":"statistical"}
    # AI is only allowed to paraphrase the meaning. All statistics and warnings stay deterministic.
    cache_key = "stat:" + json.dumps(req.model_dump(), sort_keys=True, ensure_ascii=False)
    with GUARD_LOCK:
        cached = AI_CACHE.get(cache_key)
        if cached is not None:
            return cached
    global GENERATIONS
    if not os.getenv("OPENAI_API_KEY"):
        return base
    with GUARD_LOCK:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        history = REQUEST_TIMES[ip]
        while history and now - history[0] > 3600:
            history.popleft()
        if len(history) >= RATE_LIMIT or GENERATIONS >= MAX_GENERATIONS:
            return base
        history.append(now)
        GENERATIONS += 1
    try:
        from openai import OpenAI
        response = OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=20).chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[
                {"role":"system","content":(
                    "환경 데이터 분석 결과를 일반인에게 설명합니다. JSON 객체의 meaning 필드 하나만 작성하세요. "
                    "숫자, 백분율, 원인, 자료에 없는 사실을 새로 만들지 마세요. "
                    "통계가 의미하는 점과 다음에 확인할 사항을 쉬운 한국어 1~2문장으로 설명하세요. "
                    "이상치를 오류나 환경적 우열로 단정하지 마세요."
                )},
                {"role":"user","content":json.dumps({
                    "scope":{"stage":req.stage,"unit":req.unit,"impact":IMPACT_NAMES[req.impact]},
                    "verified_finding":finding,"verified_facts":base["facts"],
                    "default_meaning":meaning
                },ensure_ascii=False)}
            ],response_format={"type":"json_object"},max_tokens=180,temperature=0.2
        )
        parsed = json.loads(response.choices[0].message.content)
        explanation = parsed.get("meaning") if isinstance(parsed,dict) else None
        if safe_explanation(explanation):
            base["meaning"] = explanation
            base["generation"] = "ai"
    except Exception as exc:
        logger.warning("Statistical insight fallback: %s",type(exc).__name__)
    with GUARD_LOCK:
        AI_CACHE[cache_key] = base
    return base


# Correlation and clustering: independently computed server-side, never inferred from the chart.

def _explain_verified_result(result, req, request, prefix):
    """Only meaning is model-editable; statistics, finding and caution remain fixed."""
    global GENERATIONS
    cache_key = prefix + ":" + json.dumps(req.model_dump(),ensure_ascii=False,sort_keys=True)
    with GUARD_LOCK:
        cached = AI_CACHE.get(cache_key)
        if cached is not None:
            return cached
    if not os.getenv("OPENAI_API_KEY"):
        return result
    with GUARD_LOCK:
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        history = REQUEST_TIMES[ip]
        while history and now-history[0]>3600:
            history.popleft()
        if len(history)>=RATE_LIMIT or GENERATIONS>=MAX_GENERATIONS:
            return result
        history.append(now)
        GENERATIONS += 1
    try:
        from openai import OpenAI
        response = OpenAI(api_key=os.environ["OPENAI_API_KEY"],timeout=20).chat.completions.create(
            model=os.getenv("OPENAI_MODEL","gpt-4o-mini"),
            messages=[
                {"role":"system","content":(
                    "환경 데이터 분석가의 보조 설명자입니다. JSON 객체의 meaning 필드만 작성하세요. "
                    "제공된 검증 사실을 쉬운 한국어 1~2문장으로 해석하고 다음에 확인할 자료를 제안하세요. "
                    "새 숫자나 인과관계, 친환경 우열, 제품 전체 LCA 결론을 만들어서는 안 됩니다. "
                    "상관은 인과가 아니고 군집은 환경 순위가 아닙니다."
                )},
                {"role":"user","content":json.dumps({
                    "finding":result["finding"],"facts":result["facts"],
                    "default_meaning":result["meaning"],"caution":result["caution"]
                },ensure_ascii=False)}
            ],response_format={"type":"json_object"},max_tokens=170,temperature=0.2)
        parsed = json.loads(response.choices[0].message.content)
        meaning = parsed.get("meaning") if isinstance(parsed,dict) else None
        if safe_explanation(meaning):
            result["meaning"] = meaning
            result["generation"] = "ai"
    except Exception as exc:
        logger.warning("Verified analysis AI fallback: %s",type(exc).__name__)
    with GUARD_LOCK:
        AI_CACHE[cache_key] = result
    return result

class CorrelationInsightRequest(BaseModel):
    stage: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=32)
    impact_x: int = Field(ge=0, le=4)
    impact_y: int = Field(ge=0, le=4)

def _ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and values[order[end]] == values[order[start]]:
            end += 1
        rank = (start + end - 1) / 2 + 1
        for pos in range(start, end):
            ranks[order[pos]] = rank
        start = end
    return ranks

def _pearson(a, b):
    n = len(a)
    if n < 3:
        return None
    am, bm = sum(a) / n, sum(b) / n
    numerator = sum((x-am)*(y-bm) for x,y in zip(a,b))
    denominator = math.sqrt(sum((x-am)**2 for x in a)*sum((y-bm)**2 for y in b))
    return numerator / denominator if denominator > 0 else None

@app.post("/api/correlation-insight")
def correlation_insight(req: CorrelationInsightRequest, request: Request):
    if req.impact_x == req.impact_y:
        raise HTTPException(422, "서로 다른 영향범주를 선택하세요.")
    scope = [r for r in FACTOR_ROWS if r["대분류"] == req.stage and r["단위"] == req.unit]
    if not scope:
        raise HTTPException(422, "분석 범위가 없습니다.")
    xcol,ycol = IMPACT_COLUMNS[req.impact_x],IMPACT_COLUMNS[req.impact_y]
    pairs = []
    for row in scope:
        try:
            x,y = float(row[xcol]),float(row[ycol])
            if math.isfinite(x) and math.isfinite(y):
                pairs.append((x,y))
        except (ValueError,TypeError):
            continue
    rho = _pearson(_ranks([p[0] for p in pairs]),_ranks([p[1] for p in pairs])) if len(pairs)>=3 else None
    count = len(pairs)
    if rho is None:
        finding = f"전체 {len(scope)}개 중 두 영향범주를 함께 분석할 수 있는 항목은 {count}개입니다. 순위상관계수는 계산할 수 없습니다."
        meaning = "함께 관측된 값이 너무 적거나 값이 모두 같을 수 있습니다. 분석 가능한 자료부터 확인하세요."
    else:
        direction = "함께 높아지는" if rho > 0.1 else "한쪽이 높을수록 다른 쪽은 낮아지는" if rho < -0.1 else "뚜렷한 단조 관계가 없는"
        finding = (f"{IMPACT_NAMES[req.impact_x]}와 {IMPACT_NAMES[req.impact_y]}의 Spearman 순위상관계수는 "
                   f"{rho:.3f}이며, 두 값이 모두 있는 {count}/{len(scope)}개 항목을 사용했습니다.")
        meaning = f"선택한 항목들에서 두 계수의 순위가 {direction} 경향을 보입니다. 개별 항목과 특이값을 산점도로 함께 살펴보세요."
    return _explain_verified_result({"finding":finding,"meaning":meaning,
            "caution":"상관관계는 원인이나 제품의 환경적 우열을 증명하지 않습니다. 결측을 제외한 표본과 동일한 기준 단위 안에서만 해석하세요.",
            "facts":{"total":len(scope),"paired":count,"excluded":len(scope)-count,"rho":rho,
                     "impact_x":IMPACT_NAMES[req.impact_x],"impact_y":IMPACT_NAMES[req.impact_y]},
            "generation":"statistical","source":"data/lca_factors_clean.csv"},req,request,"corr")

class ClusterInsightRequest(BaseModel):
    stage: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=32)
    impacts: list[int] = Field(min_length=2, max_length=5)
    k: int = Field(ge=2, le=6)

@app.post("/api/cluster-insight")
def cluster_insight(req: ClusterInsightRequest, request: Request):
    if len(set(req.impacts)) != len(req.impacts) or any(j not in range(5) for j in req.impacts):
        raise HTTPException(422, "중복되거나 잘못된 영향범주입니다.")
    scope = [r for r in FACTOR_ROWS if r["대분류"] == req.stage and r["단위"] == req.unit]
    if not scope:
        raise HTTPException(422, "분석 범위가 없습니다.")
    valid = []
    for row in scope:
        try:
            values = [float(row[IMPACT_COLUMNS[j]]) for j in req.impacts]
            if all(math.isfinite(x) and x>0 for x in values):
                valid.append((row["원료_에너지"],values))
        except (ValueError,TypeError):
            continue
    if len(valid) < max(12,req.k*4):
        raise HTTPException(422, "군집 분석을 위한 유효 표본이 부족합니다.")
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score
    from sklearn.preprocessing import StandardScaler
    X = StandardScaler().fit_transform(np.log10(np.asarray([x[1] for x in valid],dtype=float)))
    model = KMeans(n_clusters=req.k,random_state=42,n_init=10)
    labels = model.fit_predict(X)
    counts = [int(np.sum(labels==i)) for i in range(req.k)]
    silhouette = float(silhouette_score(X,labels)) if len(set(labels))>1 and max(counts)<len(valid) else None
    profiles = []
    for i in range(req.k):
        members = np.flatnonzero(labels==i)
        center = model.cluster_centers_[i]
        distinguishing = int(np.argmax(np.abs(center)))
        profiles.append({"cluster":i+1,"size":len(members),
                         "distinguishing_impact":IMPACT_NAMES[req.impacts[distinguishing]],
                         "direction":"상대적으로 높음" if center[distinguishing]>0 else "상대적으로 낮음",
                         "standardized_center":round(float(center[distinguishing]),3),
                         "examples":[valid[int(j)][0] for j in members[:3]]})
    biggest = max(profiles,key=lambda x:x["size"])
    finding = (f"동일한 {req.unit} 기준의 유효 계수 {len(valid)}/{len(scope)}개를 "
               f"{req.k}개 군집으로 나눴습니다. 가장 큰 군집은 {biggest['cluster']}번({biggest['size']}개)입니다. "
               + (f"평균 실루엣 점수는 {silhouette:.3f}입니다." if silhouette is not None else "실루엣 점수는 계산할 수 없습니다."))
    meaning = "각 군집에서 두드러지는 영향범주와 대표 항목을 비교해 원자료를 추가 탐색할 수 있습니다. 군집 크기와 분리도를 함께 확인하세요."
    return _explain_verified_result({"finding":finding,"meaning":meaning,
            "caution":"군집 번호는 환경성 순위가 아닙니다. 로그 변환·표준화와 군집 수 선택에 따라 결과가 달라집니다. 브라우저 차트의 별도 KMeans 구현과 군집 번호가 일치하지 않을 수 있습니다.",
            "facts":{"total":len(scope),"valid":len(valid),"excluded":len(scope)-len(valid),
                     "k":req.k,"silhouette":silhouette,"profiles":profiles,
                     "assignments":[{"name":name,"cluster":int(labels[i])+1,"values":values} for i,(name,values) in enumerate(valid)],
                     "impacts":[IMPACT_NAMES[j] for j in req.impacts],
                     "method":"scikit-learn KMeans(random_state=42,n_init=10), log10 + StandardScaler"},
            "generation":"statistical","source":"data/lca_factors_clean.csv"},req,request,"cluster")
