/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. */
(function () {
  const { $, esc, fmt, IMP, POOL, D, RES, C, NAME, RKEY, J, plot } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];

  /* ---------- 첫 화면: 탄소 순위 대 다른 영향 순위 ---------- */
  function hero() {
    const W = 640, H = 560, m = { l: 56, r: 18, t: 38, b: 52 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = p => m.l + p / 100 * iw, Y = p => m.t + ih - p / 100 * ih;
    const pts = POOL.filter(r => L.PCT[r.id] && L.PCT[r.id]['탄소'] != null);
    const grid = [0, 20, 40, 60, 80, 100];
    const band = `M${X(0)},${Y(40)} L${X(60)},${Y(100)} L${X(0)},${Y(100)} Z`;
    $('heroPlot').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="heroPlotT">
      <title id="heroPlotT">원료 ${pts.length}종의 탄소발자국 순위와 다른 환경영향 순위</title>
      ${grid.map(g => `<line class="g" x1="${X(g)}" x2="${X(g)}" y1="${Y(0)}" y2="${Y(100)}"/><line class="g" x1="${X(0)}" x2="${X(100)}" y1="${Y(g)}" y2="${Y(g)}"/>
        <text class="tk" x="${X(g)}" y="${Y(0) + 18}" text-anchor="middle">${g}</text><text class="tk" x="${X(0) - 10}" y="${Y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
      <path class="band" d="${band}"/>
      <line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}"/>
      <g id="dots">${pts.map(r => `<circle r="5.2" data-id="${r.id}" cx="0" cy="0" style="transform:translate(${X(L.PCT[r.id]['탄소'])}px,${Y(L.PCT[r.id]['탄소'])}px)"/>`).join('')}</g>
      <text class="band-t" x="${X(2)}" y="${Y(103)}">탄소만 보면 낮아 보이는 구역</text>
      <text class="band-s" x="${X(2) + 196}" y="${Y(103)}">다른 영향 순위가 40%p 이상 더 높음</text>
      <text class="diag-t" transform="translate(${X(88)},${Y(80)}) rotate(-40)">순위가 같은 선</text>
      <text class="ax" x="${X(50)}" y="${H - 8}" text-anchor="middle">탄소발자국 순위 (백분위, 오른쪽일수록 큼)</text>
      <text class="ax" id="axY" transform="translate(16,${Y(50)}) rotate(-90)" text-anchor="middle"></text>
    </svg><div class="tip" id="tip" hidden></div>`;
    const dots = [...document.querySelectorAll('#dots circle')], byId = Object.fromEntries(pts.map(r => [r.id, r]));
    const tip = $('tip');
    dots.forEach(c => {
      c.addEventListener('mouseenter', () => {
        const r = byId[c.dataset.id], p = L.PCT[r.id], k = $('heroPlot').dataset.lens;
        tip.innerHTML = `<b>${esc(r.name)}</b><span>${esc(r.category)}</span><span>탄소발자국 ${L.topLabel(p['탄소'])}</span><span>${NAME[k]} ${p[k] == null ? '값 없음' : L.topLabel(p[k])}</span>`;
        tip.hidden = false; const b = c.getBoundingClientRect(), host = $('heroPlot').getBoundingClientRect();
        tip.style.left = (b.left - host.left + 12) + 'px'; tip.style.top = (b.top - host.top - 8) + 'px';
      });
      c.addEventListener('mouseleave', () => (tip.hidden = true));
    });
    const setLens = (k, first) => {
      $('heroPlot').dataset.lens = k;
      document.querySelectorAll('[data-lens]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lens === k));
      $('axY').textContent = `${NAME[k]} 순위 (백분위, 위쪽일수록 큼)`;
      let n = 0;
      dots.forEach(c => {
        const p = L.PCT[c.dataset.id], x = p['탄소'], y = p[k];
        c.style.transitionDelay = first && !L.reduce ? (x / 100 * 0.6).toFixed(2) + 's' : '0s';
        if (y == null) { c.style.transform = `translate(${X(x)}px,${Y(x)}px)`; c.setAttribute('class', 'na'); return; }
        const hid = y - x >= 40; if (hid) n++;
        c.style.transform = `translate(${X(x)}px,${Y(y)}px)`; c.setAttribute('class', hid ? 'hid' : 'on');
      });
      const ci = CI(k), cap = CAP(k);
      L.count($('roRho'), ci.rho, 2); $('roCI').textContent = `95% 구간 ${ci.lo.toFixed(2)}~${ci.hi.toFixed(2)} · 원료 ${ci.n}종`;
      L.count($('roCap'), cap['포착률']); $('roCapT').textContent = `${NAME[k]} 상위 20%(${cap['다른영향상위']}종) 중 ${cap['함께상위']}종만 탄소 상위 20%에 함께 들어갑니다. 무작위로 골라도 20%입니다.`;
      L.count($('roHid'), n); $('roHidT').textContent = `탄소 순위보다 ${NAME[k]} 순위가 40%p 이상 높은 원료`;
    };
    $('lensBar').innerHTML = LENSES.map(k => `<button type="button" data-lens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('');
    document.querySelectorAll('[data-lens]').forEach(b => b.addEventListener('click', () => setLens(b.dataset.lens)));
    // 처음에는 모든 점이 '순위가 같은 선' 위에 있다가, 실제 위치로 흩어진다
    if (L.reduce) setLens('물', true); else setTimeout(() => setLens('물', true), 650);
  }

  /* ---------- 상관계수 구간 (부트스트랩 95%) ---------- */
  function forest() {
    const rows = LENSES.map(k => ({ k, ...CI(k) })).sort((a, b) => b.rho - a.rho);
    const W = 470, rowH = 44, H = rows.length * rowH + 52, x0 = 104, x1 = W - 20, X = v => x0 + v * (x1 - x0);
    $('forest').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="탄소발자국과 다른 영향의 순위상관과 95% 구간">
      <rect class="zone" x="${X(0)}" y="8" width="${X(.4) - X(0)}" height="${rows.length * rowH}" />
      <rect class="zone z2" x="${X(.4)}" y="8" width="${X(.7) - X(.4)}" height="${rows.length * rowH}" />
      <rect class="zone z3" x="${X(.7)}" y="8" width="${X(1) - X(.7)}" height="${rows.length * rowH}" />
      ${[0, .2, .4, .6, .8, 1].map(v => `<text class="tk" x="${X(v)}" y="${rows.length * rowH + 28}" text-anchor="middle">${v.toFixed(1)}</text>`).join('')}
      <text class="zt" x="${(X(0) + X(.4)) / 2}" y="${rows.length * rowH + 46}" text-anchor="middle">거의 따로</text>
      <text class="zt" x="${(X(.4) + X(.7)) / 2}" y="${rows.length * rowH + 46}" text-anchor="middle">어느 정도 함께</text>
      <text class="zt" x="${(X(.7) + X(1)) / 2}" y="${rows.length * rowH + 46}" text-anchor="middle">거의 함께</text>
      ${rows.map((r, i) => { const y = 8 + i * rowH + rowH / 2; return `<g class="fr${r.k === '물' ? ' weak' : ''}">
        <text class="fl" x="0" y="${y + 5}">${NAME[r.k]}</text>
        <line class="wh" x1="${X(r.lo)}" x2="${X(r.hi)}" y1="${y}" y2="${y}" style="--w:${X(r.hi) - X(r.lo)}"/>
        <circle cx="${X(r.rho)}" cy="${y}" r="7"/><text class="fv" x="${X(r.hi) + 10}" y="${y + 5}">${r.rho.toFixed(2)}</text></g>`; }).join('')}
    </svg>`;
    L.onView($('forest'), () => $('forest').classList.add('drawn'));
  }

  /* ---------- 선별 포착률 막대 ---------- */
  function capture() {
    const rows = LENSES.map(k => ({ k, ...CAP(k) })).sort((a, b) => a['포착률'] - b['포착률']);
    $('capBars').innerHTML = rows.map(r => `<div class="cb"><span class="cb-n">${NAME[r.k]}</span>
      <div class="cb-t"><i style="--v:${r['포착률']}%"></i><b class="base" title="무작위 기준 20%"></b></div>
      <span class="cb-v"><b>${r['포착률']}%</b><small>${r['함께상위']}/${r['다른영향상위']}종</small></span></div>`).join('') +
      `<div class="cb-legend"><span><i class="sw fill"></i>탄소 상위 20%로 함께 잡히는 비율</span><span><i class="sw base"></i>무작위로 골라도 잡히는 비율(20%)</span></div>`;
    L.onView($('capBars'), () => $('capBars').classList.add('drawn'));
  }

  /* ---------- 놓치는 원료: 기준을 바꿔 보기 ---------- */
  function hiddenTool() {
    const s = $('thSlider');
    const draw = () => {
      const th = +s.value, hid = L.hidden(th);
      $('thVal').textContent = th; L.count($('thN'), hid.length, 0, 400);
      const by = {}; hid.forEach(h => (by[h.k] = (by[h.k] || 0) + 1));
      const mx = Math.max(1, ...Object.values(by));
      $('thBy').innerHTML = LENSES.map(k => `<div class="mb"><span>${NAME[k]}</span><i style="width:${(by[k] || 0) / mx * 100}%"></i><b>${by[k] || 0}</b></div>`).join('');
      $('thTable').innerHTML = hid.length ? `<table class="tbl"><thead><tr><th>원료</th><th>소재군</th><th>탄소발자국</th><th>더 크게 드러나는 영향</th><th>그 영향 순위</th><th class="num">순위 차이</th></tr></thead><tbody>${hid.slice(0, 10).map(h => `<tr><td><b>${esc(h.r.name)}</b></td><td>${esc(h.r.category)}</td><td class="muted">${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td class="ochre"><b>${L.topLabel(h.o)}</b></td><td class="num">${Math.round(h.diff)}%p</td></tr>`).join('')}</tbody></table>${hid.length > 10 ? `<p class="hint">순위 차이가 큰 10종만 보여 줍니다. 나머지 ${hid.length - 10}종은 데이터 탐색 탭에서 확인할 수 있습니다.</p>` : ''}` : '<p class="empty">이 기준을 넘는 원료가 없습니다.</p>';
    };
    s.addEventListener('input', draw); draw();
  }

  function build() {
    const ozoneAll = D.filter(r => r.v[6] != null).length, onlyCarbon = D.filter(r => r.v.filter(v => v != null).length === 1).length;
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n;
    const pairNs = LENSES.map(k => CI(k).n), nMin = Math.min(...pairNs), nMax = Math.max(...pairNs);
    const ozMiss = 100 - Math.round(L.coverage(POOL, 6) * 100), smogMiss = 100 - Math.round(L.coverage(POOL, 5) * 100);
    const th = RES.hidden_threshold, wcw = RES.within_category_carbon_water, wcr = RES.within_category_carbon_resource;
    const ks = RES.k_scores, sens = RES.sensitivity, K = RES.chosen_k;
    const silK = ks.find(x => x.k === K).실루엣;
    const funnel = [
      ['전체 평가계수', D.length, ''],
      ['원료 및 에너지 생산 단계', nStage, '수송·폐기·연료 사용 단계는 단위와 제공되는 영향이 달라 따로 봅니다.'],
      ['단위가 kg인 원료', nKg, 'MJ 같은 다른 단위는 1kg 원료와 같은 줄에 세울 수 없습니다.'],
      ['수자원(상수·공업용수) 제외', POOL.length, '재료가 아니라 용수이고, 값이 1,000배 이상 작아 순위를 한쪽으로 끌어당깁니다.'],
      ['영향 쌍마다 두 값이 다 있는 원료', `${nMin}~${nMax}`, '빈 값을 0으로 채우지 않았기 때문에, 비교하는 영향에 따라 대상 수가 달라집니다.']
    ];
    const decisions = [
      ['오존층영향', '분석에서 뺐습니다', `전체 ${D.length}건 중 값이 있는 항목이 ${ozoneAll}건이고, 원료 단계에서는 ${ozMiss}%가 비어 있습니다.`, `넣으면 비교 대상이 십여 종으로 줄어 우연한 결과가 나올 수 있습니다.`],
      ['빈 값', '0으로 채우지 않았습니다', '‘측정하지 않음’과 ‘영향이 0’은 다릅니다.', '0으로 채우면 비어 있는 영향이 실제보다 낮아 보이고 상관계수가 틀어집니다.'],
      ['단위가 다른 항목', 'kg 기준 원료끼리만 비교했습니다', `kg, MJ, ton·km는 뜻이 달라 한 순위에 세울 수 없습니다. 원료 단계 ${nStage}건 중 ${POOL.length}건이 대상입니다.`, '억지로 환산하면 근거 없는 비교가 됩니다.'],
      ['수자원', '분석에서 뺐습니다', '재료가 아니라 용수이고, 값이 1,000배 이상 작습니다.', '넣으면 ‘가장 낮은 원료’ 자리를 용수가 차지해 순위가 왜곡됩니다.'],
      ['요약 방법', '평균 대신 순위와 중앙값을 썼습니다', '계수가 수십만 배까지 차이 나서, 평균과 일반 상관계수는 큰 값 몇 개에 끌려갑니다.', '평균을 쓰면 극단값 몇 개가 결론을 정합니다.'],
      ['상관계수의 믿을 만함', '부트스트랩으로 95% 구간을 붙였습니다', `원료를 다시 뽑아 2,000번 계산했습니다. 탄소–물소모는 ${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}로, 가장 높게 잡아도 ‘어느 정도 함께’ 수준입니다.`, '숫자 하나만 보여 주면 우연인지 아닌지 판단할 수 없습니다.'],
      ['소재군 섞임', '같은 소재군 안에서도 다시 확인했습니다', `기초화학물질(${wcw['기초화학물질'].n}종)만 봐도 탄소–물소모는 ${wcw['기초화학물질'].rho.toFixed(2)}입니다.`, '소재군이 섞여서 생긴 착시였다면 결론이 뒤집혔을 것입니다.'],
      ['‘놓치는 원료’ 기준', '순위 차이 40%p로 정하고, 기준을 바꾼 결과도 공개했습니다', `30%p면 ${th['30']}종, 50%p면 ${th['50']}종, 60%p면 ${th['60']}종입니다.`, '기준 하나만 보여 주면 숫자를 고른 것처럼 보일 수 있습니다.'],
      ['선별 포착률 기준', '상위 20%를 ‘중점 관리 대상’으로 봤습니다', '실무에서 핫스팟을 추릴 때 흔히 쓰는 범위이고, 무작위 기준(20%)과 바로 비교할 수 있습니다.', '기준을 넓히면 포착률이 올라가지만 ‘중점 관리’의 의미가 흐려집니다.'],
      ['재활용 계수', '소각과의 비교 해석을 보류했습니다', '재활용으로 새 원료를 덜 만드는 효과(회피 부하)가 계수에 들어갔는지 원자료에 나와 있지 않습니다.', '모르고 비교하면 ‘재활용이 몇 배 좋다’는 근거 없는 결론이 됩니다.'],
      ['군집 분석', '결과를 부록으로 내렸습니다', `실루엣 점수가 ${silK.toFixed(2)}로 낮고, 묶는 기준을 바꾸면 일치도가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${sens['6개(+스모그)'].ARI.toFixed(2)}로 떨어집니다.`, '등급처럼 보여 주면 근거보다 큰 확신을 줍니다.']
    ];
    const steps = [['c1', '데이터와 평가계수'], ['c2', '빈 값 확인'], ['c3', '탄소는 대신할 수 있나'], ['c4', '걸러내면 무엇을 놓치나'], ['c5', '수송과 폐기'], ['c6', '묶어 보기 시도'], ['c7', '판단 기록'], ['c8', '말할 수 있는 것']];

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}건 분석</p>
        <h1>탄소발자국이 낮으면,<br>환경영향도 낮을까?</h1>
        <p class="lead">한국환경산업기술원이 공개한 평가계수로 원료 ${POOL.length}종의 순위를 비교했습니다. 점 하나가 원료 하나입니다. 탄소발자국이 모든 걸 말해 준다면 점은 대각선 위에 모여야 합니다.</p>
        <div class="lens"><span id="lensLabel">비교할 영향</span><div id="lensBar" role="group" aria-labelledby="lensLabel"></div></div>
        <dl class="readout" aria-live="polite">
          <div><dt>함께 움직이는 정도 <small>순위상관 ρ</small></dt><dd><b id="roRho">0.00</b></dd><p id="roCI"></p></div>
          <div><dt>탄소로 걸러낼 때 잡히는 비율</dt><dd><b id="roCap">0</b><span>%</span></dd><p id="roCapT"></p></div>
          <div class="hl"><dt><span id="roHidT">놓치는 원료</span></dt><dd><b id="roHid">0</b><span>종</span></dd><p>그래프의 황토색 점입니다. 점에 마우스를 올리면 원료 이름이 보입니다.</p></div>
        </dl>
      </div>
      <figure class="hero-plot" id="heroPlot"></figure>
    </section>

    <div class="doc">
      <nav class="rail" aria-label="분석 순서"><p>분석 순서</p><ol>${steps.map(([id, t], i) => `<li><a href="#${id}" data-go="${id}"><span>${i + 1}</span>${t}</a></li>`).join('')}</ol></nav>
      <div class="chapters">

      <section class="ch" id="c1"><header><span class="chno">1</span><h2>어떤 데이터인가</h2></header>
        <p class="lead">공공데이터포털에 공개된 원자료를 그대로 내려받아 다시 정리했습니다. 이용허락범위는 ‘제한 없음’입니다.</p>
        <div class="two">
          <table class="src"><tbody>
            <tr><th>데이터</th><td>한국환경산업기술원_환경성적표지 평가계수</td></tr>
            <tr><th>제공</th><td>한국환경산업기술원, 공공데이터포털(data.go.kr)</td></tr>
            <tr><th>기준일</th><td>2021-08-02 (배포 파일 기준)</td></tr>
            <tr><th>규모</th><td>${D.length}건 · 환경영향 7종 · CSV</td></tr>
            <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(2026-10-19 확인)</span></td></tr>
            <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">data.go.kr/data/15120968</a></td></tr>
          </tbody></table>
          <div class="explain"><h3>평가계수란</h3>
            <p>원료 1kg, 연료 1MJ, 화물 1톤을 1km 옮기기처럼 <b>정해진 단위만큼 썼을 때 생기는 환경영향을 7가지로 미리 계산해 둔 값</b>입니다. 환경성적표지를 산정할 때 원료·에너지·수송·폐기 단계의 배경 데이터로 쓰입니다.</p>
            <p>전과정 목록(투입물과 배출물의 목록)에 영향평가 방법을 적용해 단위당 값으로 만든 결과라서, 제품 하나의 전과정평가 결과가 아닙니다. 계수마다 어떤 목록 데이터와 환산 방법을 썼는지는 이 파일에 없어서, <a href="https://www.data.go.kr/data/15089170/fileData.do" target="_blank" rel="noopener">환경성적표지 작성지침</a> 원문으로 확인해야 합니다.</p></div>
        </div>
        <table class="tbl imp"><thead><tr><th>영향</th><th>단위</th><th>무엇을 보나</th><th class="num">원료 풀에서 빈 값</th></tr></thead><tbody>
          ${IMP.map((m, j) => `<tr${m.k === '오존' ? ' class="off"' : ''}><td><b>${m.name}</b></td><td>${m.sym}</td><td>${m.plain}</td><td class="num">${100 - Math.round(L.coverage(POOL, j) * 100)}%</td></tr>`).join('')}
        </tbody></table>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>빈 값이 어디에 몰려 있나</h2></header>
        <p class="lead">빈 값을 0으로 채우면 ‘영향이 없다’는 뜻이 되어 결과가 틀어집니다. 그래서 먼저 어디가 비어 있는지 확인하고, 분석 대상을 단계별로 걸렀습니다.</p>
        <div class="two wide-l">
          <figure class="fig"><figcaption>단계별·영향별 빈 값 비율</figcaption><div id="chCover" class="chart h340"></div></figure>
          <figure class="fig"><figcaption>분석 대상을 이렇게 걸렀습니다</figcaption>
            <ol class="funnel" id="funnel">${funnel.map(([n, v, note]) => { const num = typeof v === 'number' ? v : +String(v).split('~')[1]; return `<li><div class="fn-h"><span>${n}</span><b>${v}</b></div><div class="fn-bar"><i style="--w:${(num / D.length * 100).toFixed(1)}%"></i></div>${note ? `<p>${note}</p>` : ''}</li>`; }).join('')}</ol></figure>
        </div>
        <ul class="facts">
          <li><b>${onlyCarbon}건은 탄소발자국만 있습니다.</b> 대부분이 연료원별 사용(${RES.coverage_by_stage['연료원별 사용']['항목수']}건)과 화학반응공정(${RES.coverage_by_stage['화학반응공정']['항목수']}건)입니다.</li>
          <li><b>오존층영향은 뺐습니다.</b> 원료 풀에서 ${ozMiss}%가 비어 있습니다.</li>
          <li><b>광화학스모그는 ${smogMiss}%가 비어 있어</b> 비교 대상이 가장 적습니다(${CI('스모그').n}종).</li>
        </ul>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>탄소발자국이 다른 영향을 대신 보여 줄 수 있나</h2></header>
        <p class="lead">탄소발자국이 큰 원료가 다른 영향도 큰지, 순위가 얼마나 같이 움직이는지(Spearman 순위상관 ρ)로 봤습니다. 원료를 다시 뽑아 2,000번 계산해 95% 구간도 붙였습니다.</p>
        <div class="two">
          <figure class="fig"><figcaption>탄소발자국과의 순위상관과 95% 구간</figcaption><div id="forest" class="forest"></div></figure>
          <div class="explain">
            <h3>산성화·자원은 함께, 물소모는 따로</h3>
            <p>산성화(${CI('산성').rho.toFixed(2)})와 자원발자국(${CI('자원').rho.toFixed(2)})은 탄소발자국과 순위가 거의 함께 움직입니다. 연료를 많이 태우는 공정일수록 셋 다 커지기 때문으로 보입니다.</p>
            <p>물소모는 ${CI('물').rho.toFixed(2)}이고, 구간의 위쪽 끝도 ${CI('물').hi.toFixed(2)}에 그칩니다. 탄소발자국으로는 물 부담을 거의 짐작할 수 없습니다.</p>
            <div class="check"><h4>소재군이 섞여서 생긴 착시일까?</h4>
              <p>소재군마다 따로 계산해도, 모든 소재군에서 탄소–물소모가 탄소–자원보다 낮았습니다.</p>
              <table class="mini"><thead><tr><th>소재군</th><th class="num">탄소–자원</th><th class="num">탄소–물소모</th></tr></thead><tbody>
              ${Object.keys(wcw).sort((a, b) => wcw[b].n - wcw[a].n).map(c => `<tr><td>${esc(c)} <small>${wcw[c].n}종</small></td><td class="num">${wcr[c] ? wcr[c].rho.toFixed(2) : '-'}</td><td class="num ${wcw[c].rho < .4 ? 'ochre' : ''}">${wcw[c].rho.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
          </div>
        </div>
        <div class="two" style="margin-top:28px">
          <figure class="fig"><figcaption>영향끼리의 순위상관</figcaption><div id="chCorr" class="chart h380"></div></figure>
          <figure class="fig"><figcaption class="fc-row">원료별로 보기
              <span class="sel"><select id="rsX" aria-label="가로축 영향"></select> × <select id="rsY" aria-label="세로축 영향"></select></span></figcaption>
            <div id="chScatter" class="chart h380"></div><p class="read" id="scRead"></p></figure>
        </div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>탄소발자국으로 걸러내면 무엇을 놓치나</h2></header>
        <p class="lead">실무에서는 영향이 큰 원료부터 관리합니다. 탄소발자국 상위 20% 원료만 골라 관리한다면, 다른 영향의 상위 20% 원료를 얼마나 함께 잡을 수 있을까요?</p>
        <figure class="fig cap"><figcaption>선별 포착률: 다른 영향 상위 20% 중 탄소 상위 20%에도 드는 비율</figcaption><div id="capBars"></div>
          <p class="read">부영양화와 물소모는 상위 원료의 <b>절반 이상을 놓칩니다</b>. 산성화는 ${CAP('산성')['포착률']}%로 비교적 잘 잡힙니다.</p></figure>
        <div class="tool">
          <div class="tool-ctl">
            <label for="thSlider">‘놓치는 원료’ 기준: 다른 영향 순위가 탄소 순위보다 <b id="thVal">40</b>%p 이상 높음</label>
            <input type="range" id="thSlider" min="20" max="70" step="5" value="40">
            <div class="ticks"><span>20</span><span>40 (기본)</span><span>70</span></div>
            <div class="big"><b id="thN">0</b><span>종 / ${POOL.length}종</span></div>
            <div class="mbars" id="thBy"></div>
            <p class="hint">기준을 움직여도 물소모가 가장 많이 놓치는 영향이라는 결과는 그대로입니다.</p>
          </div>
          <div class="tool-out" id="thTable"></div>
        </div>
        <p class="note">순위는 원료 ${POOL.length}종 안에서의 상대 위치입니다. 용도가 다른 소재의 우열을 가르는 값이 아니라, 대체 소재를 검토할 때 ‘탄소는 줄었는데 다른 영향이 늘지 않았는지’ 확인할 대상을 알려 줍니다.</p>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>수송과 폐기는 무엇을 고르느냐에 따라 달라진다</h2></header>
        <p class="lead">원료 다음으로 결과를 크게 흔드는 것은 수송수단과 폐기 방식입니다. 탄소발자국 기준으로 비교했습니다.</p>
        <div class="two">
          <figure class="fig"><figcaption>수송수단별 탄소발자국 (1톤을 1km 옮길 때)</figcaption><div id="chTrans" class="chart h340"></div>
            <p class="read">항공은 가장 낮은 ${esc(RES.transport_min_name)}의 <b>${L.times(RES.transport_ratio_air_vs_ship)}</b>입니다.</p></figure>
          <figure class="fig"><figcaption>같은 폐기물을 소각할 때와 재활용할 때 (1kg당)</figcaption><div id="chWaste" class="chart h340"></div>
            <p class="read">소각과 재활용의 중앙값은 ${L.times(RES.waste_ratio_incin_vs_recycle)} 차이가 납니다. 다만 아래 이유로 이 숫자를 그대로 해석하지 않았습니다.</p></figure>
        </div>
        <aside class="callout"><h3>재활용 계수를 ‘재활용이 몇 배 좋다’로 읽지 않은 이유</h3>
          <p>재활용으로 새 원료를 덜 만들게 되면, 그만큼 줄어든 배출(회피 부하)을 계산에 넣는 방법이 있습니다. 이 효과를 넣으면 계수가 0보다 작아질 수도 있습니다. 그런데 이 데이터의 재활용 계수 9건은 <b>모두 0보다 큽니다</b>. 재활용 공정 자체의 부담만 담았을 가능성이 높지만, 원자료에 산정 방식이 없어 확인할 수 없습니다.</p>
          <p>소각 계수도 에너지 회수 효과를 넣었는지 알 수 없습니다. 두 계수가 같은 기준으로 만들어졌는지 모르는 상태에서 비교하면 결론이 뒤집힐 수 있어 해석을 보류했습니다. 제품이 다른 곳의 배출을 줄였다고 주장하는 <b>회피배출</b>(흔히 Scope 4라고 부르는 개념)도 같습니다. 무엇과 비교했는지, 그 기준이 무엇인지부터 확인해야 합니다.</p></aside>
      </section>

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>비슷한 원료끼리 묶어 보려 했지만</h2></header>
        <p class="lead">5가지 영향이 모두 있는 원료 ${RES.cluster_n}종을 K-means로 묶어 봤습니다. 결과를 보기 전에 군집 수를 고르는 기준을 먼저 정했고, ${K}개가 골라졌습니다.</p>
        <div class="appendix"><div><b>${silK.toFixed(2)}</b><span>실루엣 점수<br><small>0.5 이상이어야 경계가 뚜렷한 편</small></span></div>
          <div><b>${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${sens['6개(+스모그)'].ARI.toFixed(2)}</b><span>묶는 기준을 바꿨을 때 일치도<br><small>1이면 결과가 같음</small></span></div>
          <p>경계가 흐리고 기준에 따라 결과가 바뀌어서, 원료를 등급처럼 나누는 데 쓰지 않았습니다. <b>뚜렷한 묶음은 없었다</b>는 것이 결론이고, 계산 과정은 <a href="https://github.com/goalbangg-prog/Beyond-Carbon/blob/main/analysis/reanalysis.py" target="_blank" rel="noopener">분석 코드</a>에 부록으로 남겼습니다.</p></div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>분석하면서 내린 판단</h2></header>
        <p class="lead">정답이 없는 선택을 여러 번 했습니다. 줄을 누르면 다르게 했을 때 어떻게 됐을지 볼 수 있습니다.</p>
        <div class="dec" id="dec">${decisions.map((d, i) => `<details${i < 2 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>

      <section class="ch" id="c8"><header><span class="chno">8</span><h2>이 데이터로 말할 수 있는 것과 없는 것</h2></header>
        <div class="yesno">
          <div class="yes"><h3>말할 수 있는 것</h3><ul>
            <li>같은 단위(1kg)의 원료끼리 어느 쪽 영향이 큰지</li>
            <li>탄소발자국이 다른 영향을 얼마나 대신 보여 주는지, 어디서 어긋나는지</li>
            <li>수송수단·폐기 방식 같은 선택지 사이의 대략적인 차이</li></ul></div>
          <div class="no"><h3>말할 수 없는 것</h3><ul>
            <li>제품 하나의 전과정평가 결과: 기능단위, 시스템 경계, 기준흐름이 없습니다.</li>
            <li>기능이 다른 소재 중 어느 쪽이 더 친환경인지</li>
            <li>계수가 얼마나 정확한지: 오차 범위(불확도) 정보가 없습니다.</li>
            <li>지금 시점의 값: 2021년 기준이라 현재 공정이나 전력 구성과 다를 수 있습니다.</li></ul></div>
        </div>
        <div class="next"><h3>다음 단계</h3><p>이 분석은 계수 데이터를 쓰기 전에 무엇을 확인해야 하는지에 대한 연습입니다. 다음에는 환경성적표지 작성지침을 따라 제품 하나를 정하고, 기능단위·시스템 경계·기준흐름을 정한 뒤 실제 전과정 목록 데이터셋으로 분석할 계획입니다. 데이터마다 어디서 가져왔고 왜 골랐는지는 출처표로 남깁니다.</p></div>
      </section>
      </div>
    </div>`;

    hero(); forest(); capture(); hiddenTool();

    // 레일: 읽는 위치 표시
    const links = [...document.querySelectorAll('.rail a')];
    links.forEach(a => a.addEventListener('click', e => { e.preventDefault(); $(a.dataset.go).scrollIntoView({ behavior: L.reduce ? 'auto' : 'smooth', block: 'start' }); }));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.dataset.go === e.target.id)); }), { rootMargin: '-35% 0px -60% 0px' });
      steps.forEach(([id]) => io.observe($(id)));
    }
    L.onView($('funnel'), () => $('funnel').classList.add('drawn'));

    // ---- 차트 (화면에 들어올 때 그린다) ----
    const stages = L.STAGES.filter(s => RES.coverage_by_stage[s]), cv = (s, k) => RES.coverage_by_stage[s][RKEY[k]];
    const order7 = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'];
    L.onView($('chCover'), () => plot('chCover', [{ type: 'heatmap', x: order7.map(k => NAME[k]), y: stages.map(s => `${s} (${RES.coverage_by_stage[s]['항목수']})`), z: stages.map(s => order7.map(k => 100 - cv(s, k))), text: stages.map(s => order7.map(k => Math.round(100 - cv(s, k)) + '%')), texttemplate: '%{text}', zmin: 0, zmax: 100, colorscale: [[0, '#E9EEF0'], [.5, '#E8C68C'], [1, C.ochre]], showscale: false, xgap: 3, ygap: 3, hovertemplate: '%{y}<br>%{x}: 빈 값 %{text}<extra></extra>' }],
      { margin: { l: 170, r: 6, t: 6, b: 56 }, xaxis: { tickangle: -20, showgrid: false }, yaxis: { autorange: 'reversed', showgrid: false } }));

    const KS6 = ['탄소', ...L.OTHERS];
    L.onView($('chCorr'), () => {
      const mat = KS6.map(a => KS6.map(b => (a === b ? 1 : L.pair(a, b).rho))), nn = KS6.map(a => KS6.map(b => (a === b ? POOL.filter(r => r.v[J(a)] != null).length : L.pair(a, b).n)));
      plot('chCorr', [{ type: 'heatmap', x: KS6.map(k => NAME[k]), y: KS6.map(k => NAME[k]), z: mat, zmin: 0, zmax: 1, colorscale: [[0, '#F7F1E6'], [.4, '#E8C68C'], [.4001, '#D4E5EA'], [1, C.teal]], showscale: false, xgap: 3, ygap: 3, text: mat.map(r => r.map(v => v.toFixed(2))), texttemplate: '%{text}', customdata: nn, hovertemplate: '%{y} × %{x}<br>ρ %{z:.2f} (원료 %{customdata}종)<extra></extra>' }],
        { margin: { l: 96, b: 80, t: 6, r: 6 }, xaxis: { tickangle: -25, showgrid: false }, yaxis: { autorange: 'reversed', showgrid: false } });
    });

    L.opts($('rsX'), KS6, k => k, k => NAME[k]); L.opts($('rsY'), KS6, k => k, k => NAME[k]); $('rsX').value = '탄소'; $('rsY').value = '물';
    const drawSc = () => {
      const a = $('rsX').value, b = $('rsY').value, ja = J(a), jb = J(b);
      if (a === b) { L.purge('chScatter'); $('chScatter').innerHTML = '<p class="empty">가로축과 세로축에 서로 다른 영향을 골라 주세요.</p>'; $('scRead').textContent = ''; return; }
      const p = L.pair(a, b), pts = p.rows.filter(r => r.v[ja] > 0 && r.v[jb] > 0), P = L.PCT;
      const up = pts.filter(r => P[r.id][b] - P[r.id][a] >= 40), rest = pts.filter(r => !up.includes(r));
      const tr = (arr, name, color, size) => ({ type: 'scatter', mode: 'markers', name, x: arr.map(r => r.v[ja]), y: arr.map(r => r.v[jb]), text: arr.map(r => `${r.name} (${r.category})`), marker: { size, color, opacity: .85, line: { width: 0 } }, hovertemplate: `%{text}<br>${NAME[a]} %{x:.3g}<br>${NAME[b]} %{y:.3g}<extra></extra>` });
      plot('chScatter', [tr(rest, '그 외', '#9FB9C2', 7), tr(up, `${L.josa(NAME[b], '이', '가')} 순위상 40%p 이상 높은 원료`, C.ochre, 9)], { xaxis: { type: 'log', title: `${NAME[a]} (${IMP[ja].sym}/kg)` }, yaxis: { type: 'log', title: `${NAME[b]} (${IMP[jb].sym}/kg)` }, legend: { orientation: 'h', y: -0.26 }, margin: { b: 90 } });
      const w = p.rho >= .7 ? '순위가 거의 함께 움직입니다' : p.rho >= .4 ? '어느 정도 함께 움직이지만 예외가 많습니다' : '거의 따로 움직입니다';
      $('scRead').innerHTML = `<b>ρ ${p.rho.toFixed(2)}</b> · ${w}. 원료 ${p.n}종을 비교했고, 황토색 ${up.length}종은 세로축 영향의 순위가 40%p 이상 높습니다.`;
    };
    $('rsX').onchange = drawSc; $('rsY').onchange = drawSc;
    L.onView($('chScatter'), drawSc);

    L.onView($('chTrans'), () => {
      const t = [...RES.transport].sort((x, y) => x['탄소발자국'] - y['탄소발자국']), col = { 육상수송: C.slate, 해상수송: C.teal, 항공수송: C.ochre };
      plot('chTrans', [
        ...t.map(r => ({ type: 'scatter', mode: 'lines', x: [t[0]['탄소발자국'], r['탄소발자국']], y: [r.이름, r.이름], line: { color: C.rule, width: 3 }, hoverinfo: 'skip', showlegend: false })),
        ...Object.keys(col).map(g => { const a = t.filter(r => r.구분 === g); return { type: 'scatter', mode: 'markers', name: g, y: a.map(r => r.이름), x: a.map(r => r['탄소발자국']), marker: { color: col[g], size: 13 }, hovertemplate: g + ' · %{y}<br>%{x:.3g} kg CO₂ eq / ton·km<extra></extra>' }; })],
        { xaxis: { type: 'log', dtick: 1, title: 'kg CO₂ eq / ton·km (로그 눈금)' }, yaxis: { automargin: true, showgrid: false, categoryorder: 'array', categoryarray: t.map(r => r.이름) }, legend: { orientation: 'h', y: -0.28 }, margin: { l: 110, b: 90 } });
    });
    L.onView($('chWaste'), () => {
      const w = RES.waste_pairs, nm = x => x.폐기물 === '폐금속' ? '폐금속*' : x.폐기물;
      plot('chWaste', [
        ...w.map(x => ({ type: 'scatter', mode: 'lines', x: [x.재활용, x.소각], y: [nm(x), nm(x)], line: { color: C.rule, width: 6 }, hoverinfo: 'skip', showlegend: false })),
        { type: 'scatter', mode: 'markers', name: '재활용', x: w.map(x => x.재활용), y: w.map(nm), marker: { size: 13, color: C.teal }, hovertemplate: '%{y} 재활용<br>%{x:.3g} kg CO₂ eq/kg<extra></extra>' },
        { type: 'scatter', mode: 'markers', name: '소각', x: w.map(x => x.소각), y: w.map(nm), marker: { size: 13, color: C.ochre }, customdata: w.map(x => x.배율), hovertemplate: '%{y} 소각<br>%{x:.3g} kg CO₂ eq/kg (재활용의 %{customdata}배)<extra></extra>' }
      ], { xaxis: { type: 'log', dtick: 1, title: 'kg CO₂ eq / kg (로그 눈금)' }, yaxis: { showgrid: false, automargin: true }, legend: { orientation: 'h', y: -0.3 }, margin: { l: 110, b: 90 },
        annotations: [{ text: '* 재활용 계수는 폐철금속', xref: 'paper', yref: 'paper', x: 1, y: -0.42, showarrow: false, font: { size: 11, color: C.slate }, xanchor: 'right' }] });
    });
  }
  L.tabs.report = { build, built: false };
})();
