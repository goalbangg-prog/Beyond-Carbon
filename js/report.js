/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. */
(function () {
  const { $, esc, IMP, POOL, D, RES, NAME, RKEY } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];
  const verdict = k => { const c = CAP(k); return c.lo >= 50 ? ['ok', '잘 맞음'] : c.hi < 60 ? ['no', '어긋남'] : ['mid', '일부만 맞음']; };

  /* ---------- 첫 화면: 33칸 그림 ---------- */
  function waffle() {
    const c = CAP('물'), cells = [];
    for (let i = 0; i < c['다른영향상위']; i++) cells.push(i < c['함께상위'] ? 'got' : 'miss');
    $('waffle').innerHTML = cells.map((t, i) => `<i class="${t}" style="--i:${i}"></i>`).join('');
    requestAnimationFrame(() => setTimeout(() => $('waffle').classList.add('on'), L.reduce ? 0 : 300));
  }

  /* ---------- 순위 대 순위 그래프 (스크롤에 따라 단계별로 바뀜) ---------- */
  const SW = 600, SH = 560, m = { l: 54, r: 16, t: 20, b: 50 }, iw = SW - m.l - m.r, ih = SH - m.t - m.b;
  const X = p => m.l + p / 100 * iw, Y = p => m.t + ih - p / 100 * ih;
  let lens = '물', step = 0;
  function story() {
    const grid = [0, 20, 40, 60, 80, 100];
    $('stPlot').innerHTML = `<svg viewBox="0 0 ${SW} ${SH}" role="img" aria-labelledby="stT"><title id="stT">원료별 탄소발자국 순위와 다른 영향 계수 순위</title>
      ${grid.map(g => `<line class="g" x1="${X(g)}" x2="${X(g)}" y1="${Y(0)}" y2="${Y(100)}"/><line class="g" x1="${X(0)}" x2="${X(100)}" y1="${Y(g)}" y2="${Y(g)}"/>
        <text class="tk" x="${X(g)}" y="${Y(0) + 18}" text-anchor="middle">${g}</text><text class="tk" x="${X(0) - 9}" y="${Y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
      <rect id="zC" class="zone zc" y="${Y(100)}" height="${ih}"/>
      <rect id="zO" class="zone zo" x="${X(0)}" width="${iw}"/>
      <line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}"/>
      <g id="sdots">${POOL.map(r => `<circle r="5.4" data-id="${r.id}" class="na"/>`).join('')}</g>
      <g id="ann" class="ann"></g>
      <text class="ax" x="${X(50)}" y="${SH - 8}" text-anchor="middle">탄소발자국 순위 (백분위, 오른쪽이 큼)</text>
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
      $('stAxY').textContent = step === 0 ? '다른 영향 순위' : `${NAME[lens]} 순위 (백분위, 위쪽이 큼)`;
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
      let ann = '';
      if (step === 5 && pp[cardboard.id]) { const p = pp[cardboard.id], x = X(p.c), y = Y(p.o); ann = `<circle class="ring" cx="${x}" cy="${y}" r="15"/><line x1="${x + 15}" y1="${y + 6}" x2="${x + 70}" y2="${y + 60}"/><text x="${x + 74}" y="${y + 66}">골판지</text><text class="s" x="${x + 74}" y="${y + 84}">탄소발자국 ${L.topLabel(p.c)} · 물소모계수 ${L.topLabel(p.o)}</text>`; }
      $('ann').innerHTML = ann;
      $('stMeter').classList.toggle('show', step >= 3);
      $('stMeter').innerHTML = `<span class="mt-l">${NAME[lens]} 상위 20%</span><b>${cap['다른영향상위']}종</b>
        <span class="mt-got"><i></i>탄소발자국도 상위 20% <b>${cap['함께상위']}</b></span><span class="mt-miss"><i></i>탄소발자국은 아님 <b>${cap['빠진']}</b></span>`;
      document.querySelectorAll('[data-slens]').forEach(b => b.setAttribute('aria-pressed', b.dataset.slens === lens));
    };
    const cards = [...document.querySelectorAll('.step')];
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      cards.forEach(c => c.classList.toggle('cur', c === e.target));
      step = +e.target.dataset.step;
      lens = step === 6 ? (lens === '물' ? '산성' : lens) : '물'; draw();
    }), { rootMargin: '-45% 0px -45% 0px' });
    cards.forEach(c => io.observe(c));
    document.querySelectorAll('[data-slens]').forEach(b => b.addEventListener('click', () => { lens = b.dataset.slens; step = 6; draw(); }));
    step = 0; draw();
  }

  /* ---------- 영향별 비교표 ---------- */
  function scorecard() {
    const rows = [...LENSES].sort((a, b) => CAP(a)['포착률'] - CAP(b)['포착률']);
    $('score').innerHTML = `<div class="sc-h"><span>영향</span><span>순위상관 ρ<small>점은 추정값, 띠는 95% 구간</small></span><span>상위 20% 겹침 비율<small>막대 끝 선은 95% 구간, 세로선은 무관할 때(20%)</small></span><span>겹치지 않는 원료</span><span>판정</span></div>` +
      rows.map(k => {
        const ci = CI(k), c = CAP(k), [vc, vt] = verdict(k);
        return `<div class="sc-r ${vc}"><b class="sc-n">${NAME[k]}</b>
          <div class="rho"><div class="track"><i class="ci" style="left:${ci.lo * 100}%;width:${(ci.hi - ci.lo) * 100}%"></i><i class="pt" style="left:${ci.rho * 100}%"></i></div><span>${ci.rho.toFixed(2)} <small>(${ci.lo.toFixed(2)}~${ci.hi.toFixed(2)})</small></span></div>
          <div class="capb"><div class="track"><i class="fill" style="--v:${c['포착률']}%"></i><i class="ci" style="left:${c.lo}%;width:${c.hi - c.lo}%"></i><i class="base"></i></div><span><b>${c['포착률']}%</b> <small>(${c.lo}~${c.hi}%)</small></span></div>
          <div class="miss"><b>${c['빠진']}</b><span>/ ${c['다른영향상위']}종</span></div>
          <span class="tag ${vc}">${vt}</span></div>`;
      }).join('');
    L.onView($('score'), () => $('score').classList.add('drawn'));
  }

  /* ---------- 탄소발자국 순위와 어긋나는 원료: 기준 바꾸기 ---------- */
  function mismatchTool() {
    const s = $('thSlider'); let all = false;
    const draw = () => {
      const th = +s.value, hid = L.hidden(th);
      $('thVal').textContent = th; L.count($('thN'), hid.length, 0, 400);
      s.style.setProperty('--p', ((th - 20) / 50 * 100) + '%');
      document.querySelectorAll('[data-th]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.th === th));
      const by = {}; hid.forEach(h => (by[h.k] = (by[h.k] || 0) + 1));
      const mx = Math.max(1, ...Object.values(by));
      $('thBy').innerHTML = [...LENSES].sort((a, b) => (by[b] || 0) - (by[a] || 0)).map(k => `<div class="mb"><span>${NAME[k]}</span><i style="width:${(by[k] || 0) / mx * 100}%"></i><b>${by[k] || 0}</b></div>`).join('');
      const shown = all ? hid : hid.slice(0, 10);
      $('thTable').innerHTML = hid.length ? `<table class="tbl"><thead><tr><th>원료</th><th>소재군</th><th>탄소발자국</th><th>순위가 더 높은 영향</th><th>그 영향 계수</th><th class="num">순위 차이</th></tr></thead><tbody>${shown.map(h => `<tr><td><b>${esc(h.r.name)}</b></td><td>${esc(h.r.category)}</td><td class="muted">${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td class="hi"><b>${L.topLabel(h.o)}</b></td><td class="num">${Math.round(h.diff)}%p</td></tr>`).join('')}</tbody></table>${hid.length > 10 ? `<button type="button" class="more" id="thMore">${all ? '순위 차이가 큰 10종만 보기' : `${hid.length}종 모두 보기`}</button>` : ''}` : '<p class="empty">이 기준을 넘는 원료가 없다.</p>';
      const more = $('thMore'); if (more) more.onclick = () => { all = !all; draw(); };
    };
    s.addEventListener('input', draw);
    document.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { s.value = b.dataset.th; draw(); }));
    draw();
  }

  function build() {
    const ozoneAll = D.filter(r => r.v[6] != null).length;
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n;
    const pairNs = LENSES.map(k => CI(k).n), nMin = Math.min(...pairNs), nMax = Math.max(...pairNs);
    const ozMiss = 100 - Math.round(L.coverage(POOL, 6) * 100);
    const th = RES.hidden_threshold, wcw = RES.within_category_carbon_water, wcr = RES.within_category_carbon_resource, nb = RES.carbon_water_without_basic_chem;
    const ks = RES.k_scores, sens = RES.sensitivity, K = RES.chosen_k, silK = ks.find(x => x.k === K).실루엣;
    const w = CAP('물'), a = CAP('산성'), e = CAP('부영'), cb = L.PP['물'][POOL.find(r => r.name === '골판지').id];
    const tcN = L.top20('물').tc.size, nHid = L.hidden(40).length;
    const basicShare = Math.round(POOL.filter(r => r.category === '기초화학물질').length / POOL.length * 100);
    const missPool = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'].map(k => ({ k, v: 100 - Math.round(L.coverage(POOL, L.J(k)) * 100) }));
    const funnel = [
      ['전체 평가계수', D.length, ''],
      ['원료 및 에너지 생산 단계', nStage, '수송·폐기·연료 사용은 단위와 제공 영향이 달라 제외'],
      ['단위가 kg인 원료', nKg, 'MJ 등 다른 단위 제외'],
      ['수자원(상수·공업용수) 제외', POOL.length, '재료가 아닌 용수이고 값이 1,000배 이상 작음'],
      ['영향 쌍마다 두 값이 모두 있는 원료', `${nMin}~${nMax}`, '빈 값을 채우지 않아 비교 쌍마다 대상 수가 다름']
    ];
    const decisions = [
      ['주장의 범위', '제품이 아니라 계수에 대한 결론으로 한정', '제품의 영향은 원료별 투입량 × 계수의 합이다. 계수 사이의 관계가 제품 사이의 관계와 같다는 보장이 없다.', '초기 버전은 “탄소로 원료를 고르면 놓친다”처럼 계수 결과를 제품 선택의 문제로 넓혀 썼다.'],
      ['순위를 매기는 집단', '영향 쌍마다 두 값이 모두 있는 원료끼리 순위를 매김', '값이 있는 원료 수가 영향마다 다르다(탄소발자국 187종, 물소모계수 163종). 다른 집단에서 매긴 순위끼리 빼면 비교가 어긋난다.', '초기 버전은 집단이 달라 어긋나는 원료를 25종으로 적게 셌다. 수정 후 34종.'],
      ['빈 값', '0으로 채우지 않음', '‘해당없음’은 측정하지 않았다는 뜻이지 영향이 0이라는 뜻이 아니다.', '0으로 채우면 비어 있는 영향이 낮게 잡히고 상관계수가 왜곡된다.'],
      ['오존층영향', '분석에서 제외', `전체 ${D.length}건 중 값이 있는 항목은 ${ozoneAll}건, 원료 풀에서는 ${ozMiss}%가 비어 있다.`, '비교 대상이 십여 종으로 줄어 우연한 결과가 나올 수 있다.'],
      ['단위와 단계', 'kg 기준 원료끼리만 비교', `kg, MJ, ton·km는 뜻이 달라 한 순위에 세울 수 없다. 수송·폐기 계수도 같은 이유로 제외했다. 재활용·소각 계수는 회피 부하나 에너지 회수 반영 여부를 알 수 없어 서로 비교하지 않았다.`, '억지로 환산하거나 비교하면 근거 없는 결론이 된다.'],
      ['수자원', '분석에서 제외', '재료가 아닌 용수이고 값이 1,000배 이상 작다.', '가장 낮은 순위를 용수가 차지해 순위가 왜곡된다.'],
      ['요약 방법', '평균 대신 순위와 중앙값', '계수가 수십만 배까지 차이 나 평균과 피어슨 상관은 큰 값 몇 개에 끌려간다.', '극단값 몇 개가 결론을 정한다.'],
      ['숫자의 신뢰 범위', '상관계수와 겹침 비율에 95% 구간 표시', `원료를 다시 뽑아 2,000번 계산했다. 물소모계수 겹침 비율은 ${w['포착률']}%지만 구간은 ${w.lo}~${w.hi}%로 넓다.`, '추정값 하나만 쓰면 “절반 이상”처럼 데이터보다 강한 문장이 나온다.'],
      ['겹침 비교 기준', '각 영향의 상위 20%끼리 비교', '값이 큰 계수가 같은 원료인지 보려는 기준이다. 두 순위가 무관할 때의 기대값(20%)과 바로 비교된다.', '범위를 넓히면 겹침 비율이 오르지만 ‘값이 큰 계수’의 의미가 흐려진다.'],
      ['어긋남 기준', '순위 차이 40%p, 다른 기준의 결과도 공개', `30%p면 ${th['30']}종, 50%p면 ${th['50']}종, 60%p면 ${th['60']}종이다. 모든 기준에서 물소모계수가 가장 많다.`, '기준 하나만 제시하면 숫자를 고른 것처럼 보인다.'],
      ['소재군 섞임', '소재군별로, 최대 소재군을 빼고 재계산', `기초화학물질을 빼도 탄소발자국–물소모계수 ρ는 ${nb.rho.toFixed(2)}(${nb.n}종)로 같았다.`, '소재군이 섞여 생긴 착시였다면 결론이 뒤집혔을 것이다.'],
      ['군집 분석', '결론에 쓰지 않음', `K-means 실루엣 점수가 ${silK.toFixed(2)}로 낮고(0.5 이상이면 뚜렷), 묶는 기준을 바꾸면 일치도(ARI)가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${sens['6개(+스모그)'].ARI.toFixed(2)}로 떨어진다.`, '경계가 흐린 결과를 등급처럼 제시하게 된다.']
    ];
    const chapters = [['c1', '데이터'], ['c2', '분석 방법'], ['c3', '순위 비교'], ['c4', '영향별 결과'], ['c5', '어긋나는 원료'], ['c6', '결과 점검'], ['c7', '해석의 범위'], ['c8', '판단 기록']];
    const steps = [
      ['탄소발자국가 모든 영향을 대변한다면', `원료 ${POOL.length}종을 탄소발자국 순위대로 세웠다. 다른 영향 계수도 같은 순서라면 모든 점이 이 대각선 위에 놓인다.`],
      ['물소모계수 순위로 펼치면 흩어진다', `세로축을 물소모계수 순위로 바꾸자 점이 넓게 퍼졌다. 순위상관 ρ는 <mark>${CI('물').rho.toFixed(2)}</mark>. 1이면 순서가 같고, 0이면 관계가 없다.`],
      ['탄소발자국 상위 20%', `탄소발자국가 상위 20%인 원료는 <mark>${tcN}종</mark>이다. 오른쪽 세로 띠에 들어 있다.`],
      ['물소모계수 상위 20%', `물소모계수가 상위 20%인 원료는 <mark>${w['다른영향상위']}종</mark>, 위쪽 가로 띠다. 탄소발자국 순위가 물 순위를 대신한다면 두 띠는 대부분 겹쳐야 한다.`],
      [`겹치는 원료는 ${w['함께상위']}종`, `물소모계수 상위 ${w['다른영향상위']}종 가운데 탄소발자국도 상위 20%인 원료는 <mark>${w['함께상위']}종</mark>이고, <mark>${w['빠진']}종</mark>은 탄소발자국 순위로는 상위에 들지 않는다.<small>2,000번 재추출한 95% 구간은 ${w.lo}~${w.hi}%. 두 순위가 무관해도 20%는 겹친다.</small>`],
      ['골판지의 경우', `골판지는 탄소발자국가 <mark>${L.topLabel(cb.c)}</mark>, 물소모계수는 <mark>${L.topLabel(cb.o)}</mark>다. 탄소발자국만으로는 드러나지 않는 차이다. 제품에서 골판지의 물소모이 실제로 클지는 투입량에 달려 있다.`],
      ['산성비는 대각선을 따른다', `산성비로 바꾸면 점이 대각선 근처에 모인다. 상위 ${a['다른영향상위']}종 중 <mark>${a['함께상위']}종</mark>이 탄소발자국도 상위 20%다.<span class="slens"><em>다른 영향 보기</em>${LENSES.map(k => `<button type="button" data-slens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('')}</span>`]
    ];

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <div class="hero-copy">
          <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}건 분석</p>
          <h1>탄소발자국과 물소모계수는<br>거의 따로 움직였다</h1>
          <p class="lead">물소모계수 상위 20% 원료 ${w['다른영향상위']}종 가운데 탄소발자국도 상위 20%인 원료는 <b>${w['함께상위']}종</b>. 탄소발자국 순위는 산성비·자원발자국과는 맞았지만 물소모계수·부영양화와는 어긋났다.</p>
          <p class="scope">원료 1kg당 계수에 대한 분석이며, 제품의 환경영향 결과가 아니다.</p>
        </div>
        <figure class="hero-fig">
          <figcaption>물소모계수 상위 20% 원료 ${w['다른영향상위']}종</figcaption>
          <div class="waffle" id="waffle" aria-label="${w['다른영향상위']}종 중 ${w['함께상위']}종은 탄소발자국도 상위 20%, ${w['빠진']}종은 아님"></div>
          <div class="wf-key"><span><i class="got"></i>탄소발자국도 상위 20% <b>${w['함께상위']}</b></span><span><i class="miss"></i>탄소발자국는 상위 20% 밖 <b>${w['빠진']}</b></span></div>
        </figure>
      </div>
      <dl class="sum">
        <div><dt>탄소발자국 순위와 맞는 영향</dt><dd>산성비 ρ ${CI('산성').rho.toFixed(2)}, 자원발자국 ρ ${CI('자원').rho.toFixed(2)}. 상위 20% 겹침도 ${a['포착률']}%, ${CAP('자원')['포착률']}%로 높다.</dd></div>
        <div><dt>어긋나는 영향</dt><dd>물소모계수 ρ ${CI('물').rho.toFixed(2)}. 부영양화는 ρ ${CI('부영').rho.toFixed(2)}이지만 상위 20% 겹침은 ${e['포착률']}%에 그친다.</dd></div>
        <div><dt>시사점</dt><dd>이 계수만으로는 탄소발자국으로 물소모계수·부영양화를 짐작할 근거가 없다. 제품 단위의 다범주 확인이 필요하다.</dd></div>
      </dl>
      <a class="cue" href="#c1" data-go="c1">분석 과정 보기</a>
    </section>

    <div class="doc">
      <nav class="rail" aria-label="리포트 순서"><ol>${chapters.map(([id, t], i) => `<li><a href="#${id}" data-go="${id}"><span>${i + 1}</span>${t}</a></li>`).join('')}</ol></nav>
      <div class="chapters">

      <section class="ch" id="c1"><header><span class="chno">1</span><h2>데이터와 분석 대상</h2></header>
        <p class="lead">한국환경산업기술원이 공공데이터포털에 공개한 환경성적표지 평가계수를 그대로 내려받아 정제했다. 평가계수는 원료 1kg, 연료 1MJ처럼 정해진 단위를 쓸 때의 환경영향을 7개 범주로 미리 계산해 둔 값으로, 환경성적표지 산정의 배경 데이터로 쓰인다.</p>
        <div class="data-grid">
          <table class="src"><tbody>
            <tr><th>데이터</th><td>한국환경산업기술원_환경성적표지 평가계수</td></tr>
            <tr><th>기준일</th><td>2021-08-02 (배포 파일 기준)</td></tr>
            <tr><th>규모</th><td>${D.length}건, 영향범주 7종, CSV</td></tr>
            <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(2026-10-19 확인)</span></td></tr>
            <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">data.go.kr/data/15120968</a></td></tr>
          </tbody></table>
          <figure class="fig"><figcaption>분석 대상 선별</figcaption>
            <ol class="funnel" id="funnel">${funnel.map(([n, v, note]) => { const num = typeof v === 'number' ? v : +String(v).split('~')[1]; return `<li><div class="fn-h"><span>${n}</span><b>${v}</b></div><div class="fn-bar"><i style="--w:${(num / D.length * 100).toFixed(1)}%"></i></div>${note ? `<p>${note}</p>` : ''}</li>`; }).join('')}</ol></figure>
          <figure class="fig"><figcaption>원료 ${POOL.length}종의 영향별 빈 값 비율</figcaption>
            <div class="missbars" id="missbars">${missPool.map(x => `<div class="xb${x.k === '오존' ? ' off' : ''}"><span>${NAME[x.k]}</span><div><i style="--w:${x.v}%"></i></div><b>${x.v}%</b></div>`).join('')}</div>
            <p class="read">오존층영향은 ${ozMiss}%가 비어 있어 제외했다. 빈 값은 0으로 채우지 않았다.</p></figure>
        </div>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>분석 방법</h2></header>
        <p class="lead">질문은 하나다. 탄소발자국의 순위가 다른 영향의 순위를 얼마나 대신할 수 있는가. 이를 네 단계로 확인했다.</p>
        <ol class="methods">
          <li><b>같은 집단에서 순위 매기기</b><p>영향 쌍마다 두 값이 모두 있는 원료끼리 백분위를 매겼다. 대상은 쌍에 따라 ${nMin}~${nMax}종이다.</p></li>
          <li><b>순위상관 ρ</b><p>계수가 수십만 배까지 차이 나 값 대신 순위로 관계를 봤다(Spearman). 전체 경향을 보여 준다.</p></li>
          <li><b>상위 20% 겹침 비율</b><p>각 영향에서 값이 가장 큰 20%가 탄소발자국 상위 20%와 같은 원료인지 봤다. 두 순위가 무관하면 20%다.</p></li>
          <li><b>95% 구간</b><p>원료를 다시 뽑아 2,000번 계산했다. 판정은 구간 하한이 50% 이상이면 ‘잘 맞음’, 상한이 60% 미만이면 ‘어긋남’.</p></li>
        </ol>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>순위 비교: 탄소발자국과 물소모계수</h2></header>
        <p class="lead">점 하나가 원료 하나다. 스크롤하면 그래프가 단계별로 바뀐다.</p>
        <div class="story">
          <div class="st-fig"><div class="st-sticky"><figure class="plotcard" id="stPlot"></figure><div class="meter" id="stMeter"></div></div></div>
          <div class="st-steps">${steps.map(([h, t], i) => `<article class="step" data-step="${i}"><span class="sn">${i + 1} / ${steps.length}</span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
        </div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>영향별 결과</h2></header>
        <p class="lead">다섯 개 영향에 같은 기준을 적용했다. 산성비와 자원발자국은 탄소발자국 순위와 잘 맞았고, 물소모계수와 부영양화는 어긋났다.</p>
        <div class="score" id="score"></div>
        <p class="sc-why"><b>부영양화는 순위상관이 ${CI('부영').rho.toFixed(2)}로 높은데 왜 ‘어긋남’인가.</b> 순위상관은 전체 경향을, 겹침 비율은 값이 가장 큰 원료가 같은지를 본다. 부영양화는 전체적으로는 탄소발자국과 비슷하게 움직이지만, 값이 가장 큰 원료들은 서로 달랐다.</p>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>탄소발자국 순위와 어긋나는 원료</h2></header>
        <p class="lead">다른 영향의 계수 순위가 탄소발자국 순위보다 크게 높은 원료다. 기준 40%p에서 ${POOL.length}종 중 ${nHid}종이며, 물소모계수가 가장 많다.</p>
        <div class="tool">
          <div class="tool-ctl">
            <p class="tool-q">순위 차이 기준</p>
            <div class="presets" role="group" aria-label="기준 바로 고르기">${[20, 30, 40, 50, 60, 70].map(v => `<button type="button" data-th="${v}" aria-pressed="false">${v}%p</button>`).join('')}</div>
            <label for="thSlider" class="sr">순위 차이 기준 (%p)</label>
            <div class="range"><input type="range" id="thSlider" min="20" max="70" step="5" value="40"><output><b id="thVal">40</b>%p</output></div>
            <p class="hint">버튼을 누르거나 막대를 끌어 기준을 바꾸면 목록이 바로 바뀐다.</p>
            <div class="big"><b id="thN">0</b><span>종 / ${POOL.length}종</span></div>
            <div class="mbars" id="thBy"></div>
          </div>
          <div class="tool-out" id="thTable"></div>
        </div>
        <p class="note">순위는 원료 1kg 계수끼리의 상대 위치다. 이 목록은 소재의 우열이 아니라, 다범주 평가에서 탄소발자국 외 영향을 함께 확인해 볼 후보를 뜻한다.</p>
      </section>

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>결과 점검</h2></header>
        <p class="lead">결론을 바꿀 수 있는 네 가지 가능성을 확인했다. 모두 결론은 유지됐다.</p>
        <div class="checks">
          <div class="ck"><h3>표본에 따른 우연</h3><p>재추출 2,000회에서 탄소발자국–물소모계수 ρ는 <b>${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}</b>. 상한을 잡아도 약한 관계다.</p></div>
          <div class="ck"><h3>최대 소재군의 영향</h3><p>원료 풀의 ${basicShare}%인 기초화학물질을 빼도 ρ는 <b>${nb.rho.toFixed(2)}</b>(${nb.n}종)로 같았다.</p></div>
          <div class="ck"><h3>기준 선택</h3><p>어긋남 기준을 20~70%p로 바꿔도 <b>모든 기준에서 물소모계수가 가장 많았다.</b></p></div>
          <div class="ck wide"><h3>소재군이 섞여 생긴 착시</h3><p>소재군별로 따로 계산해도 <b>6개 소재군 모두</b> 탄소발자국–물소모계수가 탄소발자국–자원보다 낮았다.</p>
            <table class="mini"><thead><tr><th>소재군</th><th class="num">원료 수</th><th class="num">탄소발자국–자원 ρ</th><th class="num">탄소발자국–물소모계수 ρ</th></tr></thead><tbody>${Object.keys(wcw).sort((x, y) => wcw[y].n - wcw[x].n).map(c => `<tr><td>${esc(c)}</td><td class="num">${wcw[c].n}</td><td class="num">${wcr[c] ? wcr[c].rho.toFixed(2) : '-'}</td><td class="num"><b>${wcw[c].rho.toFixed(2)}</b></td></tr>`).join('')}</tbody></table></div>
        </div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>해석의 범위</h2></header>
        <p class="lead">이 결과는 계수에 대한 것이다. 제품의 환경영향은 다음처럼 계산되므로, 계수 사이의 관계를 제품 사이의 관계로 옮길 수 없다.</p>
        <div class="formula" aria-label="제품의 영향은 원료마다 투입량 곱하기 계수를 모두 더한 값">
          <span class="f-l">제품의 물소모</span><span class="f-eq">=</span>
          <span class="f-t"><b>원료 A 투입량</b><i>×</i><b class="k">A의 물소모계수</b></span><span class="f-p">+</span>
          <span class="f-t"><b>원료 B 투입량</b><i>×</i><b class="k">B의 물소모계수</b></span><span class="f-p">+ …</span>
          <p class="f-note">이 분석은 <b class="k">계수</b>만 다뤘다. 투입량은 제품마다 다르고, 이 데이터에는 없다.</p>
        </div>
        <div class="limits">
          <div><h3>투입량이 결과를 바꾼다</h3><p>물소모계수가 큰 원료도 적게 쓰면 제품의 물소모에 거의 기여하지 않는다.</p></div>
          <div><h3>제품 단위 상관은 다를 수 있다</h3><p>전기·연료 같은 공통 투입 때문에 제품 단위에서는 상관이 더 높을 수도, 낮을 수도 있다.</p></div>
          <div><h3>상충관계는 확인하지 않았다</h3><p>탄소발자국은 줄고 물소모는 느는 상충관계는 기능이 같은 제품끼리 비교해야 확인된다.</p></div>
        </div>
        <div class="yesno">
          <div class="yes"><h3>이 분석으로 말할 수 있는 것</h3><ul>
            <li>원료 계수 수준에서 탄소발자국 순위가 다른 영향 순위와 어디서 맞고 어디서 어긋나는지</li>
            <li>탄소발자국만 산정하고 다른 영향을 생략해도 된다는 근거가 계수 수준에서는 없다는 것</li>
            <li>어떤 영향과 소재군에서 빈 값이 많아 산정이 어려운지</li></ul></div>
          <div class="no"><h3>말할 수 없는 것</h3><ul>
            <li>제품 단위의 관계와 실제 상충관계의 발생</li>
            <li>기능이 다른 소재 사이의 우열, 재활용과 소각의 우열</li>
            <li>계수의 정확도(오차 범위 정보 없음)와 현재 시점의 값(2021년 기준)</li></ul></div>
        </div>
        <div class="next"><h3>다음 단계</h3><p>남은 질문은 ‘제품 단위에서도 그런가’다. 환경성적표지 인증 제품의 영향범주별 결과가 공개돼 있는지 확인해 같은 분석을 제품 단위로 하고, 작성지침에 따라 제품 하나의 기능단위·시스템 경계·기준흐름을 정해 실제 전과정 목록 데이터셋으로 분석할 계획이다.</p></div>
      </section>

      <section class="ch" id="c8"><header><span class="chno">8</span><h2>분석 중 판단 기록</h2></header>
        <p class="lead">정답이 없는 선택마다 이유와, 다르게 했을 때의 결과를 남겼다. 항목을 누르면 펼쳐진다.</p>
        <div class="dec">${decisions.map((d, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>
      </div>
    </div>`;

    waffle(); story(); scorecard(); mismatchTool();

    const links = [...document.querySelectorAll('.rail a')];
    document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); $(a.dataset.go).scrollIntoView({ behavior: L.reduce ? 'auto' : 'smooth', block: 'start' }); }));
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) links.forEach(a => a.classList.toggle('on', a.dataset.go === en.target.id)); }), { rootMargin: '-30% 0px -65% 0px' });
    chapters.forEach(([id]) => io.observe($(id)));
    const rail = document.querySelector('.rail');
    new IntersectionObserver(es => es.forEach(en => rail.classList.toggle('show', en.isIntersecting || en.boundingClientRect.top < 0)), { rootMargin: '0px 0px -60% 0px' }).observe(document.querySelector('.chapters'));
    L.onView($('funnel'), () => $('funnel').classList.add('drawn'));
    L.onView($('missbars'), () => $('missbars').classList.add('drawn'));
  }
  L.tabs.report = { build, built: false };
})();
