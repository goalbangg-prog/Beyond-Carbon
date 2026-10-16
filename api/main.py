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
    finding = (f"{IMPACT_NAMES[req.impact]} 부분 계산: 유효한 항목 {len(contributions)}개, "
               f"결측 항목 {len(missing)}개, 합계 {total:.6g} {IMPACT_SYMBOLS[req.impact]}."
               + (f" 가장 큰 기여 항목은 {biggest['name']}입니다." if biggest else " 계산 가능한 계수가 없습니다."))
    return {
        "finding": finding,
        "meaning": "선택한 항목의 기준 단위로 환산된 사용량과 평가계수를 곱한 부분 결과입니다.",
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

