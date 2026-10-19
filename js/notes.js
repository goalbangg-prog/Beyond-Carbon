/* 방법·출처 탭: 데이터 출처, 분석 방법(쉬운 풀이), 재현 방법, 한계 */
(function () {
  const { $, esc, D, POOL, RES } = L;
  const METHODS = [
    ['빈 값(결측) 처리', '“해당없음”은 0이 아니라 빈 값으로 두었습니다. 영향 두 개를 비교할 때는 두 값이 모두 있는 원료만 썼습니다.'],
    ['로그 눈금', '값을 10배씩 커지는 눈금으로 그렸습니다. 계수가 수십만 배까지 차이 나서, 보통 눈금에서는 큰 값 몇 개만 보입니다.'],
    ['중앙값과 분위수', '크기순으로 세웠을 때 가운데 값(중앙값), 하위 10%·상위 10% 경계(P10·P90)입니다. 값이 한쪽으로 크게 치우쳐 평균 대신 썼습니다.'],
    ['백분위', '몇 번째쯤인지를 0~100으로 나타낸 값입니다. 값이 클수록 영향이 큰 쪽입니다. 두 영향을 비교할 때는 두 값이 모두 있는 원료끼리 다시 순위를 매겼습니다. 탄소는 187종, 물소모는 163종처럼 값이 있는 원료 수가 달라서, 서로 다른 집단의 순위를 빼면 비교가 어긋나기 때문입니다.'],
    ['Spearman 순위상관(ρ)', '두 영향에서 원료들의 순위가 얼마나 비슷한지를 −1~1로 나타냅니다. 1이면 순위가 완전히 같고 0이면 거의 관계가 없습니다. 값 대신 순위를 쓰기 때문에 극단값에 덜 흔들립니다. 상관이 곧 원인은 아닙니다.'],
    ['부트스트랩 95% 구간', '원료 목록에서 같은 수만큼 무작위로 다시 뽑아(중복 허용) 2,000번 계산하고, 가운데 95%가 놓이는 범위를 구했습니다. 상관계수와 선별 포착률 모두에 붙였습니다. 범위가 넓을수록 숫자 하나를 단정해서 말하면 안 됩니다.'],
    ['선별 포착률', '어떤 영향의 상위 20% 원료 중, 탄소발자국도 상위 20%에 드는 원료의 비율입니다. 탄소로만 골라 관리할 때 그 영향의 핵심 원료를 얼마나 함께 잡는지 보여 줍니다. 무작위로 골라도 약 20%입니다.'],
    ['놓치는 원료', '다른 영향의 백분위가 탄소발자국 백분위보다 일정 기준(기본 40%p) 이상 높은 원료입니다. 기준을 바꾼 결과도 함께 공개했습니다.'],
    ['판정 기준', '선별 포착률의 95% 구간이 모두 50% 이상이면 ‘탄소로 대신 볼 수 있음’, 구간 위쪽 끝이 60% 미만이면 ‘따로 확인해야 함’, 그 사이는 ‘일부만 잡힘’으로 나눴습니다.'],
    ['K-means 군집 (부록)', '값의 패턴이 비슷한 원료끼리 자동으로 묶는 방법입니다. 실루엣 점수(0.5 이상이면 경계가 뚜렷한 편)와 ARI(두 결과가 얼마나 같은지, 1이면 동일)로 점검했고, 경계가 흐려 결론에 쓰지 않았습니다.']
  ];
  function build() {
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length;
    $('notes').innerHTML = `
    <div class="notes">
      <header class="notes-h"><h1>방법과 출처</h1><p class="lead">사용한 데이터, 분석 방법, 재현 방법, 한계를 한곳에 모았습니다.</p></header>

      <section class="nb"><h2>데이터</h2>
        <table class="src"><tbody>
          <tr><th>데이터</th><td>한국환경산업기술원_환경성적표지 평가계수 (CSV, 11개 열)</td></tr>
          <tr><th>기준일</th><td>2021-08-02 (배포 파일명 기준). 포털 등록 2023-08-28, 최근 수정 2025-08-05</td></tr>
          <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(공공데이터포털 메타데이터, 2026-10-19 확인)</span></td></tr>
          <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">공공데이터포털 15120968</a></td></tr>
          <tr><th>함께 볼 문서</th><td><a href="https://www.data.go.kr/data/15089170/fileData.do" target="_blank" rel="noopener">환경성적표지 작성지침</a> (영향범주와 산정 방법의 근거, 이용허락범위 제한 없음)</td></tr>
        </tbody></table>
        <ul class="plain">
          <li><b>정제:</b> “해당없음”을 빈 값으로 처리, 대분류·구분·항목·단위가 같은 중복 0건, 0 이하의 값 0건을 확인했습니다.</li>
          <li><b>분석 범위:</b> 원료 및 에너지 생산 단계 ${nStage}건 중 단위가 kg인 ${RES.base_n}건에서 수자원 2건(상수·공업용수)을 뺀 <b>${POOL.length}건</b>을 원료 풀로 삼았습니다. 수송(ton·km)과 폐기(kg)는 단계 안에서만 비교했습니다.</li>
          <li><b>원자료에 없는 것:</b> 계수별 전과정 목록 데이터의 출처, 영향평가(환산) 방법, 오차 범위, 재활용·소각 계수의 회피 부하 반영 여부.</li>
        </ul></section>

      <section class="nb"><h2>분석 방법</h2>
        <dl class="glossary">${METHODS.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></section>

      <section class="nb"><h2>재현</h2>
        <p>모든 수치는 Python(pandas, NumPy, SciPy, scikit-learn)으로 원자료에서 다시 계산할 수 있습니다. 웹 화면의 순위상관, 선별 포착률, 놓치는 원료 수는 Python 결과와 같은지 자동 테스트로 검산했습니다.</p>
        <pre><code>pip install -r requirements.txt
python analysis/reanalysis.py   # data/analysis_results.json, js/results.js 생성</code></pre>
        <ul class="plain">
          <li><a href="https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/analysis/reanalysis.py" target="_blank" rel="noopener">analysis/reanalysis.py</a> · 원자료부터 모든 결과를 만드는 코드</li>
          <li><a href="https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/notebooks/data_preprocessing.ipynb" target="_blank" rel="noopener">notebooks/data_preprocessing.ipynb</a> · 원자료 정제 과정</li>
          <li><a href="https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/tests/stats.test.js" target="_blank" rel="noopener">tests/stats.test.js</a> · 웹 계산과 Python 결과 비교 테스트</li>
          <li><a href="https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/data/lca_factors_clean.csv" target="_blank" rel="noopener">data/lca_factors_clean.csv</a> · 정제한 데이터</li>
        </ul></section>

      <section class="nb"><h2>한계</h2>
        <ul class="plain">
          <li>평가계수는 2021년 기준 값이며, 지금의 공정과 전력 구성과 다를 수 있습니다.</li>
          <li>오차 범위 정보가 없어, 원료 사이의 작은 차이는 의미가 없을 수 있습니다. 그래서 값 대신 순위와 큰 차이(40%p) 위주로 해석했습니다.</li>
          <li>제품 하나의 전과정평가가 아닙니다. 기능단위, 시스템 경계, 기준흐름, 배분은 다루지 않았으며 ISO 14040/14044에 따른 결과가 아닙니다.</li>
          <li>원료 풀은 기초화학물질(${POOL.filter(r => r.category === '기초화학물질').length}건)이 가장 많아, 전체 상관에 이 소재군의 경향이 크게 반영됩니다. 소재군별로 다시 확인한 결과를 리포트에 함께 실었습니다.</li>
        </ul></section>
    </div>`;
  }
  L.tabs.notes = { build, built: false };
})();
