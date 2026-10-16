# Looply AI MVP — 개발 및 검증 상태

이 작업은 기존 V4.6 안정 버전에서 분기한 `feature/ai-insights`에만 적용되었습니다. `main` 및 `backup/v4.6-stable`은 변경하지 않았습니다.

## 구현
- `data/ai_facts.json`: 실제 398개 평가계수에서 확인한 단계별 항목 수, 영향범주별 유효값/결측값 수, 동일 kg 기준 시멘트 사례
- `api/main.py`: FastAPI AI 해설 API (`POST /api/insights`, `GET /health`)
- `index.html`: 일반인을 위한 발견·의미·주의점 카드, 주제 2개 선택, API 오류 시 기본 해설 표시
- 서버의 OpenAI API 키는 환경변수로만 주입. 브라우저 코드에는 비밀키를 저장하지 않음.

## 로컬 실행
```bash
pip install -r api/requirements.txt
# 운영체제에 맞는 환경변수 설정 후:
uvicorn api.main:app --reload --port 8001
```
환경변수: `OPENAI_API_KEY`, 선택사항 `OPENAI_MODEL`, `LOOPLY_ALLOWED_ORIGINS`.

웹사이트에서 API를 활성화하려면 **HTML의 기본 앱 스크립트보다 먼저** 아래 값을 설정해야 합니다.

```html
<script>window.LOOPLY_AI_API_URL = "https://your-https-backend.example";</script>
```

설정하지 않으면 검증된 수치로 작성한 기본 해설만 표시됩니다. 공개 GitHub Pages는 HTTPS이므로 운영 API도 HTTPS가 필요합니다. API 서버 배포, API 비용 및 호출 제한, abuse 방지, CORS 설정은 운영 전 필수입니다.

## 검증 결과 (2026-10-16)
- GitHub 브랜치 생성 및 파일 커밋 성공
- 파일 재조회로 AI 카드/버튼 이벤트/기본 해설/비밀키 서버 전용 구성 확인
- `valid_counts + missing_counts = 398` (각 영향범주) 검증
- 398개 항목의 단계별 수 합계 검증: 198 + 10 + 32 + 113 + 45 = 398

## 미완료 및 위험
- Python API 실제 실행, OpenAI 응답 테스트, 실제 브라우저 회귀 테스트 **미수행**
- 백엔드 실제 배포 및 프론트 API 주소 설정 **미수행**
- 기존 모든 차트에 동적으로 해설을 생성하는 기능 **미구현** (현재는 검증 가능한 두 주제만 지원)
- 사용자 호출량 제한 및 비용 방어 **미구현**; 공개 배포 전 반드시 적용 필요
- AI가 입력 수치 외 사실을 추가할 가능성이 있어 운영 단계에서 응답 수치 검증 강화 필요

**현재는 안전하게 분리된 개발용 MVP이지, 공개 배포가 끝난 AI 서비스가 아닙니다.**
