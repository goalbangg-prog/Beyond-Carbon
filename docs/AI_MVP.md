# Looply AI 해설 — 구현 구조와 검증 기록

> **상태 (2026-10-16):** `feature/ai-insights` 개발 브랜치의 AI 기능은 별도 Render 미리보기에서 배포·수동 동작 확인을 마쳤습니다. `main` 병합은 보류 중입니다.

## 아키텍처
- 프론트엔드: `index.html`, Plotly 기반 기존 네 탭 유지, 주제별 AI 해설 카드 추가
- 데이터: `data/ai_facts.json` — 398개 항목의 단계별 통계, 영향범주별 유효·결측 수, 동일 기준 단위 시멘트 사례
- 서버: `api/main.py` — FastAPI `GET /health`, `POST /api/insights`
- 검증 로직: `api/insight_policy.py` — 검증된 사실·주의사항 생성, AI의 추가 숫자 및 알려진 위험 표현 차단
- 모델: 서버 환경변수 `OPENAI_API_KEY`로 호출하는 OpenAI API(기본 설정 `gpt-4o-mini`)
- 배포: GitHub Pages의 안정 버전과 별도 Render AI 미리보기 및 API 서비스

## AI 응답 처리
`POST /api/insights`는 `topic`을 받으며 허용 값은 `coverage`, `cement`, `report`, `calc`, `explore`, `cluster`입니다. 선택적 `question`은 최대 240자이며, 현재 캐시는 주제별로 공유됩니다. 따라서 질문마다 맞춤 답변이 생성되는 서비스는 아닙니다.

1. Python 코드에서 해당 주제의 검증된 `finding`, `meaning`, `caution` 생성
2. 모델이 일반인용 한국어 설명을 생성
3. 모델의 `meaning`만 검증 후 채택; `finding`과 `caution`은 코드 생성 결과로 고정
4. 의미 설명에 숫자 또는 차단 표현이 있으면 `audited_fallback`으로 대체
5. `source: data/ai_facts.json`, `generation: ai | audited_fallback` 반환

**주의:** `generation: ai`는 제한된 규칙 검사를 통과했다는 뜻이지 의미·과학적 정확성의 완전한 검증이 아닙니다. `audited_fallback` 역시 별도의 인증을 받은 결과라는 뜻은 아닙니다.

## 안전 및 비용 보호
- API 키는 서버 환경변수에만 저장
- CORS 허용 출처 목록 지정
- 주제별 메모리 캐시
- IP당 시간당 요청 제한(기본 6회), 프로세스별 모델 생성 한도(기본 30회)
- 제한 상태와 캐시는 서버 재시작 시 초기화되며, 다중 인스턴스 전체에 공유되지 않음
- OpenAI 제공자 오류 시 API 502; 프론트엔드는 기본 설명 표시

## 검증 이력
- GitHub Actions: 커밋 `8a43ac0` 기준 **12개 Python 테스트 모두 통과**(사용자 제공 2026-10-16 로그)
- 시멘트의 평가계수 차이를 전체 환경영향 차이로 과장하는 설명 차단 회귀 테스트 통과
- 수송 항목 수가 적다는 이유만으로 데이터 부족을 단정하는 설명 차단 회귀 테스트 통과
- 네 탭의 기본 해설 생성 테스트 통과
- 사용자 확인: 최신 Render 배포, AI 해설과 기존 차트 정상 작동
- 미검증: 모바일 실기기, 모든 데이터·단위 조합, 모든 AI 생성 문장에 대한 의미 검증, 부하·보안 침투 테스트

## 로컬 실행
```bash
pip install -r api/requirements.txt
# OPENAI_API_KEY 환경변수 설정
uvicorn api.main:app --reload --port 8001
```

기본 허용 출처는 환경변수 `LOOPLY_ALLOWED_ORIGINS`로 조정합니다. 웹 프론트엔드는 `window.LOOPLY_AI_API_URL`을 설정할 수 있으며, 현재 코드에는 별도 Render API 기본 주소가 있습니다.

## 기술적 후속 과제
1. AI 해설을 현재 선택한 계산값·차트·군집 결과와 연결
2. 단순 정규표현식 외에 검증 가능한 주장 구조와 근거 대조 확대
3. 분산형 호출 제한·비용 모니터링
4. 접근성 및 모바일 기기 검증

이 문서는 개인 학습·취업용 프로젝트의 개발 기록입니다. ISO 14040/14044에 부합하는 완전한 제품 LCA 또는 공식 EPD 검증을 수행했다는 의미가 아닙니다.
