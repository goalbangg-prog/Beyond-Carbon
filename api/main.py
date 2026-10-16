"""Looply AI insights API. Run: uvicorn api.main:app --reload"""
import json
import os
import time
from collections import defaultdict, deque
from threading import Lock
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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
항상 JSON 객체 {"finding":"...","meaning":"...","caution":"..."}만 반환하세요."""

class InsightRequest(BaseModel):
    topic: str = Field(pattern=r"^(coverage|cement)$")
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
    facts = {"coverage": {k: STATS[k] for k in ("records", "stage_counts", "impact_names", "valid_counts", "missing_counts", "cautions")},
             "cement": {"example": STATS["cement_example"], "cautions": STATS["cautions"]}}[req.topic]
    from openai import OpenAI
    try:
        response = OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=20.0).chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            messages=[{"role":"system","content":SYSTEM},{"role":"user","content":json.dumps({"topic":req.topic,"question":req.question,"facts":facts},ensure_ascii=False)}],
            response_format={"type":"json_object"}, max_tokens=450, temperature=0.2)
        parsed = json.loads(response.choices[0].message.content)
        if not isinstance(parsed, dict) or not all(isinstance(parsed.get(k),str) and 0 < len(parsed[k]) <= 600 for k in ("finding","meaning","caution")):
            raise ValueError("invalid AI response")
        # Guardrail: reject fabricated numbers. Cement insight may use only source facts
        # (or their rounded equivalents); coverage may use only source counts.
        import re
        text_blob = " ".join(parsed[k] for k in ("finding", "meaning", "caution"))
        numbers = [float(x) for x in re.findall(r"(?<![\w.])\d+(?:\.\d+)?", text_blob)]
        if req.topic == "cement":
            permitted = (1, 0.92632613, 0.503655563, 45.63, 45.64, 46, 0.93, 0.926, 0.50, 0.5, 0.504, 0.5037, 0.98)
        else:
            permitted = tuple([398, 198, 10, 32, 113, 45, 223, 210, 190, 200, 175, 188, 208, 198, 0, 1, 2, 3, 4, 5, 50] + list(STATS["stage_counts"].values()) + STATS["valid_counts"] + STATS["missing_counts"])
        if any(not any(abs(n - p) <= 0.011 for p in permitted) for n in numbers):
            raise ValueError("unverified numeric claim")
        result = {"topic":req.topic,"insight":{k:parsed[k] for k in ("finding","meaning","caution")},"source":"data/ai_facts.json"}
        with GUARD_LOCK:
            AI_CACHE[req.topic] = result
        return result
    except Exception as exc:
        raise HTTPException(502, "AI 해설을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.") from exc
