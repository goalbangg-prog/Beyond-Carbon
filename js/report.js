/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. */
(function () {
  const { $, esc, IMP, POOL, D, RES, C, NAME, RKEY, J, plot } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];
  const verdict = k => { const c = CAP(k); return c.lo >= 50 ? ['ok', '탄소 순위와 잘 맞음'] : c.hi < 60 ? ['no', '탄소 순위와 어긋남'] : ['mid', '일부만 맞음']; };

  /* ---------- 첫 화면: 33칸 와플 ---------- */
  function waffle() {
    const c = CAP('물'), cells = [];
    for (let i = 0; i < c['다른영향상위']; i++) cells.push(i < c['함께상위'] ? 'got' : 'miss');
    $('waffle').innerHTML = cells.map((t, i) => `<i class="${t}" style="--i:${i}"></i>`).join('');
    requestAnimationFrame(() => setTimeout(() => $('waffle').classList.add('on'), L.reduce ? 0 : 300));
  }

  /* ---------- 스크롤 이야기: 순위 대 순위 그래프 ---------- */
  const SW = 600, SH = 560, m = { l: 54, r: 16, t: 20, b: 50 }, iw = SW - m.l - m.r, ih = SH - m.t - m.b;
  const X = p => m.l + p / 100 * iw, Y = p => m.t + ih - p / 100 * ih;
  let lens = '물', step = 0;
  function story() {
    const grid = [0, 20, 40, 60, 80, 100];
    $('stPlot').innerHTML = `<svg viewBox="0 0 ${SW} ${SH}" role="img" aria-labelledby="stT"><title id="stT">원료별 탄소발자국 순위와 다른 환경영향 순위</title>
      ${grid.map(g => `<line class="g" x1="${X(g)}" x2="${X(g)}" y1="${Y(0)}" y2="${Y(100)}"/><line class="g" x1="${X(0)}" x2="${X(100)}" y1="${Y(g)}" y2="${Y(g)}"/>
        <text class="tk" x="${X(g)}" y="${Y(0) + 18}" text-anchor="middle">${g}</text><text class="tk" x="${X(0) - 9}" y="${Y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
      <rect id="zC" class="zone zc" y="${Y(100)}" height="${ih}"/>
      <rect id="zO" class="zone zo" x="${X(0)}" width="${iw}"/>
      <line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}"/>
      <g id="sdots">${POOL.map(r => `<circle r="5.4" data-id="${r.id}" class="na"/>`).join('')}</g>
      <g id="ann" class="ann"></g>
      <text class="ax" x="${X(50)}" y="${SH - 8}" text-anchor="middle">탄소발자국 순위 → 오른쪽일수록 큼</text>
      <text class="ax" id="stAxY" transform="translate(15,${Y(50)}) rotate(-90)" text-anchor="middle"></text>
    </svg><div class="tip" id="tip" hidden></div>`;
    const dots = [...document.querySelectorAll('#sdots circle')], byId = Object.fromEntries(POOL.map(r => [r.id, r])), tip = $('tip');
    dots.forEach(c => {
      c.addEventListener('mouseenter', () => {
        const r = byId[c.dataset.id], p = L.PP[lens][r.id]; if (!p) return;
        tip.innerHTML = `<b>${esc(r.name)}</b><span>${esc(r.category)}</span><span>탄소발자국 ${L.topLabel(p.c)} · ${NAME[lens]} ${L.topLabel(p.o)}</span>`;
        tip.hidden = false; const b = c.getBoundingClientRect(), h = $('stPlot').getBoundingClientRect();
        tip.style.left = (b.left - h.left + 12) + 'px'; tip.style.top = (b.top - h.top - 8) + 'px';
      });
      c.addEventListener('mouseleave', () => (tip.hidden = true));
    });
    const cardboard = POOL.find(r => r.name === '골판지');

    const draw = () => {
      const pp = L.PP[lens], t = L.top20(lens), cap = CAP(lens);
      const svg = $('stPlot').querySelector('svg'); svg.dataset.step = step;
      $('stAxY').textContent = `${NAME[lens]} 순위 → 위쪽일수록 큼`;
      // 상위 20% 띠의 경계: 상위 20%에 든 원료 중 가장 낮은 순위
      const cx = Math.min(...[...t.tc].map(id => pp[id].c)), oy = Math.min(...[...t.to].map(id => pp[id].o));
      const zC = $('zC'), zO = $('zO');
      zC.setAttribute('x', X(cx - 0.6)); zC.setAttribute('width', X(100) - X(cx - 0.6) + 4);
      zO.setAttribute('y', Y(100) - 4); zO.setAttribute('height', Y(oy - 0.6) - Y(100) + 4);
      const both = new Set(t.both), miss = new Set(t.missed);
      dots.forEach(c => {
        const id = +c.dataset.id, p = pp[id];
        if (!p) { c.setAttribute('class', 'na'); return; }
        const y = step === 0 ? p.c : p.o;
        c.style.transform = `translate(${X(p.c)}px,${Y(y)}px)`;
        c.style.transitionDelay = step <= 1 && !L.reduce ? (p.c / 100 * .5).toFixed(2) + 's' : '0s';
        let cls = 'on';
        if (step === 2) cls = t.tc.has(id) ? 'pick' : 'dim';
        else if (step === 3) cls = t.to.has(id) ? 'top' : t.tc.has(id) ? 'pick' : 'dim';
        else if (step >= 4) cls = both.has(id) ? 'got' : miss.has(id) ? 'miss' : 'dim';
        if (step === 5) cls = id === cardboard.id ? 'focus' : (miss.has(id) ? 'miss faint' : 'dim');
        c.setAttribute('class', cls);
      });
      // 주석
      let ann = '';
      if (step === 5 && pp[cardboard.id]) { const p = pp[cardboard.id], x = X(p.c), y = Y(p.o); ann = `<circle class="ring" cx="${x}" cy="${y}" r="15"/><line x1="${x + 15}" y1="${y + 6}" x2="${x + 70}" y2="${y + 60}"/><text x="${x + 74}" y="${y + 66}">골판지</text><text class="s" x="${x + 74}" y="${y + 84}">탄소 ${L.topLabel(p.c)} · 물 ${L.topLabel(p.o)}</text>`; }
      $('ann').innerHTML = ann;
      // 그래프 위 계기판
      const show = step >= 2;
      $('stMeter').classList.toggle('show', show);
      $('stMeter').innerHTML = `<span class="mt-l">${NAME[lens]} 상위 20%</span><b>${cap['다른영향상위']}종</b>
        <span class="mt-got"><i></i>탄소 상위 20%에도 듦 <b>${cap['함께상위']}</b></span><span class="mt-miss"><i></i>들지 않음 <b>${cap['빠진']}</b></span>`;
      document.querySelectorAll('[data-slens]').forEach(b => b.setAttribute('aria-pressed', b.dataset.slens === lens));
    };
    // 단계 카드가 화면 가운데에 오면 그래프 상태를 바꾼다
    const cards = [...document.querySelectorAll('.step')];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      cards.forEach(c => c.classList.toggle('cur', c === e.target));
      step = +e.target.dataset.step;
      const want = step === 6 ? (lens === '물' ? '산성' : lens) : '물';
      lens = step === 6 ? want : '물'; draw();
    }), { rootMargin: '-45% 0px -45% 0px' });
    cards.forEach(c => io.observe(c));
    document.querySelectorAll('[data-slens]').forEach(b => b.addEventListener('click', () => { lens = b.dataset.slens; step = 6; draw(); }));
    step = 0; draw();
  }

  /* ---------- 영향별 성적표 ---------- */
  function scorecard() {
    const rows = [...LENSES].sort((a, b) => CAP(a)['포착률'] - CAP(b)['포착률']);
    $('score').innerHTML = `<div class="sc-h"><span>영향</span><span>탄소와 함께 움직이는 정도<small>순위상관 ρ와 95% 구간</small></span><span>상위 20% 겹침 비율<small>그 영향 상위 20% 중 탄소도 상위 20%인 비율, 막대 끝 선은 95% 구간</small></span><span>겹치지 않는 계수</span><span>판정</span></div>` +
      rows.map(k => {
        const ci = CI(k), c = CAP(k), [vc, vt] = verdict(k);
        return `<div class="sc-r ${vc}"><b class="sc-n">${NAME[k]}</b>
          <div class="rho"><div class="track"><i class="ci" style="left:${ci.lo * 100}%;width:${(ci.hi - ci.lo) * 100}%"></i><i class="pt" style="left:${ci.rho * 100}%"></i></div><span>${ci.rho.toFixed(2)} <small>(${ci.lo.toFixed(2)}~${ci.hi.toFixed(2)})</small></span></div>
          <div class="capb"><div class="track"><i class="fill" style="--v:${c['포착률']}%"></i><i class="ci" style="left:${c.lo}%;width:${c.hi - c.lo}%"></i><i class="base"></i></div><span><b>${c['포착률']}%</b> <small>(${c.lo}~${c.hi}%)</small></span></div>
          <div class="miss"><b>${c['빠진']}</b><span>/ ${c['다른영향상위']}종</span></div>
          <span class="tag ${vc}">${vt}</span></div>`;
      }).join('') +
      `<p class="sc-why"><b>부영양화는 왜 순위상관이 높은데도 겹침 비율이 낮을까요?</b> 전체 순위로 보면 탄소와 꽤 같이 움직이지만(ρ ${CI('부영').rho.toFixed(2)}), 값이 가장 큰 계수들은 서로 다른 원료입니다. 순위상관은 전체 경향을, 겹침 비율은 맨 위 계수가 같은지를 보여 줍니다.</p>
      <p class="sc-rule">판정 기준: 겹침 비율의 95% 구간이 모두 50% 이상이면 ‘잘 맞음’, 구간 위쪽 끝이 60% 미만이면 ‘어긋남’, 그 사이는 ‘일부만 맞음’. 두 순위가 아무 관계 없어도 20%(세로선)는 겹칩니다. 모두 계수에 대한 판정이며, 제품 결과에 대한 판정이 아닙니다.</p>`;
    L.onView($('score'), () => $('score').classList.add('drawn'));
  }

  /* ---------- 탄소 순위와 어긋나는 계수: 기준 바꾸기 ---------- */
  function hiddenTool() {
    const s = $('thSlider');
    const draw = () => {
      const th = +s.value, hid = L.hidden(th);
      $('thVal').textContent = th; L.count($('thN'), hid.length, 0, 400);
      const by = {}; hid.forEach(h => (by[h.k] = (by[h.k] || 0) + 1));
      const mx = Math.max(1, ...Object.values(by));
      $('thBy').innerHTML = [...LENSES].sort((a, b) => (by[b] || 0) - (by[a] || 0)).map(k => `<div class="mb"><span>${NAME[k]}</span><i style="width:${(by[k] || 0) / mx * 100}%"></i><b>${by[k] || 0}</b></div>`).join('');
      $('thTable').innerHTML = hid.length ? `<table class="tbl"><thead><tr><th>원료</th><th>소재군</th><th>탄소발자국</th><th>순위가 더 높은 영향</th><th>그 영향 순위</th><th class="num">순위 차이</th></tr></thead><tbody>${hid.slice(0, 12).map(h => `<tr><td><b>${esc(h.r.name)}</b></td><td>${esc(h.r.category)}</td><td class="muted">${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td class="hi"><b>${L.topLabel(h.o)}</b></td><td class="num">${Math.round(h.diff)}%p</td></tr>`).join('')}</tbody></table>${hid.length > 12 ? `<p class="hint">순위 차이가 큰 12종만 보여 줍니다. 나머지 ${hid.length - 12}종은 데이터 탐색 탭의 레이더 차트에서 하나씩 확인할 수 있습니다.</p>` : ''}` : '<p class="empty">이 기준을 넘는 계수가 없습니다.</p>';
    };
    s.addEventListener('input', draw); draw();
  }

  function build() {
    const ozoneAll = D.filter(r => r.v[6] != null).length, onlyCarbon = D.filter(r => r.v.filter(v => v != null).length === 1).length;
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n;
    const pairNs = LENSES.map(k => CI(k).n), nMin = Math.min(...pairNs), nMax = Math.max(...pairNs);
    const ozMiss = 100 - Math.round(L.coverage(POOL, 6) * 100);
    const th = RES.hidden_threshold, wcw = RES.within_category_carbon_water, wcr = RES.within_category_carbon_resource, nb = RES.carbon_water_without_basic_chem;
    const ks = RES.k_scores, sens = RES.sensitivity, K = RES.chosen_k, silK = ks.find(x => x.k === K).실루엣;
    const w = CAP('물'), a = CAP('산성'), cb = L.PP['물'][POOL.find(r => r.name === '골판지').id];
    const tcN = L.top20('물').tc.size;
    const funnel = [
      ['전체 평가계수', D.length, ''],
      ['원료 및 에너지 생산 단계', nStage, '수송·폐기·연료 사용 단계는 단위와 제공되는 영향이 달라 따로 봅니다.'],
      ['단위가 kg인 원료', nKg, 'MJ 같은 다른 단위는 1kg 원료와 같은 줄에 세울 수 없습니다.'],
      ['수자원(상수·공업용수) 제외', POOL.length, '재료가 아니라 용수이고, 값이 1,000배 이상 작아 순위를 한쪽으로 끌어당깁니다.'],
      ['영향 쌍마다 두 값이 다 있는 원료', `${nMin}~${nMax}`, '빈 값을 0으로 채우지 않았기 때문에, 비교하는 영향에 따라 대상 수가 달라집니다.']
    ];
    const decisions = [
      ['순위를 매기는 집단', '영향 쌍마다 두 값이 모두 있는 원료끼리 순위를 매겼습니다', '탄소는 187종, 물소모는 163종처럼 값이 있는 원료 수가 다릅니다. 서로 다른 집단에서 매긴 순위를 빼면 비교가 어긋납니다.', '처음에는 집단이 달랐고, 이때는 어긋나는 계수를 25종으로 적게 셌습니다. 같은 집단으로 고치니 34종이 됐습니다.'],
      ['오존층영향', '분석에서 뺐습니다', `전체 ${D.length}건 중 값이 있는 항목이 ${ozoneAll}건이고, 원료 풀에서는 ${ozMiss}%가 비어 있습니다.`, '넣으면 비교 대상이 십여 종으로 줄어 우연한 결과가 나올 수 있습니다.'],
      ['빈 값', '0으로 채우지 않았습니다', '‘측정하지 않음’과 ‘영향이 0’은 다릅니다.', '0으로 채우면 비어 있는 영향이 실제보다 낮아 보이고 상관계수가 틀어집니다.'],
      ['단위가 다른 항목', 'kg 기준 원료끼리만 비교했습니다', `kg, MJ, ton·km는 뜻이 달라 한 순위에 세울 수 없습니다. 원료 단계 ${nStage}건 중 ${POOL.length}건이 대상입니다.`, '억지로 환산하면 근거 없는 비교가 됩니다.'],
      ['수자원', '분석에서 뺐습니다', '재료가 아니라 용수이고, 값이 1,000배 이상 작습니다.', '넣으면 ‘가장 낮은 원료’ 자리를 용수가 차지해 순위가 왜곡됩니다.'],
      ['요약 방법', '평균 대신 순위와 중앙값을 썼습니다', '계수가 수십만 배까지 차이 나서, 평균과 일반 상관계수는 큰 값 몇 개에 끌려갑니다.', '평균을 쓰면 극단값 몇 개가 결론을 정합니다.'],
      ['숫자의 믿을 만함', '상관계수와 겹침 비율 모두에 95% 구간을 붙였습니다', `원료를 다시 뽑아 2,000번 계산했습니다. 물소모의 겹침 비율은 ${w['포착률']}%지만 구간은 ${w.lo}~${w.hi}%로 넓습니다.`, '숫자 하나만 쓰면 “절반 이상”처럼 데이터보다 강한 문장을 쓰게 됩니다.'],
      ['소재군 섞임', '소재군별로, 그리고 가장 큰 소재군을 빼고 다시 확인했습니다', `기초화학물질을 빼도 탄소–물소모는 ${nb.rho.toFixed(2)}(${nb.n}종)로 같았습니다.`, '소재군이 섞여서 생긴 착시였다면 결론이 뒤집혔을 것입니다.'],
      ['‘어긋나는 계수’ 기준', '순위 차이 40%p로 정하고, 기준을 바꾼 결과도 공개했습니다', `30%p면 ${th['30']}종, 50%p면 ${th['50']}종, 60%p면 ${th['60']}종입니다. 어느 기준에서도 물소모가 가장 많습니다.`, '기준 하나만 보여 주면 숫자를 고른 것처럼 보일 수 있습니다.'],
      ['겹침 비교 기준', '각 영향의 상위 20% 계수끼리 겹치는지 봤습니다', '값이 큰 계수가 같은 원료인지 확인하려는 것이고, 관계가 없을 때의 기준값(20%)과 바로 비교할 수 있습니다.', '범위를 넓히면 겹침 비율이 올라가지만 ‘값이 큰 계수’라는 의미가 흐려집니다.'],
      ['수송·폐기 계수', '원료 분석에 섞지 않고, 재활용과 소각도 서로 비교하지 않았습니다', '단위(ton·km, kg)와 단계가 다르고, 재활용·소각 계수에 회피 부하나 에너지 회수가 반영됐는지 원자료에 나와 있지 않아 같은 기준으로 만든 값인지 알 수 없습니다.', '비교하면 ‘재활용이 몇 배 좋다’는 근거 없는 결론이 됩니다.'],
      ['주장의 범위', '제품이 아니라 계수에 대한 결론으로 한정했습니다', '제품의 환경영향은 원료마다 ‘투입량 × 계수’를 더한 값입니다. 계수끼리의 관계가 제품끼리의 관계와 같다는 보장이 없습니다.', '처음에는 “탄소로 원료를 고르면 놓친다”처럼 계수 결과를 제품 선택의 결과로 넓혀 썼습니다. 근거보다 큰 주장이라 고쳤습니다.'],
      ['군집 분석', '결론에 쓰지 않았습니다', `K-means로 묶어 봤지만 실루엣 점수가 ${silK.toFixed(2)}로 낮고(0.5 이상이면 뚜렷), 묶는 기준을 바꾸면 일치도가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${sens['6개(+스모그)'].ARI.toFixed(2)}로 떨어집니다.`, '등급처럼 보여 주면 근거보다 큰 확신을 줍니다.']
    ];
    const chapters = [['c1', '한눈에 보기'], ['c2', '이 결과가 말하지 않는 것'], ['c3', '영향별 성적표'], ['c4', '우연은 아닐까'], ['c5', '어긋나는 계수 목록'], ['c6', '분석에 쓴 데이터'], ['c7', '판단 기록'], ['c8', '한계와 다음 단계']];
    const steps = [
      ['탄소발자국이 모든 걸 말해 준다면', `원료 ${POOL.length}종을 탄소발자국 순위로 줄 세웠습니다. 다른 환경영향도 똑같은 순서라면, 점은 모두 대각선 위에 있어야 합니다.`],
      ['실제로는 넓게 흩어집니다', `세로축을 물소모 순위로 바꾸면 점이 흩어집니다. 두 순위가 함께 움직이는 정도(ρ)는 <mark>${CI('물').rho.toFixed(2)}</mark>입니다. 1이면 완전히 같은 순서, 0이면 관계가 없다는 뜻입니다.`],
      ['탄소 계수가 큰 원료', `탄소발자국 계수가 상위 20%인 원료는 <mark>${tcN}종</mark>입니다(오른쪽 세로 띠). 1kg당 값이 큰 쪽입니다.`],
      ['물 계수가 큰 원료', `물소모 계수가 상위 20%인 원료는 <mark>${w['다른영향상위']}종</mark>입니다(위쪽 가로 띠). 탄소 순위가 물 순위를 대신할 수 있다면, 두 띠는 대부분 겹쳐야 합니다.`],
      [`두 띠가 겹치는 곳은 ${w['함께상위']}종뿐입니다`, `물 계수 상위 ${w['다른영향상위']}종 중 탄소 계수도 상위 20%인 원료는 <mark>${w['함께상위']}종</mark>입니다. 나머지 <mark>${w['빠진']}종</mark>은 탄소 계수로는 상위에 들지 않습니다.<small>원료를 다시 뽑아 2,000번 계산하면 겹침 비율은 ${w.lo}~${w.hi}% 사이입니다. 두 순위가 아무 관계 없어도 20%는 겹칩니다.</small>`],
      ['예를 들면 골판지', `골판지는 1kg당 탄소발자국 계수가 <mark>${L.topLabel(cb.c)}</mark>인데, 물소모 계수는 <mark>${L.topLabel(cb.o)}</mark>입니다. 탄소 계수만 보면 이 차이가 보이지 않습니다. 다만 어떤 제품에서 골판지의 물 영향이 실제로 클지는 얼마나 쓰느냐에 달려 있습니다.`],
      ['산성화는 다릅니다', `산성화로 바꾸면 점이 대각선 가까이 모입니다. 산성화 계수 상위 ${a['다른영향상위']}종 중 <mark>${a['함께상위']}종</mark>이 탄소 계수도 상위 20%입니다. 아래 버튼으로 다른 영향도 바꿔 보세요.<span class="slens">${LENSES.map(k => `<button type="button" data-slens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('')}</span>`]
    ];

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <div class="hero-copy">
          <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}건 분석</p>
          <h1>원료 계수로 보면, 탄소발자국 순위는 물소모·부영양화 순위를 잘 대신하지 못합니다</h1>
          <p class="lead">원료 ${POOL.length}종의 1kg당 환경영향 계수를 영향별로 줄 세워 비교했습니다. 탄소 순위는 산성화·자원발자국 순위와는 잘 맞았지만, 물소모와 부영양화 순위와는 어긋났습니다.</p>
          <p class="scope">제품의 환경영향이 아니라 원료 계수 데이터에 대한 분석입니다. 제품의 결과는 원료를 얼마나 쓰느냐에 따라 달라집니다.</p>
        </div>
        <figure class="hero-fig">
          <figcaption>물소모 계수 상위 20%인 원료 ${w['다른영향상위']}종</figcaption>
          <div class="waffle" id="waffle" aria-label="${w['다른영향상위']}종 중 ${w['함께상위']}종은 탄소 계수도 상위 20%이고 ${w['빠진']}종은 아님"></div>
          <div class="wf-key"><span><i class="got"></i>탄소 계수도 상위 20% <b>${w['함께상위']}</b></span><span><i class="miss"></i>탄소 계수는 상위 20%가 아님 <b>${w['빠진']}</b></span></div>
        </figure>
      </div>
      <ol class="sum">
        <li><b>함께 가는 영향</b><span>산성화(ρ ${CI('산성').rho.toFixed(2)})와 자원발자국(${CI('자원').rho.toFixed(2)})은 탄소발자국과 순위가 거의 같이 움직입니다.</span></li>
        <li><b>어긋나는 영향</b><span>물소모(ρ ${CI('물').rho.toFixed(2)})는 탄소 순위와 거의 관계가 없고, 부영양화는 상위 계수의 ${CAP('부영')['포착률']}%만 겹칩니다.</span></li>
        <li><b>그래서 말할 수 있는 것</b><span>이 계수 데이터로는 탄소 순위만 보고 물·부영양화 순위를 짐작할 수 없습니다. 제품 단위에서도 그런지는 투입량을 반영해 따로 확인해야 합니다.</span></li>
      </ol>
      <a class="cue" href="#c1" data-go="c1">어떻게 확인했는지 보기</a>
    </section>

    <div class="doc">
      <nav class="rail" aria-label="리포트 순서"><ol>${chapters.map(([id, t], i) => `<li><a href="#${id}" data-go="${id}"><span>${i + 1}</span>${t}</a></li>`).join('')}</ol></nav>
      <div class="chapters">

      <section class="ch" id="c1"><header><span class="chno">1</span><h2>한눈에 보기: 점 187개로 따라가기</h2></header>
        <p class="lead">점 하나가 원료 하나입니다. 스크롤을 내리면 그래프가 한 단계씩 바뀝니다.</p>
        <div class="story">
          <div class="st-fig"><div class="st-sticky"><figure class="plotcard" id="stPlot"></figure><div class="meter" id="stMeter"></div></div></div>
          <div class="st-steps">${steps.map(([h, t], i) => `<article class="step" data-step="${i}"><span class="sn">${i + 1} / ${steps.length}</span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
        </div>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>이 결과가 말하지 않는 것</h2></header>
        <p class="lead">계수끼리 어긋난다고 해서, 제품끼리도 어긋난다고 말할 수는 없습니다. 제품의 환경영향은 이렇게 계산되기 때문입니다.</p>
        <div class="formula" aria-label="제품의 영향은 원료마다 투입량 곱하기 계수를 모두 더한 값">
          <span class="f-l">제품의 물 영향</span><span class="f-eq">=</span>
          <span class="f-t"><b>원료 A 투입량</b><i>×</i><b class="k">A의 물 계수</b></span><span class="f-p">+</span>
          <span class="f-t"><b>원료 B 투입량</b><i>×</i><b class="k">B의 물 계수</b></span><span class="f-p">+ …</span>
          <p class="f-note">이 분석이 다룬 것은 <b class="k">계수</b>뿐입니다. 투입량은 제품마다 다르고, 이 데이터에 없습니다.</p>
        </div>
        <div class="limits">
          <div><h3>양이 결과를 바꿉니다</h3><p>물 계수가 높은 원료도 제품에 조금만 들어가면 제품의 물 영향에는 거의 기여하지 않습니다. 계수 순위가 곧 제품에서의 중요도는 아닙니다.</p></div>
          <div><h3>제품 단위의 관계는 다를 수 있습니다</h3><p>많은 제품이 전기와 연료를 함께 씁니다. 이런 공통 투입 때문에 제품 단위에서는 탄소와 다른 영향이 계수보다 더 같이 움직일 수도, 덜 움직일 수도 있습니다. 계수만으로는 어느 쪽인지 알 수 없습니다.</p></div>
          <div><h3>상충관계는 확인되지 않았습니다</h3><p>‘탄소는 줄었는데 물은 늘었다’는 상충관계는 기능이 같은 두 제품을 비교해야 확인할 수 있습니다. 계수 분포는 그런 일이 생길 수 있는 조건을 보여 줄 뿐입니다.</p></div>
        </div>
        <p class="note">그래서 이 리포트의 결론은 <b>계수 데이터에 대한 것</b>입니다. 탄소만 산정하고 다른 영향을 생략해도 되는지 판단할 근거가 계수 수준에서는 없다는 것, 그래서 제품 단위에서 따로 확인해야 한다는 것까지가 말할 수 있는 범위입니다.</p>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>영향별 성적표: 탄소 순위와 잘 맞는 영향, 어긋나는 영향</h2></header>
        <p class="lead">다섯 가지 영향마다 같은 두 질문을 던졌습니다. 탄소 계수와 순위가 같이 움직이는가, 값이 가장 큰 계수(상위 20%)가 같은 원료인가.</p>
        <div class="score" id="score"></div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>우연이나 착시는 아닐까</h2></header>
        <p class="lead">결론을 뒤집을 수 있는 반론 네 가지를 직접 확인했습니다.</p>
        <div class="checks">
          <div class="ck"><h3>원료를 다시 뽑아도 같을까</h3><p>2,000번 다시 계산해도 탄소–물소모 순위상관은 <b>${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}</b> 사이였습니다. 높게 잡아도 ‘약한 관계’입니다.</p><span class="res">유지</span></div>
          <div class="ck"><h3>소재군이 섞여서 생긴 착시일까</h3><p>소재군마다 따로 계산해도, <b>6개 소재군 모두</b> 탄소–물소모가 탄소–자원보다 낮았습니다.</p>
            <table class="mini"><thead><tr><th>소재군</th><th class="num">탄소–자원</th><th class="num">탄소–물</th></tr></thead><tbody>${Object.keys(wcw).sort((x, y) => wcw[y].n - wcw[x].n).map(c => `<tr><td>${esc(c)} <small>${wcw[c].n}종</small></td><td class="num">${wcr[c] ? wcr[c].rho.toFixed(2) : '-'}</td><td class="num"><b>${wcw[c].rho.toFixed(2)}</b></td></tr>`).join('')}</tbody></table><span class="res">유지</span></div>
          <div class="ck"><h3>가장 큰 소재군 때문은 아닐까</h3><p>원료 풀의 42%가 기초화학물질입니다. 이 소재군을 모두 빼고 계산해도 탄소–물소모는 <b>${nb.rho.toFixed(2)}</b>(${nb.n}종)로 같았습니다.</p><span class="res">유지</span></div>
          <div class="ck"><h3>기준을 바꾸면 달라질까</h3><p>‘어긋나는 계수’ 기준을 20~70%p로 바꿔도, <b>모든 기준에서 물소모가 가장 많이</b> 어긋났습니다. 다음 장에서 직접 움직여 볼 수 있습니다.</p><span class="res">유지</span></div>
        </div>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>탄소 순위와 어긋나는 계수 목록</h2></header>
        <p class="lead">탄소발자국 계수 순위보다 다른 영향 계수 순위가 훨씬 높은 원료입니다. 두 값이 모두 있는 원료끼리 순위를 매겨 비교했습니다.</p>
        <div class="tool">
          <div class="tool-ctl">
            <label for="thSlider">다른 영향 계수 순위가 탄소 계수 순위보다 <b id="thVal">40</b>%p 이상 높은 원료</label>
            <input type="range" id="thSlider" min="20" max="70" step="5" value="40">
            <div class="ticks"><span>20%p</span><span>40%p (기본)</span><span>70%p</span></div>
            <div class="big"><b id="thN">0</b><span>종 / ${POOL.length}종</span></div>
            <div class="mbars" id="thBy"></div>
          </div>
          <div class="tool-out" id="thTable"></div>
        </div>
        <p class="note">순위는 원료 1kg끼리의 상대 위치이고, 소재의 우열을 가르는 값이 아닙니다. 이 원료가 들어간 제품에서 실제로 영향이 클지는 투입량에 달려 있습니다. 다범주로 평가할 때 탄소 외의 영향을 함께 확인해 볼 후보로 읽어 주세요.</p>
      </section>

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>분석에 쓴 데이터</h2></header>
        <p class="lead">공공데이터포털에 공개된 원자료를 그대로 내려받아 다시 정리했습니다. 이용허락범위는 ‘제한 없음’입니다.</p>
        <div class="two">
          <table class="src"><tbody>
            <tr><th>데이터</th><td>한국환경산업기술원_환경성적표지 평가계수</td></tr>
            <tr><th>기준일</th><td>2021-08-02 (배포 파일 기준)</td></tr>
            <tr><th>규모</th><td>${D.length}건 · 환경영향 7종 · CSV</td></tr>
            <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(2026-10-19 확인)</span></td></tr>
            <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">data.go.kr/data/15120968</a></td></tr>
          </tbody></table>
          <div class="explain"><h3>평가계수란</h3>
            <p>원료 1kg, 연료 1MJ, 화물 1톤을 1km 옮기기처럼 <b>정해진 단위만큼 썼을 때 생기는 환경영향을 7가지로 미리 계산해 둔 값</b>입니다. 환경성적표지를 산정할 때 원료·에너지·수송·폐기 단계의 배경 데이터로 쓰입니다.</p>
            <p>제품 하나의 전과정평가 결과가 아닙니다. 계수마다 어떤 목록 데이터와 환산 방법을 썼는지는 이 파일에 없어, <a href="https://www.data.go.kr/data/15089170/fileData.do" target="_blank" rel="noopener">환경성적표지 작성지침</a>으로 확인해야 합니다.</p></div>
        </div>
        <div class="two wide-l" style="margin-top:28px">
          <figure class="fig"><figcaption>단계별·영향별 빈 값 비율</figcaption><div id="chCover" class="chart h340"></div>
            <p class="read">${onlyCarbon}건은 탄소발자국만 있습니다. 대부분 연료원별 사용(${RES.coverage_by_stage['연료원별 사용']['항목수']}건)과 화학반응공정(${RES.coverage_by_stage['화학반응공정']['항목수']}건)입니다. 오존층영향은 원료 풀의 ${ozMiss}%가 비어 있어 뺐습니다.</p></figure>
          <figure class="fig"><figcaption>분석 대상을 이렇게 걸렀습니다</figcaption>
            <ol class="funnel" id="funnel">${funnel.map(([n, v, note]) => { const num = typeof v === 'number' ? v : +String(v).split('~')[1]; return `<li><div class="fn-h"><span>${n}</span><b>${v}</b></div><div class="fn-bar"><i style="--w:${(num / D.length * 100).toFixed(1)}%"></i></div>${note ? `<p>${note}</p>` : ''}</li>`; }).join('')}</ol></figure>
        </div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>분석하면서 내린 판단</h2></header>
        <p class="lead">정답이 없는 선택을 여러 번 했습니다. 줄을 누르면 이유와 다르게 했을 때의 결과가 보입니다.</p>
        <div class="dec">${decisions.map((d, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>

      <section class="ch" id="c8"><header><span class="chno">8</span><h2>한계와 다음 단계</h2></header>
        <div class="yesno">
          <div class="yes"><h3>이 데이터로 말할 수 있는 것</h3><ul>
            <li>같은 단위(1kg)의 원료 계수끼리 어느 쪽이 큰지</li>
            <li>계수 수준에서 탄소 순위가 다른 영향 순위와 얼마나 맞는지, 어디서 어긋나는지</li>
            <li>어떤 영향과 소재군에서 빈 값이 많아 산정이 어려운지</li></ul></div>
          <div class="no"><h3>말할 수 없는 것</h3><ul>
            <li>제품 하나의 전과정평가 결과: 기능단위, 시스템 경계, 기준흐름이 없습니다.</li>
            <li>기능이 다른 소재 중 어느 쪽이 더 친환경인지</li>
            <li>제품 사이에 상충관계가 실제로 생기는지: 기능이 같은 제품끼리 비교해야 합니다.</li>
            <li>재활용과 소각 중 어느 쪽이 나은지: 회피 부하나 에너지 회수 반영 여부를 알 수 없습니다.</li>
            <li>계수가 얼마나 정확한지: 오차 범위 정보가 없습니다.</li>
            <li>지금 시점의 값: 2021년 기준이라 현재 공정이나 전력 구성과 다를 수 있습니다.</li></ul></div>
        </div>
        <div class="next"><h3>다음 단계</h3><p>이 분석의 진짜 질문은 ‘제품 단위에서도 탄소가 다른 영향을 대신하지 못하는가’입니다. 여기에 답하려면 투입량이 반영된 제품 단위 결과가 필요합니다. 다음 단계는 두 가지입니다. 하나는 환경성적표지 인증 제품의 영향범주별 결과가 공개돼 있는지 확인해 같은 분석을 제품 단위로 해 보는 것, 다른 하나는 작성지침을 따라 제품 하나를 정하고 기능단위·시스템 경계·기준흐름을 정한 뒤 실제 전과정 목록 데이터셋으로 분석하는 것입니다.</p></div>
      </section>
      </div>
    </div>`;

    waffle(); story(); scorecard(); hiddenTool();

    const links = [...document.querySelectorAll('.rail a')];
    document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); $(a.dataset.go).scrollIntoView({ behavior: L.reduce ? 'auto' : 'smooth', block: 'start' }); }));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.dataset.go === e.target.id)); }), { rootMargin: '-30% 0px -65% 0px' });
    chapters.forEach(([id]) => io.observe($(id)));
    // 리포트를 읽기 시작하면 순서 표시를 보여 준다
    const rail = document.querySelector('.rail');
    new IntersectionObserver(es => es.forEach(e => rail.classList.toggle('show', e.isIntersecting || e.boundingClientRect.top < 0)), { rootMargin: '0px 0px -60% 0px' }).observe(document.querySelector('.chapters'));
    L.onView($('funnel'), () => $('funnel').classList.add('drawn'));

    // ---- 차트 (화면에 들어올 때 그린다) ----
    const stages = L.STAGES.filter(s => RES.coverage_by_stage[s]), cv = (s, k) => RES.coverage_by_stage[s][RKEY[k]];
    const order7 = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'];
    L.onView($('chCover'), () => plot('chCover', [{ type: 'heatmap', x: order7.map(k => NAME[k]), y: stages.map(s => `${s} (${RES.coverage_by_stage[s]['항목수']})`), z: stages.map(s => order7.map(k => 100 - cv(s, k))), text: stages.map(s => order7.map(k => Math.round(100 - cv(s, k)) + '%')), texttemplate: '%{text}', zmin: 0, zmax: 100, colorscale: [[0, '#EEF4EC'], [.5, '#9CC27E'], [1, C.forest]], showscale: false, xgap: 3, ygap: 3, hovertemplate: '%{y}<br>%{x}: 빈 값 %{text}<extra></extra>' }],
      { margin: { l: 170, r: 6, t: 6, b: 56 }, xaxis: { tickangle: -20, showgrid: false }, yaxis: { autorange: 'reversed', showgrid: false } }));
  }
  L.tabs.report = { build, built: false };
})();
