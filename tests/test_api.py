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
            self.assertTrue(mock.chat.completions.create.called)
            cached = client.post("/api/insights", json={"topic": "cement"})
            self.assertEqual(cached.status_code, 200)
            self.assertEqual(mock.chat.completions.create.call_count, 1)

if __name__ == "__main__":
    unittest.main()
