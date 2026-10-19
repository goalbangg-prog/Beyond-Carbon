/* 방법·출처 탭: 데이터 상세, 용어, 재현 방법, 한계 */
(function () {
  const { $, esc, D, POOL, RES } = L;
  const TERMS = [
    ['평가계수', '재료 1kg, 전기 1kWh처럼 정해진 양을 쓸 때 생기는 환경영향을 미리 계산해 둔 숫자예요. 제품의 환경성적을 낼 때 재료 사용량에 곱해서 써요.'],
    ['의심스러운 숫자', '숫자표를 네 가지 방법으로 훑어 찾은 숫자예요. 서로 다른 재료인데 세 가지 이상 숫자가 소수점 끝자리까지 같은 경우, 한 가지 숫자가 다른 재료와 완전히 같은 경우, 같은 항목의 중간값보다 1만 배 이상 크거나 1만분의 1 이하로 작은 경우, 오존층영향이 1kg당 0.001 kg CFC-11 eq 이상인 경우예요. 원본과 맞춰 보기 전이라 오류로 단정하지 않았고, 분석에서도 빼지 않았어요.'],
    ['계산 예시', '리포트 4장의 제품은 설명을 위해 정한 가상의 예예요. 실제 제품의 재료 구성을 쓴 게 아니에요.'],
    ['빈칸', '원자료의 “해당없음”이에요. 0이 아니라 측정하지 않은 숫자로 보고 비워 뒀어요. 두 영향을 비교할 때는 두 숫자가 모두 있는 재료만 썼어요.'],
    ['순위상관 ρ', '두 영향에서 재료의 순서가 얼마나 같은지를 −1~1로 나타낸 숫자예요. 1이면 순서가 똑같고 0이면 아무 관계가 없어요. 0.7 이상은 ‘비례해요’, 0.4 이상은 ‘약하게 비례해요’, 0.1 초과는 ‘거의 비례하지 않아요’로 적었어요.'],
    ['상위 20%', '그 영향의 숫자가 큰 쪽에서 20% 안에 드는 재료예요. 다섯 가지 영향 모두에서 30종 이상이 되는 가장 작은 기준이라 골랐어요.'],
    ['95% 범위', '재료 목록을 무작위로 다시 뽑아 2,000번 계산했을 때 가운데 95%가 들어오는 범위예요(부트스트랩). 범위가 넓으면 숫자 하나로 단정하기 어려워요.']
  ];
  function build() {
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length;
    const repo = 'https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/';
    const nKg = RES.base_n, sel = RES.selection, nb = RES.carbon_water_without_basic_chem, rs = RES.review_sensitivity;
    const cw = RES.carbon_rho_ci['물소모'], wcw = RES.within_category_carbon_water, wcr = RES.within_category_carbon_resource;
    const ozN = L.has(POOL, 6).length, ozMiss = 100 - Math.round(L.coverage(POOL, 6) * 100);
    const basicShare = Math.round(POOL.filter(r => r.category === '기초화학물질').length / POOL.length * 100);
    const DEC = [
      ['결론의 범위', '재료 1kg당 숫자에 대한 이야기로 한정했어요', '제품의 환경영향은 재료마다 ‘사용량 × 1kg당 숫자’를 더해서 계산해요. 이 자료에는 사용량이 없어서 제품끼리의 관계는 알 수 없어요.', '재료 숫자의 관계를 제품의 관계처럼 쓰게 돼요.'],
      ['비교 대상', `재료 단계의 1kg당 숫자 ${POOL.length}종만 비교했어요`, `단계마다 기준이 되는 양이 달라요. 재료 단계 ${nStage}개 중 ${nKg}개가 1kg당 숫자이고, 나머지는 1개당(${sel.stage_units.ea}개) 등이에요. 다이오드(1개당)와 트랜지스터(1kg당)를 한 줄에 세우면 재료가 아니라 단위가 순서를 정해요. 공업용수·상수는 재료가 아니라서 뺐고, 오존층영향은 ${POOL.length}종 중 ${ozN}종에만 숫자가 있어(${ozMiss}% 비어 있음) 비교에서 뺐어요.`, `공업용수·상수를 넣어도 탄소발자국–물발자국 ρ는 ${sel.rho_with_utility_water.toFixed(2)}로 비슷해요.`],
      ['비교 방법', '크기 대신 순서로, 두 숫자가 모두 있는 재료끼리 비교했어요', '같은 항목 안에서도 숫자가 수십만 배까지 차이 나서, 크기로 비교하면 큰 숫자 몇 개가 결과를 정해요. 숫자가 있는 재료 수도 항목마다 달라서(탄소발자국 187종, 물발자국 163종) 둘 다 있는 재료끼리 순서를 매겼어요.', '평균을 쓰면 아주 큰 숫자 몇 개에 결과가 끌려가요.'],
      ['상위 20% 기준', '모든 항목에서 상위 재료가 30종 이상 되는 가장 작은 기준이에요', `30종이면 재료 1종이 바뀔 때 비율이 약 3%p 움직이지만, 15종이면 약 7%p씩 움직여요. 15% 기준이면 가장 작은 그룹이 ${RES.cutoff_min_top['15']}종, 10%면 ${RES.cutoff_min_top['10']}종이에요.`, '20% 하나만 보면 기준에 따라 결과가 달라지는 경우를 놓쳐요. 그래서 10·20·30%를 함께 봤어요.'],
      ['재료 종류 차이', '재료 종류별로, 가장 많은 종류를 빼고 다시 계산했어요', `기초화학물질을 빼도 탄소발자국–물발자국 ρ는 ${nb.rho.toFixed(2)}(${nb.n}종)였어요.`, '특정 재료 종류 때문에 생긴 결과였다면 결론이 바뀌었을 거예요.']
    ];
    $('notes').innerHTML = `
    <div class="notes">
      <header class="notes-h"><h1>방법과 출처</h1><p class="lead">리포트에 쓴 자료, 용어, 다시 계산하는 방법, 한계를 정리했어요.</p></header>

      <section class="nb"><h2>자료</h2>
        <table class="src"><tbody>
          <tr><th>자료</th><td>한국환경산업기술원_환경성적표지 평가계수 (CSV, 11개 열)</td></tr>
          <tr><th>기준일</th><td>2021-08-02 (배포 파일명 기준). 포털 등록 2023-08-28, 최근 수정 2025-08-05</td></tr>
          <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(공공데이터포털 메타데이터, 2026-10-19 확인)</span></td></tr>
          <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">공공데이터포털 15120968</a></td></tr>
          <tr><th>함께 볼 문서</th><td><a href="https://www.data.go.kr/data/15089170/fileData.do" target="_blank" rel="noopener">환경성적표지 작성지침</a> (영향 항목과 계산 방법의 근거)</td></tr>
        </tbody></table>
        <ul class="plain">
          <li><b>영향범주 명칭:</b> 환경성적표지 공식 명칭(탄소발자국, 물발자국, 자원발자국, 오존층영향, 산성비, 부영양화, 광화학스모그)으로 적었어요. 원자료 CSV의 물 관련 열 이름은 ‘물소모계수(m3 H2O eq)’예요.</li>
          <li><b>정제:</b> “해당없음”은 빈칸으로 처리했어요. 대분류·구분·항목·단위가 같은 중복은 0건, 0 이하의 숫자도 0건이었어요.</li>
          <li><b>분석 범위:</b> 의심스러운 숫자는 ${D.length}개 전체에서 찾았어요(한 항목만 같은 숫자와 자릿수 확인은 재료 ${POOL.length}종 안에서). 영향 비교는 원료 및 에너지 생산 단계 ${nStage}개 중 단위가 kg인 ${RES.base_n}개에서 수자원 2개(상수·공업용수)를 뺀 <b>${POOL.length}개</b>로 했어요.</li>
          <li><b>원자료에 없는 정보:</b> 숫자마다 어떤 기초 자료에서 왔는지, 어떻게 환산했는지, 오차가 얼마인지는 원자료에 없어요. 물발자국이 단순 사용량인지 물 부족 정도를 반영한 숫자인지도 작성지침으로 확인이 필요해요.</li>
        </ul></section>

      <section class="nb"><h2>용어</h2>
        <dl class="glossary">${TERMS.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl></section>

      <section class="nb"><h2>결과가 우연이 아닌지 확인</h2>
        <p>리포트 5장의 “물발자국은 탄소발자국과 거의 따로 움직였어요”가 우연이나 자료 구성 때문은 아닌지 네 가지로 확인했어요. 모두 같은 결론이었어요.</p>
        <div class="checks">
          <div class="ck"><h3>재료를 다시 뽑아 계산해도</h3><p>재료 목록을 무작위로 다시 뽑아 2,000번 계산해도 탄소–물 ρ는 <b>${cw.lo.toFixed(2)}~${cw.hi.toFixed(2)}</b> 사이였어요.</p></div>
          <div class="ck"><h3>가장 많은 재료 종류를 빼도</h3><p>재료의 ${basicShare}%인 기초화학물질을 빼도 ρ는 <b>${nb.rho.toFixed(2)}</b>(${nb.n}종)였어요.</p></div>
          <div class="ck"><h3>의심스러운 숫자를 빼도</h3><p>1·2·3·6번 재료 ${rs.strong.excluded.length}종을 빼면 <b>${rs.strong['물소모'].rho.toFixed(2)}</b>, 1·2·3·4·6번 재료 ${rs.all.excluded_n}종을 빼면 <b>${rs.all['물소모'].rho.toFixed(2)}</b>였어요.</p></div>
        </div>
        <p style="margin-top:18px"><b>재료 종류별로 나눠 봐도</b> 6개 종류 모두 탄소–물 ρ가 탄소–자원 ρ보다 낮았어요.</p>
        <table class="mini"><thead><tr><th>재료 종류</th><th class="num">재료 수</th><th class="num">탄소–자원</th><th class="num">탄소–물</th></tr></thead><tbody>${Object.keys(wcw).sort((x, y) => wcw[y].n - wcw[x].n).map(c => `<tr><td>${esc(c)}</td><td class="num">${wcw[c].n}</td><td class="num">${wcr[c] ? wcr[c].rho.toFixed(2) : '-'}</td><td class="num"><b>${wcw[c].rho.toFixed(2)}</b></td></tr>`).join('')}</tbody></table></section>

      <section class="nb"><h2>비교 분석에서 내린 판단</h2>
        <div class="dec">${DEC.map((d, i) => `<details><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div></section>

      <section class="nb"><h2>다시 계산하는 방법</h2>
        <p>모든 숫자는 원자료에서 Python(pandas, NumPy, SciPy)으로 다시 계산돼요. 웹 화면의 계산이 Python 결과와 같은지는 자동 테스트(46개 항목)로 확인했어요.</p>
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
          <li><b>재료 숫자끼리의 관계는 제품끼리의 관계와 다를 수 있어요.</b> 제품의 영향은 재료별 사용량 × 숫자의 합인데, 이 자료에는 사용량이 없어요.</li>
          <li>제품 하나의 전과정평가가 아니에요. 기능단위, 시스템 경계, 배분을 다루지 않았고 ISO 14040/14044에 따른 결과도 아니에요.</li>
          <li>2021년 기준 숫자라 지금의 공정이나 전력 구성과 다를 수 있어요.</li>
          <li>오차 정보가 없어서 작은 차이는 의미가 없을 수 있어요. 그래서 큰 차이 위주로 해석했어요.</li>
          <li>비교한 재료의 ${Math.round(POOL.filter(r => r.category === '기초화학물질').length / POOL.length * 100)}%가 기초화학물질이에요. 이 종류를 뺀 결과도 리포트에 함께 실었어요.</li>
        </ul></section>
    </div>`;
  }
  L.tabs.notes = { build, built: false };
})();
