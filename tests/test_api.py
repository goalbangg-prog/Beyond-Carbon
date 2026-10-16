import json
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from api.main import app
import api.main as api_module

client = TestClient(app)
facts = json.loads((Path(__file__).resolve().parents[1] / "data" / "ai_facts.json").read_text(encoding="utf-8"))

class TestApi(unittest.TestCase):
    def test_health(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

    def test_facts(self):
        self.assertEqual(facts["records"], 398)
        self.assertEqual(sum(facts["stage_counts"].values()), 398)
        for valid, missing in zip(facts["valid_counts"], facts["missing_counts"]):
            self.assertEqual(valid + missing, 398)

    def test_invalid_topic(self):
        response = client.post("/api/insights", json={"topic": "made_up"})
        self.assertEqual(response.status_code, 422)

    def test_no_secret_error(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}), patch.dict(api_module.AI_CACHE, {}, clear=True):
            response = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(response.status_code, 503)

    def test_mocked_model_response(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "finding": "시멘트별 계수 차이가 있습니다.",
            "meaning": "재료에 따라 계산값이 달라집니다.",
            "caution": "동일한 기능인지 확인해야 합니다."
        }, ensure_ascii=False)
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(response.status_code, 200)
            self.assertIn("finding", response.json()["insight"])
            self.assertEqual(response.json()["generation"], "ai")
            self.assertTrue(mock.chat.completions.create.called)
            cached = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(cached.status_code, 200)
            self.assertEqual(mock.chat.completions.create.call_count, 1)


    def test_invalid_model_output_uses_fallback(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "finding": "검증되지 않은 999999배 차이가 납니다.",
            "meaning": "검증되지 않은 999999배 차이입니다.",
            "caution": "주의하세요."
        }, ensure_ascii=False)
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["generation"], "audited_fallback")
            self.assertNotIn("999999", json.dumps(response.json(), ensure_ascii=False))

    def test_all_four_tabs_have_audited_explanations(self):
        from api.insight_policy import audited
        for topic in ("report", "calc", "explore", "cluster"):
            result = audited(topic, facts)
            self.assertTrue(all(result[k] for k in ("finding", "meaning", "caution")))

    def test_regression_misleading_cement_claim(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "finding": "1종 포틀랜드 시멘트는 고로 슬래그 시멘트보다 약 45.63% 더 많은 환경 영향을 미칩니다.",
            "meaning": "고로 슬래그 시멘트가 환경에 덜 해로운 선택입니다.",
            "caution": "비교에 주의하세요."
        }, ensure_ascii=False)
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/insights", json={"topic": "cement"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["generation"], "audited_fallback")
        self.assertNotIn("더 많은 환경 영향", json.dumps(response.json(), ensure_ascii=False))
        self.assertIn("평가계수", response.json()["insight"]["finding"])

    def test_regression_misleading_coverage_claim(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "finding": "수송은 10개입니다.",
            "meaning": "수송 분야는 데이터가 부족하다는 것을 보여줍니다.",
            "caution": "결측은 0이 아닙니다."
        }, ensure_ascii=False)
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/insights", json={"topic": "coverage"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["generation"], "audited_fallback")
        self.assertNotIn("데이터가 부족하다는", json.dumps(response.json(), ensure_ascii=False))

    def test_model_failure_returns_502(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch("openai.OpenAI", side_effect=RuntimeError("test outage")):
            response = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(response.status_code, 502)
            self.assertNotIn("test outage", response.text)

    def test_rate_limit_returns_429(self):
        from unittest.mock import patch
        with patch.dict(api_module.AI_CACHE, {}, clear=True), patch.object(api_module, "RATE_LIMIT", 0):
            response = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(response.status_code, 429)

    def test_budget_limit_returns_503(self):
        from unittest.mock import patch
        with patch.dict(api_module.AI_CACHE, {}, clear=True), patch.object(api_module, "GENERATIONS", api_module.MAX_GENERATIONS):
            response = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(response.status_code, 503)

    def test_calculation_insight_recomputes_cement(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            response = client.post("/api/calculation-insight", json={
                "impact": 0, "items": [{"id": 0, "quantity": 100}]
            })
        self.assertEqual(response.status_code, 200)
        self.assertAlmostEqual(response.json()["facts"]["total"], 92.632613)
        self.assertEqual(response.json()["generation"], "audited_fallback")

    def test_calculation_rejects_invalid_ids_and_duplicates(self):
        for items in ([{"id": 999, "quantity": 1}],
                      [{"id": 0, "quantity": 1}, {"id": 0, "quantity": 2}],
                      [{"id": 0, "quantity": -1}]):
            response = client.post("/api/calculation-insight", json={"impact": 0, "items": items})
            self.assertEqual(response.status_code, 422)

    def test_calculation_ai_never_overrides_verified_facts(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "finding": "가짜 계산값 9999", "meaning": "선택한 재료의 기여량을 쉽게 읽을 수 있습니다.",
            "caution": "문제없습니다."
        }, ensure_ascii=False)
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/calculation-insight", json={"impact": 0, "items": [{"id": 0, "quantity": 2}]})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("9999", json.dumps(response.json(), ensure_ascii=False))
        self.assertAlmostEqual(response.json()["facts"]["total"], 1.85265226)

    def test_statistical_insight_uses_scope_and_reports_missing(self):
        response = client.post("/api/statistical-insight", json={
            "stage": "원료 및 에너지 생산", "unit": "kg", "impact": 0
        })
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["facts"]["total"], body["facts"]["valid"] + body["facts"]["missing"])
        self.assertGreater(body["facts"]["valid"], 0)
        self.assertEqual(body["generation"], "statistical")

    def test_statistical_insight_rejects_unknown_scope(self):
        response = client.post("/api/statistical-insight", json={
            "stage": "없는 단계", "unit": "kg", "impact": 0
        })
        self.assertEqual(response.status_code, 422)

    def test_statistical_ai_keeps_verified_numbers(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "meaning": "값이 특히 큰 항목은 원자료와 기준 단위를 먼저 살펴보면 좋습니다.",
            "finding": "조작된 숫자 999999",
            "caution": "모두 친환경입니다."
        }, ensure_ascii=False)
        payload = {"stage": "원료 및 에너지 생산", "unit": "kg", "impact": 0}
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}), patch.dict(api_module.AI_CACHE, {}, clear=True):
            baseline = client.post("/api/statistical-insight", json=payload).json()
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch.object(api_module, "GENERATIONS", 0), patch.object(api_module, "MAX_GENERATIONS", 100), patch.object(api_module, "RATE_LIMIT", 100), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/statistical-insight", json=payload)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["finding"], baseline["finding"])
        self.assertEqual(result["caution"], baseline["caution"])
        self.assertEqual(result["facts"], baseline["facts"])
        self.assertNotIn("999999", json.dumps(result, ensure_ascii=False))

    def test_statistical_ai_fallback_on_unsafe_claim(self):
        from unittest.mock import MagicMock, patch
        mock = MagicMock()
        mock.chat.completions.create.return_value.choices[0].message.content = json.dumps({
            "meaning": "이 데이터는 더 친환경적이어서 100% 좋은 결과입니다."
        }, ensure_ascii=False)
        payload = {"stage": "원료 및 에너지 생산", "unit": "kg", "impact": 0}
        with patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}), patch.dict(api_module.AI_CACHE, {}, clear=True), patch.object(api_module, "GENERATIONS", 0), patch.object(api_module, "MAX_GENERATIONS", 100), patch.object(api_module, "RATE_LIMIT", 100), patch("openai.OpenAI", return_value=mock):
            response = client.post("/api/statistical-insight", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["generation"], "statistical")

if __name__ == "__main__":
    unittest.main()
