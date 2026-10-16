# LCA mini V2 검증 기록 (2026-10-16)

- 정제 CSV: 398행 확인
- JavaScript 데이터: 398개 항목 확인
- Python `app.py`: Python 문법 검사 통과 (이전 검증)
- `index.html`의 두 개 인라인 JS 스크립트: `node --check` 통과
- Chromium/Playwright: 로컬 파일 URL(`file://`) 직접 접근은 실행 환경 정책으로 차단됨
- 대체 검증: HTML에 `lca_data.js`와 `plotly.min.js`를 인라인 주입해 브라우저에서 렌더링
- 확인: 데이터 398개 로딩, 예시 계산 후 기여량 막대·히트맵·도넛 차트 생성
- 확인: 계수 순위, 히스토그램, 박스플롯, 산점도, 상관 히트맵 모두 Plotly 차트 생성
- 확인: KMeans 실행 후 군집 프로필 히트맵과 산점도 생성
- 브라우저 JavaScript pageerror: 0건

**미검증:** GitHub Pages 실제 URL 접근, 다운로드 파일의 내용/정확도, 모든 단위 조합의 수치 검산, scikit-learn KMeans와의 일치성, 모바일 브라우저 호환성. 브라우저 테스트는 실제 네트워크 배포와 다른 인라인 주입 방식임.
