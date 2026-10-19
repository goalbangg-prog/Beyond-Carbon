/* 방법·출처 탭: 데이터 상세, 용어, 재현 방법, 한계 */
(function () {
  const { $, esc, D, POOL, RES } = L;
  const TERMS = [
    ['빈 값', '원자료의 “해당없음”. 0이 아니라 측정하지 않은 값으로 보고 비워 뒀다. 두 영향을 비교할 때는 두 값이 모두 있는 원료만 썼다.'],
    ['백분위', '같은 집단 안에서의 순위를 0~100으로 바꾼 값. 클수록 계수가 크다. 영향 쌍마다 두 값이 모두 있는 원료끼리 다시 매겼다.'],
    ['순위상관 ρ (Spearman)', '두 영향에서 원료의 순서가 얼마나 같은지를 −1~1로 나타낸다. 값 대신 순위를 써서 극단값에 덜 흔들린다. 상관이 인과를 뜻하지는 않는다.'],
    ['상위 20% 겹침 비율', '어떤 영향 계수의 상위 20% 원료 가운데 탄소발자국도 상위 20%인 비율. 두 순위가 무관하면 약 20%다.'],
    ['95% 구간 (부트스트랩)', '원료 목록에서 같은 수만큼 중복을 허용해 다시 뽑아 2,000번 계산하고, 가운데 95%가 놓이는 범위를 구했다. 범위가 넓으면 추정값 하나로 단정할 수 없다.'],
    ['판정 기준', '겹침 비율의 95% 구간 하한이 50% 이상이면 ‘잘 맞음’, 상한이 60% 미만이면 ‘어긋남’, 그 사이는 ‘일부만 맞음’. 계수에 대한 판정이다.'],
    ['어긋나는 원료', '다른 영향의 백분위가 탄소발자국의 백분위보다 기준(기본 40%p) 이상 높은 원료. 원료마다 차이가 가장 큰 영향 하나로 센다.'],
    ['K-means 군집 (결론에 미사용)', '값의 패턴이 비슷한 원료를 자동으로 묶는 방법. 실루엣 점수가 0.33으로 낮아(0.5 이상이면 뚜렷) 결론에 쓰지 않았다.']
  ];
  function build() {
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length;
    const repo = 'https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/';
    $('notes').innerHTML = `
    <div class="notes">
      <header class="notes-h"><h1>방법과 출처</h1><p class="lead">리포트에 쓴 데이터의 세부 정보, 용어, 재현 방법, 한계를 정리했다.</p></header>

      <section class="nb"><h2>데이터</h2>
        <table class="src"><tbody>
          <tr><th>데이터</th><td>한국환경산업기술원_환경성적표지 평가계수 (CSV, 11개 열)</td></tr>
          <tr><th>기준일</th><td>2021-08-02 (배포 파일명 기준). 포털 등록 2023-08-28, 최근 수정 2025-08-05</td></tr>
          <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(공공데이터포털 메타데이터, 2026-10-19 확인)</span></td></tr>
          <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">공공데이터포털 15120968</a></td></tr>
          <tr><th>함께 볼 문서</th><td><a href="https://www.data.go.kr/data/15089170/fileData.do" target="_blank" rel="noopener">환경성적표지 작성지침</a> (영향범주와 산정 방법의 근거)</td></tr>
        </tbody></table>
        <ul class="plain">
          <li><b>영향범주 명칭:</b> 환경성적표지 공식 명칭(탄소발자국, 물발자국, 자원발자국, 오존층영향, 산성비, 부영양화, 광화학스모그)으로 표기했다. 원자료 CSV의 물 관련 열 이름은 ‘물소모계수(m3 H2O eq)’다.</li>
          <li><b>정제:</b> “해당없음”은 빈 값으로 처리했다. 대분류·구분·항목·단위가 같은 중복은 0건, 0 이하의 값도 0건이었다.</li>
          <li><b>분석 범위:</b> 원료 및 에너지 생산 단계 ${nStage}건 중 단위가 kg인 ${RES.base_n}건에서 수자원 2건(상수·공업용수)을 뺀 <b>${POOL.length}건</b>. 수송·폐기·연료 사용 단계는 단위가 달라 분석하지 않았다.</li>
          <li><b>원자료에 없는 정보:</b> 계수별 전과정 목록 데이터의 출처, 영향평가(환산) 방법, 오차 범위, 재활용·소각 계수의 회피 부하 반영 여부. 물발자국 범주가 단순 사용량인지 물 부족 가중치를 반영한 값인지도 작성지침으로 확인이 필요하다.</li>
        </ul></section>

      <section class="nb"><h2>용어</h2>
        <dl class="glossary">${TERMS.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></section>

      <section class="nb"><h2>재현</h2>
        <p>모든 수치는 원자료에서 Python(pandas, NumPy, SciPy, scikit-learn)으로 다시 계산된다. 웹 화면의 순위상관, 겹침 비율, 어긋나는 원료 수가 Python 결과와 같은지는 자동 테스트(43개 항목)로 확인했다.</p>
        <pre><code>pip install -r requirements.txt
python analysis/reanalysis.py   # data/analysis_results.json, js/results.js 생성
node tests/stats.test.js        # 웹 계산과 Python 결과 비교</code></pre>
        <ul class="plain">
          <li><a href="${repo}analysis/reanalysis.py" target="_blank" rel="noopener">analysis/reanalysis.py</a>: 원자료에서 모든 결과를 만드는 코드</li>
          <li><a href="${repo}notebooks/data_preprocessing.ipynb" target="_blank" rel="noopener">notebooks/data_preprocessing.ipynb</a>: 정제 과정</li>
          <li><a href="${repo}tests/stats.test.js" target="_blank" rel="noopener">tests/stats.test.js</a>: 웹 계산 검산</li>
          <li><a href="${repo}data/lca_factors_clean.csv" target="_blank" rel="noopener">data/lca_factors_clean.csv</a>: 정제한 데이터</li>
        </ul></section>

      <section class="nb"><h2>한계</h2>
        <ul class="plain">
          <li><b>계수 사이의 관계는 제품 사이의 관계와 다를 수 있다.</b> 제품의 영향은 원료별 투입량 × 계수의 합이고, 이 데이터에는 투입량이 없다. 계수 분포만으로 제품 간 상충관계를 결론 내릴 수 없다.</li>
          <li>제품 하나의 전과정평가가 아니다. 기능단위, 시스템 경계, 기준흐름, 배분을 다루지 않았고 ISO 14040/14044에 따른 결과도 아니다.</li>
          <li>2021년 기준 값이라 현재 공정이나 전력 구성과 다를 수 있다.</li>
          <li>오차 범위 정보가 없어 작은 차이는 의미가 없을 수 있다. 그래서 값보다 순위와 큰 차이 위주로 해석했다.</li>
          <li>원료 풀의 ${Math.round(POOL.filter(r => r.category === '기초화학물질').length / POOL.length * 100)}%가 기초화학물질이다. 이 소재군을 뺀 결과와 소재군별 결과를 리포트에 함께 실었다.</li>
        </ul></section>
    </div>`;
  }
  L.tabs.notes = { build, built: false };
})();
