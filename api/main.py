"""Looply AI insights API. Run: uvicorn api.main:app --reload"""
import json
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Looply AI Insights", version="0.1.0")
allowed = [x.strip() for x in os.getenv("LOOPLY_ALLOWED_ORIGINS", "http://localhost:8000,https://goalbangg-prog.github.io").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
STATS = json.loads((Path(__file__).resolve().parents[1] / "data" / "ai_facts.json").read_text(encoding="utf-8"))
SYSTEM = """당신은 일반인을 위한 환경 데이터 해설자입니다. 제공된 검증된 수치만 사용하세요.
발견/의미/주의점을 한국어로 각각 1~3문장으로 간결하게 설명하세요.
숫자·출처·원인을 지어내지 말고, 상관관계를 인과관계로 표현하지 마세요.
서로 다른 기준 단위의 계수를 직접 비교하거나, 결측을 0으로 취급하지 마세요.
개별 평가계수 비교를 제품 전체 LCA나 공식 인증 결과로 단정하지 마세요.
항상 JSON 객체 {"finding":"...","meaning":"...","caution":"..."}만 반환하세요."""

class InsightRequest(BaseModel):
    topic: str = Field(pattern=r"^(coverage|cement)$")
    question: str = Field(default="", max_length=240)

@app.get("/health")
def health():
    return {"ok": True, "model_configured": bool(os.getenv("OPENAI_API_KEY"))}

@app.post("/api/insights")
def insights(req: InsightRequest):
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
        if not isinstance(parsed, dict) or not all(isinstance(parsed.get(k),str) for k in ("finding","meaning","caution")):
            raise ValueError("invalid AI response")
        return {"topic":req.topic,"insight":{k:parsed[k] for k in ("finding","meaning","caution")},"source":"data/ai_facts.json"}
    except Exception as exc:
        raise HTTPException(502, "AI 해설을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.") from exc
