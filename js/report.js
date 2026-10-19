/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. */
(function () {
  const { $, esc, IMP, POOL, D, RES, NAME, RKEY } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];
  const VC = { '잘 맞음': 'ok', '어긋남': 'no', '기준에 따라 다름': 'mid' };
  const verdict = k => { const v = RES.verdict[RKEY[k]]; return [VC[v], v]; };
  const CUT = k => RES.cutoff_curve[RKEY[k]], cutAt = (k, q) => CUT(k).find(r => r.q === q);

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
      if (step === 5 && pp[cardboard.id]) { const p = pp[cardboard.id], x = X(p.c), y = Y(p.o); ann = `<circle class="ring" cx="${x}" cy="${y}" r="15"/><line x1="${x + 15}" y1="${y + 6}" x2="${x + 70}" y2="${y + 60}"/><text x="${x + 74}" y="${y + 66}">골판지</text><text class="s" x="${x + 74}" y="${y + 84}">탄소발자국 ${L.topLabel(p.c)} · 물발자국 ${L.topLabel(p.o)}</text>`; }
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
    $('score').innerHTML = `<div class="sc-h"><span>영향</span><span>순위상관 ρ<small>점은 추정값, 띠는 95% 구간</small></span><span>상위 20% 겹침 비율<small>막대 끝 선은 95% 구간, 세로선은 무관할 때(20%)</small></span><span>상위 10·20·30% 겹침</span><span>판정</span></div>` +
      rows.map(k => {
        const ci = CI(k), c = CAP(k), [vc, vt] = verdict(k);
        return `<div class="sc-r ${vc}"><b class="sc-n">${NAME[k]}</b>
          <div class="rho"><div class="track"><i class="ci" style="left:${ci.lo * 100}%;width:${(ci.hi - ci.lo) * 100}%"></i><i class="pt" style="left:${ci.rho * 100}%"></i></div><span>${ci.rho.toFixed(2)} <small>(${ci.lo.toFixed(2)}~${ci.hi.toFixed(2)})</small></span></div>
          <div class="capb"><div class="track"><i class="fill" style="--v:${c['포착률']}%"></i><i class="ci" style="left:${c.lo}%;width:${c.hi - c.lo}%"></i><i class="base"></i></div><span><b>${c['포착률']}%</b> <small>(${c.lo}~${c.hi}%)</small></span></div>
          <div class="tri">${[10, 20, 30].map(q => { const r = cutAt(k, q); return `<span class="${r.rate >= 50 ? 'hi' : 'lo'}">${r.rate}%</span>`; }).join('')}</div>
          <span class="tag ${vc}">${vt}</span></div>`;
      }).join('');
    L.onView($('score'), () => $('score').classList.add('drawn'));
  }

  /* ---------- 상위 기준별 겹침 비율 (10~50%) ---------- */
  function curve() {
    const W = 760, H = 330, m = { l: 48, r: 120, t: 16, b: 46 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const qs = [10, 15, 20, 25, 30, 40, 50], X = q => m.l + (q - 10) / 40 * iw, Y = v => m.t + ih - v / 100 * ih;
    const col = { 물: '#0F3B2A', 부영: '#7DB547', 스모그: '#9CB8A3', 자원: '#4E8F69', 산성: '#2F8A4F' };
    const order = ['산성', '자원', '스모그', '부영', '물'];
    const ends = order.map(k => ({ k, y: Y(CUT(k).find(r => r.q === 50).rate) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
    const ly = Object.fromEntries(ends.map(e => [e.k, e.y]));
    $('curve').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="상위 기준별 겹침 비율">
      <rect class="pick20" x="${X(19)}" y="${m.t}" width="${X(21) - X(19)}" height="${ih}"/>
      ${[0, 25, 50, 75, 100].map(v => `<line class="g" x1="${m.l}" x2="${m.l + iw}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tk" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
      ${qs.map(q => `<text class="tk" x="${X(q)}" y="${H - 22}" text-anchor="middle">${q}%</text>`).join('')}
      <text class="ax" x="${m.l + iw / 2}" y="${H - 4}" text-anchor="middle">상위 몇 %를 비교했나</text>
      <line class="base" x1="${X(10)}" y1="${Y(10)}" x2="${X(50)}" y2="${Y(50)}"/>
      <text class="bt" x="${X(50) - 4}" y="${Y(50) + 16}" text-anchor="end">두 순위가 무관할 때</text>
      ${order.map(k => `<polyline class="ln ${k === '물' ? 'main' : ''}" style="stroke:${col[k]}" points="${CUT(k).map(r => `${X(r.q)},${Y(r.rate)}`).join(' ')}"/>
        ${CUT(k).map(r => `<circle cx="${X(r.q)}" cy="${Y(r.rate)}" r="${k === '물' ? 4.5 : 3.2}" style="fill:${col[k]}"><title>${NAME[k]} 상위 ${r.q}%: ${r.both}/${r.top}종 겹침 (${r.rate}%, 95% 구간 ${r.lo}~${r.hi}%)</title></circle>`).join('')}
        <text class="lb ${k === '물' ? 'main' : ''}" x="${X(50) + 10}" y="${ly[k] + 4}" style="fill:${col[k]}">${NAME[k]}</text>`).join('')}
      <text class="pt" x="${X(20)}" y="${m.t + 12}" text-anchor="middle">기준 20%</text>
    </svg>`;
    L.onView($('curve'), () => $('curve').classList.add('drawn'));
  }

  /* ---------- 검토가 필요한 값 ---------- */
  function review() {
    const rv = RES.review, P = [...rv.same_pairs].sort((x, y) => y.n_same - x.n_same), f = L.fmt;
    const order = ['자원발자국', '탄소발자국', '오존층영향', '산성비', '부영양화', '광화학스모그', '물소모'];
    const disp = k => k === '물소모' ? '물발자국' : k;
    $('pairs').innerHTML = P.map(p => `<div class="pair"><div class="pair-h"><b>${esc(p.a)}</b><span>${esc(p.a_cat)}</span><i>vs</i><b>${esc(p.b)}</b><span>${esc(p.b_cat)}</span><em>${p.n_both}개 범주 중 ${p.n_same}개 일치</em></div>
      <table class="cmp"><thead><tr><th>영향범주</th><th class="num">${esc(p.a)}</th><th class="num">${esc(p.b)}</th><th></th></tr></thead><tbody>${order.filter(k => p.a_values[k] != null || p.b_values[k] != null).map(k => { const x = p.a_values[k], y = p.b_values[k], same = x != null && y != null && Math.abs(x - y) <= Math.abs(x) * 1e-9; return `<tr class="${same ? 'same' : ''}"><td>${disp(k)}</td><td class="num">${x == null ? '<span class="muted">빈 값</span>' : x.toPrecision(10).replace(/0+$/, '')}</td><td class="num">${y == null ? '<span class="muted">빈 값</span>' : y.toPrecision(10).replace(/0+$/, '')}</td><td>${same ? '<b class="eq">같음</b>' : ''}</td></tr>`; }).join('')}</tbody></table></div>`).join('');
    const pairNames = new Set(P.flatMap(p => [p.a, p.b]));
    const extra = rv.shared_values.filter(g => !g.items.every(it => pairNames.has(it.name)));
    $('shared').innerHTML = `<table class="tbl"><thead><tr><th>영향범주</th><th>같은 값을 쓰는 원료</th><th class="num">값</th></tr></thead><tbody>${extra.map(g => `<tr><td>${disp(g.impact)}</td><td>${g.items.map(it => `<b>${esc(it.name.trim())}</b> <small class="muted">${esc(it.cat)}</small>`).join('<br>')}</td><td class="num">${f(g.value)}</td></tr>`).join('')}</tbody></table>`;
    const unit = { 물소모: 'm³ H₂O eq/kg' };
    $('extreme').innerHTML = rv.extreme.map(x => `<div class="xcard"><span>${disp(x.impact)} · ${esc(x.cat)}</span><b>${esc(x.name)}</b><strong>${f(x.value)}<small> ${unit[x.impact] || ''}</small></strong><p>원료 풀 중앙값의 ${x.times_median >= 1 ? `약 ${Math.round(x.times_median / 1e4)}만 배` : `약 ${Math.round(1 / x.times_median / 1e4)}만분의 1`}</p></div>`).join('');
    $('ozone').innerHTML = `<table class="tbl"><thead><tr><th>항목</th><th class="num">오존층영향 (kg CFC-11 eq/kg)</th></tr></thead><tbody>${rv.ozone_hi.map(o => `<tr><td><b>${esc(o.name)}</b></td><td class="num">${f(o.value)}</td></tr>`).join('')}</tbody></table>`;
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
    const sel = RES.selection;
    const missPool = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'].map(k => ({ k, v: 100 - Math.round(L.coverage(POOL, L.J(k)) * 100) }));
    const funnel = [
      ['전체 평가계수', D.length, ''],
      ['원료 및 에너지 생산 단계', nStage, '다른 단계는 기준 단위가 다르고 일부는 탄소발자국만 있음'],
      ['단위가 kg인 원료', nKg, '개(ea)·m³·MJ·kWh·m² 단위 9건 제외'],
      ['수자원(상수·공업용수) 제외', POOL.length, '재료가 아닌 용수, 탄소발자국이 중앙값의 약 5천분의 1'],
      ['영향 쌍마다 두 값이 모두 있는 원료', `${nMin}~${nMax}`, '빈 값을 채우지 않아 비교 쌍마다 대상 수가 다름']
    ];
    const decisions = [
      ['주장의 범위', '제품이 아니라 계수에 대한 결론으로 한정', '제품의 영향은 원료별 투입량 × 계수의 합이다. 계수 사이의 관계가 제품 사이의 관계와 같다는 보장이 없다.', '초기 버전은 “탄소로 원료를 고르면 놓친다”처럼 계수 결과를 제품 선택의 문제로 넓혀 썼다.'],
      ['순위를 매기는 집단', '영향 쌍마다 두 값이 모두 있는 원료끼리 순위를 매김', '값이 있는 원료 수가 영향마다 다르다(탄소발자국 187종, 물발자국 163종). 다른 집단에서 매긴 순위끼리 빼면 비교가 어긋난다.', '초기 버전은 집단이 달라 어긋나는 원료를 25종으로 적게 셌다. 수정 후 34종.'],
      ['빈 값', '0으로 채우지 않음', '‘해당없음’은 측정하지 않았다는 뜻이지 영향이 0이라는 뜻이 아니다.', '0으로 채우면 비어 있는 영향이 낮게 잡히고 상관계수가 왜곡된다.'],
      ['오존층영향', '분석에서 제외', `전체 ${D.length}건 중 값이 있는 항목은 ${ozoneAll}건, 원료 풀에서는 ${ozMiss}%가 비어 있다.`, '비교 대상이 십여 종으로 줄어 우연한 결과가 나올 수 있다.'],
      ['단위와 단계', '원료 단계의 kg 기준 원료끼리만 비교', `원료 단계 ${nStage}건 중 ${nKg}건이 kg이고, 나머지는 개·m³·MJ·kWh·m² 단위다. 다른 단계는 ton·km, ‘kg clinker’ 등 기준이 다르다. 재활용·소각 계수는 회피 부하나 에너지 회수 반영 여부를 알 수 없어 서로 비교하지 않았다.`, '다이오드(1개당)와 트랜지스터(1kg당)를 같은 순위에 세우면 단위 차이가 순위를 정한다.'],
      ['수자원', '분석에서 제외', '재료가 아닌 용수이고 값이 1,000배 이상 작다.', '가장 낮은 순위를 용수가 차지해 순위가 왜곡된다.'],
      ['요약 방법', '평균 대신 순위와 중앙값', '계수가 수십만 배까지 차이 나 평균과 피어슨 상관은 큰 값 몇 개에 끌려간다.', '극단값 몇 개가 결론을 정한다.'],
      ['숫자의 신뢰 범위', '상관계수와 겹침 비율에 95% 구간 표시', `원료를 다시 뽑아 2,000번 계산했다. 물발자국 겹침 비율은 ${w['포착률']}%지만 구간은 ${w.lo}~${w.hi}%로 넓다.`, '추정값 하나만 쓰면 “절반 이상”처럼 데이터보다 강한 문장이 나온다.'],
      ['상위 20% 기준', '모든 영향에서 상위 그룹이 30종 이상이 되는 가장 작은 기준', `15%면 가장 작은 그룹이 ${RES.cutoff_min_top['15']}종, 10%면 ${RES.cutoff_min_top['10']}종이다. 10%에서는 물발자국 겹침의 95% 구간이 ${cutAt('물', 10).lo}~${cutAt('물', 10).hi}%로 넓어진다.`, '처음에는 관행(80/20)으로 20%를 골랐고 다른 기준을 확인하지 않았다. 확인해 보니 부영양화 판정이 기준에 따라 바뀌어, 판정을 세 기준으로 바꿨다.'],
      ['판정 기준', '상위 10·20·30% 세 기준에서 모두 같은 결과일 때만 판정', '한 기준에만 기대면 그 기준을 고른 것이 결론을 정한다.', '20% 하나로 판정하면 부영양화가 ‘어긋남’으로 나오지만 30%에서는 겹침이 67%다.'],
      ['검토가 필요한 값', '빼지 않고 분석하고, 뺀 결과를 함께 공개', '원본과 대조하기 전에는 오류라고 단정할 수 없다. 대신 규칙 네 가지로 전수 확인하고, 뺐을 때의 결과를 비교했다.', '임의로 지우거나 고치면 원자료를 바꾼 분석이 된다.'],
      ['어긋남 기준', '순위 차이 40%p, 다른 기준의 결과도 공개', `30%p면 ${th['30']}종, 50%p면 ${th['50']}종, 60%p면 ${th['60']}종이다. 모든 기준에서 물발자국이 가장 많다.`, '기준 하나만 제시하면 숫자를 고른 것처럼 보인다.'],
      ['소재군 섞임', '소재군별로, 최대 소재군을 빼고 재계산', `기초화학물질을 빼도 탄소발자국–물발자국 ρ는 ${nb.rho.toFixed(2)}(${nb.n}종)로 같았다.`, '소재군이 섞여 생긴 착시였다면 결론이 뒤집혔을 것이다.'],
      ['군집 분석', '결론에 쓰지 않음', `K-means 실루엣 점수가 ${silK.toFixed(2)}로 낮고(0.5 이상이면 뚜렷), 묶는 기준을 바꾸면 일치도(ARI)가 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${sens['6개(+스모그)'].ARI.toFixed(2)}로 떨어진다.`, '경계가 흐린 결과를 등급처럼 제시하게 된다.']
    ];
    const chapters = [['c1', '데이터'], ['c2', '분석 방법'], ['c3', '순위 비교'], ['c4', '영향별 결과'], ['c5', '어긋나는 원료'], ['c6', '검토가 필요한 값'], ['c7', '결과 점검'], ['c8', '해석의 범위'], ['c9', '판단 기록']];
    const steps = [
      ['탄소발자국이 모든 영향을 대변한다면', `원료 ${POOL.length}종을 탄소발자국 순위대로 세웠다. 다른 영향 계수도 같은 순서라면 모든 점이 이 대각선 위에 놓인다.`],
      ['물발자국 순위로 펼치면 흩어진다', `세로축을 물발자국 순위로 바꾸자 점이 넓게 퍼졌다. 순위상관 ρ는 <mark>${CI('물').rho.toFixed(2)}</mark>. 1이면 순서가 같고, 0이면 관계가 없다.`],
      ['탄소발자국 상위 20%', `탄소발자국이 상위 20%인 원료는 <mark>${tcN}종</mark>이다. 오른쪽 세로 띠에 들어 있다.`],
      ['물발자국 상위 20%', `물발자국이 상위 20%인 원료는 <mark>${w['다른영향상위']}종</mark>, 위쪽 가로 띠다. 탄소발자국 순위가 물발자국 순위를 대신한다면 두 띠는 대부분 겹쳐야 한다.`],
      [`겹치는 원료는 ${w['함께상위']}종`, `물발자국 상위 ${w['다른영향상위']}종 가운데 탄소발자국도 상위 20%인 원료는 <mark>${w['함께상위']}종</mark>이고, <mark>${w['빠진']}종</mark>은 탄소발자국 순위로는 상위에 들지 않는다.<small>2,000번 재추출한 95% 구간은 ${w.lo}~${w.hi}%. 두 순위가 무관해도 20%는 겹친다.</small>`],
      ['골판지의 경우', `골판지는 탄소발자국이 <mark>${L.topLabel(cb.c)}</mark>, 물발자국은 <mark>${L.topLabel(cb.o)}</mark>다. 탄소발자국만으로는 드러나지 않는 차이다. 제품에서 골판지의 물발자국이 실제로 클지는 투입량에 달려 있다.`],
      ['산성비는 대각선을 따른다', `산성비로 바꾸면 점이 대각선 근처에 모인다. 상위 ${a['다른영향상위']}종 중 <mark>${a['함께상위']}종</mark>이 탄소발자국도 상위 20%다.<span class="slens"><em>다른 영향 보기</em>${LENSES.map(k => `<button type="button" data-slens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('')}</span>`]
    ];

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <div class="hero-copy">
          <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}건 분석</p>
          <h1>탄소발자국과 물발자국은<br>거의 따로 움직였다</h1>
          <p class="lead">물발자국 상위 20% 원료 ${w['다른영향상위']}종 가운데 탄소발자국도 상위 20%인 원료는 <b>${w['함께상위']}종</b>. 탄소발자국 순위는 산성비·자원발자국과는 맞았지만 물발자국과는 어긋났다. 분석 도중 다시 확인해야 할 계수도 발견했다.</p>
          <p class="scope">원료 1kg당 계수에 대한 분석이며, 제품의 환경영향 결과가 아니다.</p>
        </div>
        <figure class="hero-fig">
          <figcaption>물발자국 상위 20% 원료 ${w['다른영향상위']}종</figcaption>
          <div class="waffle" id="waffle" aria-label="${w['다른영향상위']}종 중 ${w['함께상위']}종은 탄소발자국도 상위 20%, ${w['빠진']}종은 아님"></div>
          <div class="wf-key"><span><i class="got"></i>탄소발자국도 상위 20% <b>${w['함께상위']}</b></span><span><i class="miss"></i>탄소발자국은 상위 20% 밖 <b>${w['빠진']}</b></span></div>
        </figure>
      </div>
      <dl class="sum">
        <div><dt>탄소발자국 순위와 맞는 영향</dt><dd>산성비 ρ ${CI('산성').rho.toFixed(2)}, 자원발자국 ρ ${CI('자원').rho.toFixed(2)}. 상위 20% 겹침도 ${a['포착률']}%, ${CAP('자원')['포착률']}%로 높다.</dd></div>
        <div><dt>어긋나는 영향</dt><dd>물발자국 ρ ${CI('물').rho.toFixed(2)}. 상위 10·20·30% 어느 기준에서도 겹침이 절반에 못 미쳤다. 부영양화·광화학스모그는 기준에 따라 판정이 달라졌다.</dd></div>
        <div><dt>다시 확인할 값</dt><dd>납과 염소는 5개 범주 값이 소수점 끝자리까지 같았다. 기기선의 물발자국은 원료 풀 중앙값의 약 18만 배였다.</dd></div>
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
          <figure class="fig"><figcaption>원료 ${POOL.length}종의 영향범주별 빈 값 비율</figcaption>
            <div class="missbars" id="missbars">${missPool.map(x => `<div class="xb${x.k === '오존' ? ' off' : ''}"><span>${NAME[x.k]}</span><div><i style="--w:${x.v}%"></i></div><b>${x.v}%</b></div>`).join('')}</div>
            <p class="read">오존층영향은 ${ozMiss}%가 비어 있어 제외했다. 빈 값은 0으로 채우지 않았다.</p></figure>
        </div>
        <h3 class="sub">선별 기준과 근거</h3>
        <table class="tbl why"><thead><tr><th>기준</th><th>근거</th><th>포함했다면</th></tr></thead><tbody>
          <tr><td><b>원료 및 에너지 생산 단계만</b><br><small class="muted">${D.length}건 → ${nStage}건</small></td><td>단계마다 기준 단위가 다르다. 수송은 ton·km, 화학반응공정은 ‘kg clinker’, ‘kg CaCO3’처럼 ${sel.units_by_stage['화학반응공정'].length}가지 단위를 쓴다. 또 연료원별 사용 ${sel.carbon_only_by_stage['연료원별 사용']}건과 화학반응공정 ${sel.carbon_only_by_stage['화학반응공정']}건은 탄소발자국만 있어 범주 간 비교 자체가 불가능하다.</td><td>탄소발자국만 있는 항목은 상관 계산에 쓰이지 않고, 단위가 다른 항목끼리 순위를 매기게 된다.</td></tr>
          <tr><td><b>단위가 kg인 원료만</b><br><small class="muted">${nStage}건 → ${nKg}건</small></td><td>원료 단계 ${nStage}건 중 ${nKg}건(${Math.round(nKg / nStage * 100)}%)이 1kg당 값이다. 나머지 ${nStage - nKg}건은 개(ea) ${sel.stage_units.ea}건, m³·MJ·kWh·m² 각 1건이다. 예를 들어 다이오드는 1개당 값이라, 1kg당 값인 트랜지스터와 같은 순위에 세우면 소재의 차이가 아니라 단위의 차이가 순위를 정한다.</td><td>‘다이오드 1개’와 ‘트랜지스터 1kg’을 같은 줄에 세우는 비교가 된다.</td></tr>
          <tr><td><b>수자원 2건 제외</b><br><small class="muted">${nKg}건 → ${POOL.length}건</small></td><td>공업용수와 상수는 재료가 아니라 용수다. 탄소발자국이 1kg당 약 0.0002 kg CO₂ eq로 원료 풀 중앙값(${L.fmt(sel.pool_median['탄소발자국'])})의 약 5천분의 1이다.</td><td>탄소발자국–물발자국 ρ는 ${sel.rho_with_utility_water.toFixed(2)}(제외 시 ${CI('물').rho.toFixed(2)})로 결론은 같다. 다만 ‘가장 낮은 원료’ 자리를 용수가 차지한다.</td></tr>
          <tr><td><b>오존층영향 제외</b></td><td>원료 풀 ${POOL.length}종 중 값이 있는 원료가 ${L.has(POOL, 6).length}종뿐이다(빈 값 ${ozMiss}%).</td><td>십여 종으로 계산한 순위상관은 우연에 크게 흔들린다.</td></tr>
          <tr><td><b>빈 값은 채우지 않음</b></td><td>‘해당없음’은 측정하지 않았다는 뜻이다. 영향 쌍마다 두 값이 모두 있는 원료만 비교했다(${nMin}~${nMax}종).</td><td>0으로 채우면 비어 있는 영향이 가장 낮은 순위로 잡힌다.</td></tr>
        </tbody></table>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>분석 방법</h2></header>
        <p class="lead">질문은 하나다. 탄소발자국의 순위가 다른 영향의 순위를 얼마나 대신할 수 있는가. 이를 네 단계로 확인했다.</p>
        <ol class="methods">
          <li><b>같은 집단에서 순위 매기기</b><p>영향 쌍마다 두 값이 모두 있는 원료끼리 백분위를 매겼다. 대상은 쌍에 따라 ${nMin}~${nMax}종이다.</p></li>
          <li><b>순위상관 ρ</b><p>계수가 수십만 배까지 차이 나 값 대신 순위로 관계를 봤다(Spearman). 전체 경향을 보여 준다.</p></li>
          <li><b>상위 20% 겹침 비율</b><p>각 영향에서 값이 가장 큰 20%가 탄소발자국 상위 20%와 같은 원료인지 봤다. 순위상관이 전체 경향을 본다면, 이 비율은 값이 큰 쪽이 같은지를 본다. 두 순위가 무관하면 20%다.</p></li>
          <li><b>95% 구간과 판정</b><p>원료를 다시 뽑아 2,000번 계산해 구간을 구했다. 판정은 상위 10·20·30% 세 기준 모두에서 겹침이 50% 이상이면 ‘잘 맞음’, 모두 50% 미만이면 ‘어긋남’, 섞이면 ‘기준에 따라 다름’이다.</p></li>
        </ol>
        <div class="why20"><h3>왜 상위 20%인가</h3>
          <p>상위 그룹이 작을수록 원료 한두 개에 비율이 크게 흔들린다. 그룹이 30종이면 원료 1종이 바뀔 때 비율이 약 3%p 움직이지만, 15종이면 약 7%p씩 움직인다. 30은 표본 비율을 다룰 때 흔히 쓰는 최소 규모다. 모든 영향에서 상위 그룹이 <b>30종 이상</b>이 되는 가장 작은 기준이 20%다. 15%에서는 가장 작은 그룹이 ${RES.cutoff_min_top['15']}종, 10%에서는 ${RES.cutoff_min_top['10']}종으로 줄어든다. 실제로 물발자국 상위 10%(${cutAt('물', 10).top}종)의 겹침 비율은 95% 구간이 ${cutAt('물', 10).lo}~${cutAt('물', 10).hi}%로, 판단에 쓰기 어려울 만큼 넓다.</p>
          <div class="mini-grid">${[10, 15, 20, 25, 30].map(q => `<div class="${q === 20 ? 'on' : ''}"><span>상위 ${q}%</span><b>${RES.cutoff_min_top[q]}종</b><small>가장 작은 그룹</small></div>`).join('')}</div>
          <p class="hint">20%만으로 결론을 내리지 않도록, 4장에서 10~50%의 결과를 함께 보여 준다.</p></div>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>순위 비교: 탄소발자국과 물발자국</h2></header>
        <p class="lead">점 하나가 원료 하나다. 스크롤하면 그래프가 단계별로 바뀐다.</p>
        <div class="story">
          <div class="st-fig"><div class="st-sticky"><figure class="plotcard" id="stPlot"></figure><div class="meter" id="stMeter"></div></div></div>
          <div class="st-steps">${steps.map(([h, t], i) => `<article class="step" data-step="${i}"><span class="sn">${i + 1} / ${steps.length}</span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
        </div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>영향별 결과</h2></header>
        <p class="lead">다섯 개 영향에 같은 기준을 적용했다. 산성비와 자원발자국은 탄소발자국 순위와 잘 맞았고, 물발자국은 어긋났다. 부영양화와 광화학스모그는 비교 기준에 따라 판정이 달라졌다.</p>
        <div class="score" id="score"></div>
        <figure class="fig curvefig"><figcaption>상위 몇 %를 비교하느냐에 따른 겹침 비율</figcaption><div id="curve" class="curve"></div>
          <p class="read">대각선은 두 순위가 무관할 때 우연히 겹치는 비율이다. 물발자국은 상위 10%에서 ${cutAt('물', 10).top}종 중 ${cutAt('물', 10).both}종(${cutAt('물', 10).rate}%)만 겹쳐 우연과 거의 같았고, 10~30%에서는 모두 절반에 못 미쳤다. 비교 범위를 40% 이상으로 넓혀도 우연 기대값보다 ${cutAt('물', 40).rate - 40}~${cutAt('물', 50).rate - 50}%p 높은 정도다. 점에 마우스를 올리면 원료 수와 95% 구간이 보인다.</p></figure>
        <p class="sc-why"><b>부영양화는 순위상관이 ${CI('부영').rho.toFixed(2)}로 높은데 왜 판정이 갈리나.</b> 순위상관은 전체 경향을, 겹침 비율은 값이 큰 쪽이 같은 원료인지를 본다. 부영양화는 상위 20%까지는 겹침이 ${cutAt('부영', 20).rate}%에 그치지만 30%에서는 ${cutAt('부영', 30).rate}%로 올라간다. 값이 가장 큰 몇몇 원료만 탄소발자국과 다르다는 뜻이다.</p>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>탄소발자국 순위와 어긋나는 원료</h2></header>
        <p class="lead">다른 영향의 계수 순위가 탄소발자국 순위보다 크게 높은 원료다. 기준 40%p에서 ${POOL.length}종 중 ${nHid}종이며, 물발자국이 가장 많다.</p>
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

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>검토가 필요한 값</h2></header>
        <p class="lead">분석 중 납과 염소의 값이 다섯 개 범주에서 모두 같다는 것을 발견했다. 다른 물질인데 값이 똑같은 경우가 더 있는지, 자릿수가 크게 벗어난 값은 없는지 네 가지 규칙으로 전체를 다시 확인했다. 원본과 대조하기 전까지는 오류로 단정할 수 없어 ‘검토가 필요한 값’으로 표시했다.</p>
        <ol class="rules">
          <li><b>규칙 1</b>${esc(RES.review.rules.same_pairs)}</li>
          <li><b>규칙 2</b>${esc(RES.review.rules.shared_values)}</li>
          <li><b>규칙 3</b>${esc(RES.review.rules.extreme)}</li>
          <li><b>규칙 4</b>${esc(RES.review.rules.ozone_hi)}</li>
        </ol>
        <h3 class="sub">규칙 1. 여러 범주의 값이 통째로 같은 항목 <small>${RES.review.same_pairs.length}쌍</small></h3>
        <div class="pairs" id="pairs"></div>
        <p class="note">납은 금속, 염소는 기초화학물질로 생산 공정이 전혀 다르다. 다섯 개 범주가 소수점 아래 아홉 자리까지 같다는 것은 같은 값을 옮겨 적었거나 같은 대리 데이터를 썼을 가능성을 보여 준다. 파티클보드(재활용원료)와 우드칩은 같은 목재 계열이라 대리 데이터를 공유했을 수 있다. 다만 <b>파티클보드의 오존층영향과 우드칩의 산성비가 0.000999692로 같은 숫자</b>다. 같은 값이 서로 다른 열에 들어가 있어, 입력할 때 열이 한 칸 어긋났을 가능성이 있다. 파티클보드의 오존층영향(1kg당 약 0.001 kg CFC-11 eq)은 오존층영향 값이 있는 ${RES.review.ozone_n}건 중 5번째로 크고, 나머지 상위 4건은 불화수소·발연황산 같은 화학물질과 옵셋잉크다. 목재 제품으로는 이례적이라 이 가능성과 맞아떨어진다.</p>
        <div class="two" style="margin-top:28px">
          <div><h3 class="sub">규칙 2. 한 범주의 값을 공유하는 항목 <small>규칙 1 제외 ${RES.review.shared_values.filter(g => !g.items.every(it => RES.review.same_pairs.some(p => p.a === it.name || p.b === it.name))).length}건</small></h3>
            <div id="shared"></div>
            <p class="hint">같은 계열 소재(폴리부타디엔과 그 고무, 고밀도 폴리에틸렌과 그 필름 원지)는 같은 대리 데이터를 썼을 수 있다. 스테인리스강과 탄소강처럼 공정이 크게 다른 경우, 리드저항 4종처럼 재질이 다른 경우는 확인이 필요하다.</p></div>
          <div><h3 class="sub">규칙 3. 자릿수가 크게 벗어난 값 <small>${RES.review.extreme.length}건</small></h3>
            <div class="xcards" id="extreme"></div>
            <p class="hint">기기선은 같은 전선류인 PVC 전선(${L.fmt(POOL.find(r => r.name === 'PVC 전선').v[4])} m³/kg)보다 100만 배 이상 크다. 단위 환산 오류 가능성이 있다.</p>
            <h3 class="sub" style="margin-top:22px">규칙 4. 오존층영향이 큰 값 <small>${RES.review.ozone_hi.length}건</small></h3>
            <div id="ozone"></div>
            <p class="hint">오존층영향 값 ${RES.review.ozone_n}건은 ${L.fmt(RES.review.ozone_range[0])}에서 ${L.fmt(RES.review.ozone_range[1])}까지 약 ${Math.round(RES.review.ozone_range[1] / RES.review.ozone_range[0] / 1e6).toLocaleString('ko-KR')}백만 배에 걸쳐 있다. 불소·황 화합물은 제조 공정 특성상 클 수 있어 판단을 보류했지만, 옵셋잉크는 확인이 필요하다.</p></div>
        </div>
        <div class="impact"><h3>이 값들이 결론을 바꾸나</h3>
          <div class="imp-grid">
            <div><span>그대로</span><b>${CI('물').rho.toFixed(2)}</b><small>탄소발자국–물발자국 ρ · 겹침 ${CAP('물')['포착률']}%</small></div>
            <div><span>규칙 1·3 항목 ${RES.review_sensitivity.strong.excluded.length}종 제외</span><b>${RES.review_sensitivity.strong['물소모'].rho.toFixed(2)}</b><small>겹침 ${RES.review_sensitivity.strong['물소모'].rate}%</small></div>
            <div><span>규칙 1·2·3 항목 ${RES.review_sensitivity.all.excluded_n}종 제외</span><b>${RES.review_sensitivity.all['물소모'].rho.toFixed(2)}</b><small>겹침 ${RES.review_sensitivity.all['물소모'].rate}%</small></div>
          </div>
          <p>검토가 필요한 값을 빼도 물발자국이 탄소발자국 순위와 어긋난다는 결론은 같았다. 원자료를 임의로 고치지 않기 위해 본 분석에서는 빼지 않았다.</p></div>
        <div class="checklist"><h3>평가계수를 쓰기 전 점검표</h3><ol>
          <li><b>단위</b>1kg당인지, 1개·1MJ·1m³당인지 확인한다. 같은 단계 안에서도 섞여 있다.</li>
          <li><b>같은 값</b>서로 다른 항목이 같은 값을 쓰는지 확인한다. 대리 데이터라면 출처를 기록한다.</li>
          <li><b>자릿수</b>같은 범주의 중앙값과 비교해 1만 배 이상 벗어나는 값은 원본과 대조한다.</li>
          <li><b>빈 값</b>‘해당없음’을 0으로 넣지 않는다. 탄소발자국만 있는 항목은 다른 범주를 별도 DB로 보완한다.</li>
          <li><b>기준 시점</b>이 파일은 2021-08-02 기준이다. 최신 국가 LCI DB와 작성지침으로 값을 확인한다.</li></ol></div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>결과 점검</h2></header>
        <p class="lead">물발자국 결론을 바꿀 수 있는 가능성을 확인했다. 모두 결론은 유지됐다.</p>
        <div class="checks">
          <div class="ck"><h3>표본에 따른 우연</h3><p>재추출 2,000회에서 탄소발자국–물발자국 ρ는 <b>${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}</b>. 상한을 잡아도 약한 관계다.</p></div>
          <div class="ck"><h3>최대 소재군의 영향</h3><p>원료 풀의 ${basicShare}%인 기초화학물질을 빼도 ρ는 <b>${nb.rho.toFixed(2)}</b>(${nb.n}종)로 같았다.</p></div>
          <div class="ck"><h3>기준 선택</h3><p>상위 10·20·30% 모두에서 겹침이 절반 미만이었고, 어긋남 기준을 20~70%p로 바꿔도 <b>물발자국이 가장 많았다.</b></p></div>
          <div class="ck wide"><h3>소재군이 섞여 생긴 착시</h3><p>소재군별로 따로 계산해도 <b>6개 소재군 모두</b> 탄소발자국–물발자국이 탄소발자국–자원보다 낮았다.</p>
            <table class="mini"><thead><tr><th>소재군</th><th class="num">원료 수</th><th class="num">탄소발자국–자원 ρ</th><th class="num">탄소발자국–물발자국 ρ</th></tr></thead><tbody>${Object.keys(wcw).sort((x, y) => wcw[y].n - wcw[x].n).map(c => `<tr><td>${esc(c)}</td><td class="num">${wcw[c].n}</td><td class="num">${wcr[c] ? wcr[c].rho.toFixed(2) : '-'}</td><td class="num"><b>${wcw[c].rho.toFixed(2)}</b></td></tr>`).join('')}</tbody></table></div>
        </div>
      </section>

      <section class="ch" id="c8"><header><span class="chno">8</span><h2>해석의 범위</h2></header>
        <p class="lead">이 결과는 계수에 대한 것이다. 제품의 환경영향은 다음처럼 계산되므로, 계수 사이의 관계를 제품 사이의 관계로 옮길 수 없다.</p>
        <div class="formula" aria-label="제품의 영향은 원료마다 투입량 곱하기 계수를 모두 더한 값">
          <span class="f-l">제품의 물발자국</span><span class="f-eq">=</span>
          <span class="f-t"><b>원료 A 투입량</b><i>×</i><b class="k">A의 물발자국</b></span><span class="f-p">+</span>
          <span class="f-t"><b>원료 B 투입량</b><i>×</i><b class="k">B의 물발자국</b></span><span class="f-p">+ …</span>
          <p class="f-note">이 분석은 <b class="k">계수</b>만 다뤘다. 투입량은 제품마다 다르고, 이 데이터에는 없다.</p>
        </div>
        <div class="limits">
          <div><h3>투입량이 결과를 바꾼다</h3><p>물발자국이 큰 원료도 적게 쓰면 제품의 물발자국에 거의 기여하지 않는다.</p></div>
          <div><h3>제품 단위 상관은 다를 수 있다</h3><p>전기·연료 같은 공통 투입 때문에 제품 단위에서는 상관이 더 높을 수도, 낮을 수도 있다.</p></div>
          <div><h3>상충관계는 확인하지 않았다</h3><p>탄소발자국은 줄고 물발자국은 느는 상충관계는 기능이 같은 제품끼리 비교해야 확인된다.</p></div>
        </div>
        <div class="yesno">
          <div class="yes"><h3>이 분석으로 말할 수 있는 것</h3><ul>
            <li>원료 계수 수준에서 탄소발자국 순위가 다른 영향 순위와 어디서 맞고 어디서 어긋나는지</li>
            <li>탄소발자국만 산정하고 다른 영향을 생략해도 된다는 근거가 계수 수준에서는 없다는 것</li>
            <li>어떤 영향과 소재군에서 빈 값이 많아 산정이 어려운지</li>
            <li>원본과 대조해 볼 필요가 있는 계수가 어디에 있는지</li></ul></div>
          <div class="no"><h3>말할 수 없는 것</h3><ul>
            <li>제품 단위의 관계와 실제 상충관계의 발생</li>
            <li>기능이 다른 소재 사이의 우열, 재활용과 소각의 우열</li>
            <li>검토가 필요한 값이 실제 오류인지(원본 대조 전)</li>
            <li>계수의 정확도(오차 범위 정보 없음)와 현재 시점의 값(2021년 기준)</li></ul></div>
        </div>
        <div class="next"><h3>다음 단계</h3><p>남은 질문은 두 가지다. 첫째, 검토가 필요한 값을 국가 LCI DB 원본과 대조하고 한국환경산업기술원에 확인한다. 둘째, ‘제품 단위에서도 그런가’다. 환경성적표지 인증 제품의 영향범주별 결과가 공개돼 있는지 확인해 같은 분석을 제품 단위로 하고, 작성지침에 따라 제품 하나의 기능단위·시스템 경계·기준흐름을 정해 실제 전과정 목록 데이터셋으로 분석할 계획이다.</p></div>
      </section>

      <section class="ch" id="c9"><header><span class="chno">9</span><h2>분석 중 판단 기록</h2></header>
        <p class="lead">정답이 없는 선택마다 이유와, 다르게 했을 때의 결과를 남겼다. 항목을 누르면 펼쳐진다.</p>
        <div class="dec">${decisions.map((d, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>
      </div>
    </div>`;

    waffle(); story(); scorecard(); curve(); review(); mismatchTool();

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
