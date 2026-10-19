/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. 본문은 ‘~요’체. */
(function () {
  const { $, esc, POOL, D, RES, NAME, RKEY } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];
  const CUT = k => RES.cutoff_curve[RKEY[k]], cutAt = (k, q) => CUT(k).find(r => r.q === q);

  /* ---------- 순위 비교 그래프 (스크롤에 따라 단계별로 바뀜) ---------- */
  const SW = 600, SH = 560, m = { l: 54, r: 16, t: 20, b: 50 }, iw = SW - m.l - m.r, ih = SH - m.t - m.b;
  const X = p => m.l + p / 100 * iw, Y = p => m.t + ih - p / 100 * ih;
  let lens = '물', step = 0;
  function story() {
    const grid = [0, 20, 40, 60, 80, 100];
    $('stPlot').innerHTML = `<svg viewBox="0 0 ${SW} ${SH}" role="img" aria-labelledby="stT"><title id="stT">원료별 탄소발자국 순위와 물발자국 순위</title>
      ${grid.map(g => `<line class="g" x1="${X(g)}" x2="${X(g)}" y1="${Y(0)}" y2="${Y(100)}"/><line class="g" x1="${X(0)}" x2="${X(100)}" y1="${Y(g)}" y2="${Y(g)}"/>
        <text class="tk" x="${X(g)}" y="${Y(0) + 18}" text-anchor="middle">${g}</text><text class="tk" x="${X(0) - 9}" y="${Y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
      <rect id="zC" class="zone zc" y="${Y(100)}" height="${ih}"/>
      <rect id="zO" class="zone zo" x="${X(0)}" width="${iw}"/>
      <line class="diag" x1="${X(0)}" y1="${Y(0)}" x2="${X(100)}" y2="${Y(100)}"/>
      <g id="sdots">${POOL.map(r => `<circle r="5.4" data-id="${r.id}" class="na"/>`).join('')}</g>
      <g id="ann" class="ann"></g>
      <text class="ax" x="${X(50)}" y="${SH - 8}" text-anchor="middle">탄소발자국 순위 (오른쪽일수록 큼)</text>
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
      $('stAxY').textContent = step === 0 ? '다른 영향 순위' : `${NAME[lens]} 순위 (위쪽일수록 큼)`;
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
      $('stMeter').innerHTML = `<span class="mt-l">${NAME[lens]} 상위 20% 원료</span><b>${cap['다른영향상위']}종</b>
        <span class="mt-got"><i></i>탄소발자국도 상위 <b>${cap['함께상위']}종</b></span><span class="mt-miss"><i></i>탄소발자국은 하위권 <b>${cap['빠진']}종</b></span>`;
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


  /* ---------- 원자료에서 다시 확인할 값 ---------- */
  function pairTable(p) {
    const order = ['자원발자국', '탄소발자국', '오존층영향', '산성비', '부영양화', '광화학스모그', '물소모'];
    const disp = k => (k === '물소모' ? '물발자국' : k), fx = v => (v == null ? '<span class="muted">빈 값</span>' : String(Number(v.toPrecision(10))));
    const eq = (x, y) => x != null && y != null && Math.abs(x - y) <= Math.abs(x) * 1e-9;
    // 한쪽에만 값이 있는 칸끼리 같은 숫자인지 (칸 밀림 의심)
    const shiftA = new Set(), shiftB = new Set();
    order.forEach(ka => order.forEach(kb => { if (ka !== kb && p.b_values[ka] == null && p.a_values[kb] == null && eq(p.a_values[ka], p.b_values[kb])) { shiftA.add(ka); shiftB.add(kb); } }));
    const rows = order.filter(k => p.a_values[k] != null || p.b_values[k] != null);
    const tbl = `<table class="cmp"><thead><tr><th>영향범주</th><th class="num">${esc(p.a)}</th><th class="num">${esc(p.b)}</th><th></th></tr></thead><tbody>${rows.map((k, i) => {
      const x = p.a_values[k], y = p.b_values[k], same = eq(x, y), sh = shiftA.has(k) || shiftB.has(k);
      return `<tr class="${same ? 'same' : ''}${sh ? ' shift-row' : ''}" style="--i:${i}"><td>${disp(k)}</td><td class="num${shiftA.has(k) ? ' shift' : ''}">${fx(x)}</td><td class="num${shiftB.has(k) ? ' shift' : ''}">${fx(y)}</td><td>${same ? '<b class="eq">일치</b>' : sh ? '<b class="eq sh">다른 칸에 같은 값</b>' : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
    if (!shiftA.size) return tbl;
    const ka = [...shiftA][0], kb = [...shiftB][0];
    return tbl + `<div class="shift-call"><div><span>${esc(p.a)}</span><b>${disp(ka)}</b><strong>${fx(p.a_values[ka])}</strong></div><i aria-hidden="true">=</i><div><span>${esc(p.b)}</span><b>${disp(kb)}</b><strong>${fx(p.b_values[kb])}</strong></div>
      <p>서로 다른 영향범주인데 값이 유효숫자 아홉 자리까지 일치하고, 두 원료 모두 이 두 칸 중 한쪽만 값이 있어요. 입력 과정에서 값이 인접 열로 밀린 것으로 보는 게 가장 자연스러운 설명이에요.</p></div>`;
  }
  function review() {
    const rv = RES.review, f = L.fmt;
    $('pairLead').innerHTML = pairTable(rv.same_pairs.find(p => [p.a, p.b].includes('납')));
    $('pairWood').innerHTML = pairTable(rv.same_pairs.find(p => [p.a, p.b].includes('우드칩')));
    const pairNames = new Set(rv.same_pairs.flatMap(p => [p.a, p.b]));
    const extra = rv.shared_values.filter(g => !g.items.every(it => pairNames.has(it.name)));
    $('shared').innerHTML = `<table class="tbl"><thead><tr><th>물발자국 값이 일치하는 원료</th><th class="num">값 (m³/kg)</th></tr></thead><tbody>${extra.map(g => `<tr class="${g.items.some(it => /스테인|저항/.test(it.name)) ? 'chk' : ''}"><td>${g.items.map(it => `<b>${esc(it.name.trim())}</b> <small class="muted">${esc(it.cat)}</small>`).join('<br>')}</td><td class="num">${f(g.value)}</td></tr>`).join('')}</tbody></table>`;
    $('ozone').innerHTML = `<table class="tbl"><thead><tr><th>원료</th><th class="num">오존층영향 (kg CFC-11 eq/kg)</th></tr></thead><tbody>${rv.ozone_hi.map(o => `<tr><td><b>${esc(o.name)}</b></td><td class="num">${f(o.value)}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- 스크롤 등장 효과 ---------- */
  function reveal() {
    const SEL = '.ch > header, .ch > .lead, .impacts, .facts > div, .claim, .cant, .ch > .hint, .ch > .note, .ch > .sub, .ch > .sub-lead, .ch > .concl, .cview, .methods li, .flag, .ex, .checklist, .checklist li, .ck, .yesno > div, .next, .dec details, .formula, .data-grid > *, .story';
    const els = [...document.querySelectorAll('#report ' + SEL)];
    const groups = new Map();
    els.forEach(el => { el.classList.add('rv'); const k = el.parentElement; groups.set(k, (groups.get(k) || 0) + 1); el.style.setProperty('--d', ((groups.get(k) - 1) % 6) * 90 + 'ms'); });
    const show = el => {
      el.classList.add('in');
      el.querySelectorAll('[data-n]').forEach(n => L.count(n, +n.dataset.n, 0, 1100));
    };
    if (L.reduce || !('IntersectionObserver' in window)) return els.forEach(show);
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(el => io.observe(el));
    requestAnimationFrame(() => document.querySelector('.hero').classList.add('go'));
  }

  /* ---------- 탄소발자국만 보기 / 7개 범주 모두 보기 ---------- */
  function carbonView() {
    const box = $('cview'); if (!box) return;
    const tiles = [...box.querySelectorAll('.cv-t')];
    let auto = true;
    const set = (mode, byUser) => {
      if (byUser) auto = false;
      box.classList.toggle('carbon', mode === 'carbon'); box.classList.toggle('all', mode === 'all');
      box.querySelectorAll('[data-cv]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cv === mode));
      const n = mode === 'carbon' ? tiles.filter(t => t.classList.contains('cin')).length : tiles.length;
      L.count($('cvN'), n, 0, 600);
      $('cvMsg').innerHTML = mode === 'carbon'
        ? `탄소발자국만 검토하면 6건 중 <b>${tiles.length - n}건</b>을 놓쳐요. 찾는 2건도 파티클보드·우드칩의 열 밀림은 드러나지 않아요.`
        : `7개 영향범주를 모두 검토하면 <b>${tiles.length}건</b>이 모두 드러나요. 추가로 찾은 4건은 물발자국·오존층영향 칸에 있어요.`;
    };
    box.querySelectorAll('[data-cv]').forEach(b => b.addEventListener('click', () => set(b.dataset.cv, true)));
    set('carbon');
    // 처음 화면에 들어오면 잠시 뒤 한 번 자동으로 전환해 보여 준다
    L.onView(box, () => setTimeout(() => { if (auto) set('all'); }, L.reduce ? 0 : 1800));
  }

  /* ---------- 예 1: 전선 무게 바꾸기 ---------- */
  function wireSlider() {
    const s = $('wireG'); if (!s || !W1) return;
    const draw = () => {
      const g = +s.value / 1000, rest = 2 - g, rw = rest * W1.med;
      const A = g * W1.wire + rw, B = g * W1.pvc + rw, share = g * W1.wire / A * 100, ratio = A / B;
      $('wireGv').textContent = s.value; s.style.setProperty('--p', ((s.value - 1) / 99 * 100) + '%');
      $('ex1A').style.setProperty('--w', '100%'); $('ex1B').style.setProperty('--w', Math.max(0.4, B / A * 100) + '%');
      $('ex1At').textContent = vol(A); $('ex1Bt').textContent = vol(B);
      $('ex1S').style.width = share + '%'; $('ex1St').textContent = share.toFixed(1) + '%';
      const r = ratio >= 100 ? (Math.round(ratio / 10) * 10).toLocaleString('ko-KR') : Math.round(ratio).toLocaleString('ko-KR');
      $('ex1R').innerHTML = `전선 ${s.value}g의 계수 선택만으로 제품 물발자국이 <b>약 ${r}배</b> 달라져요.`;
    };
    s.addEventListener('input', draw); draw();
  }

  /* ---------- 계산 예시의 막대 ---------- */
  const exBars = rows => {
    const mx = Math.max(...rows.map(r => r.v));
    return `<div class="exbars">${rows.map(r => `<div class="exb${r.hi ? ' hi' : ''}"><span>${r.label}</span><div class="exb-t"><i style="--w:${Math.max(0.4, r.v / mx * 100)}%"></i></div><b>${r.text}</b></div>`).join('')}</div>`;
  };
  const vol = m3 => (m3 >= 1 ? `${(Math.round(m3 * 10) / 10).toLocaleString('ko-KR')}m³ (약 ${Math.round(m3).toLocaleString('ko-KR')}톤)` : m3 >= 0.001 ? `${(Math.round(m3 * 1e4) / 10).toLocaleString('ko-KR')}L` : `${(Math.round(m3 * 1e5) / 100).toLocaleString('ko-KR')}L`);

  let W1 = null;
  function build() {
    const rv = RES.review, rs = RES.review_sensitivity, nb = RES.carbon_water_without_basic_chem;
    const w = CAP('물'), a = CAP('산성');
    const wire = rv.extreme.find(x => x.name.startsWith('기기선')), sand = rv.extreme.find(x => x.name === '하천모래');
    const wireRow = POOL.find(r => r.name.startsWith('기기선')), pvcRow = POOL.find(r => r.name === 'PVC 전선');
    const pvc = pvcRow.v[4], fineAgg = POOL.find(r => r.name === '순환 잔골재').v[4];
    const wMed = wire.value / wire.times_median;
    const pairNames = new Set(rv.same_pairs.flatMap(p => [p.a, p.b]));
    const sharedExtra = rv.shared_values.filter(g => !g.items.every(it => pairNames.has(it.name)));
    const pcb = POOL.filter(r => r.v[4] != null).sort((x, y) => y.v[4] - x.v[4])[1];
    const wireX = Math.round(wire.value / pvc / 1e4), sandX = Math.round(fineAgg / sand.value / 100) * 100;
    const cOnlyN = D.filter(r => r.v[0] != null && r.v.filter(v => v != null).length === 1).length;
    const unitN = new Set(D.filter(r => r.stage === '원료 및 에너지 생산').map(r => r.unit)).size;

    // 산정 예시 1: 원료 2kg 중 전선 20g인 가상의 소형 가전 / 예시 2: 잔골재 800kg
    const ex1Share = 0.02 * wire.value / (0.02 * wire.value + 1.98 * wMed) * 100;
    const kgAgg = 800, ex2S = kgAgg * sand.value, ex2F = kgAgg * fineAgg;

    const IMPACTS = [
      ['탄소발자국', '온실가스 배출 (kg CO₂ eq)'], ['물발자국', '물 사용 (m³ H₂O eq)'], ['자원발자국', '광물·화석 자원 소모 (kg Sb eq)'],
      ['산성비', '산성화 물질 배출 (kg SO₂ eq)'], ['부영양화', '수계 영양염 과잉 (kg PO₄³⁻ eq)'], ['광화학스모그', '지표 오존 생성 (kg C₂H₄ eq)'], ['오존층영향', '성층권 오존 파괴 (kg CFC-11 eq)']
    ];
    const decisions = [
      ['리포트의 중심', '계수 점검을 주제로, 영향범주 비교는 보조 근거로 뒀어요', '평가계수는 투입량에 그대로 곱하는 값이라, 하나만 틀려도 제품 산정 결과가 통째로 바뀌어요. 원료 계수끼리의 상관보다 실무에 직접 쓰이는 결과예요.', '처음에는 탄소발자국–물발자국 비교가 주제였어요. 계수 수준의 상관이라 “제품 단위에서는?”이라는 질문에 답하기 어려웠어요.'],
      ['6건의 순서', '입력 오류 가능성과 산정 결과에 미치는 영향으로 정했어요', '성질이 전혀 다른 납·염소의 값이 모두 일치하는 건 우연으로 보기 어려워요. 기기선은 오류일 경우 결과를 수천 배 바꿔요. 공정 특성으로 설명될 수 있는 값(불소 화합물의 오존층영향 등)은 뒤에 뒀어요.', '발견 순서대로 나열하면 중요도가 낮은 값이 앞에 와요.'],
      ['6건의 처리', '오류로 단정하지 않고, 분석에서도 제외하지 않았어요', '산정 근거를 확인하기 전에는 오류 여부를 알 수 없어요. 대신 6건을 제외한 결과를 따로 계산해 비교했어요.', '임의로 제외하거나 수정하면 원자료를 변형한 분석이 돼요.'],
      ['1만 배 기준', '영향범주 중앙값의 1만 배 이상, 1만분의 1 이하만 골랐어요', `같은 범주 안에서도 수천 배 차이는 흔해요. 물발자국 2위인 ${pcb.name}도 중앙값의 약 ${Math.round(pcb.v[4] / wMed / 100) * 100}배예요.`, '1천 배로 낮추면 공정 특성상 원래 큰 값까지 포함돼요.']
    ];
    const chapters = [['c1', '데이터'], ['c2', '점검 방법'], ['c3', '확인이 필요한 계수 6건'], ['c4', '탄소발자국만 보면'], ['c5', '산정 결과에 미치는 영향'], ['c6', '결과 확인과 한계'], ['c7', '분석 판단 기록']];
    const steps = [
      [0, '탄소발자국 순으로 정렬', `원료 ${POOL.length}종을 탄소발자국 순위로 배치했어요. 다른 영향범주의 순위가 같다면 모든 점이 대각선 위에 놓여요.`],
      [1, '세로축을 물발자국으로', `점이 넓게 흩어져요. 순위상관 ρ는 <mark>${CI('물').rho.toFixed(2)}</mark>로, 두 범주는 거의 비례하지 않아요(1: 순위 일치, 0: 무관).`],
      [4, `물발자국 상위 ${w['다른영향상위']}종 중 ${w['함께상위']}종만 탄소발자국도 상위`, `<mark class="m-got">${w['함께상위']}종</mark>은 두 범주 모두 상위 20%이고, <mark class="m-miss">${w['빠진']}종</mark>은 탄소발자국 기준으로는 드러나지 않아요.<small>두 범주가 무관해도 약 20%(7종)는 우연히 겹쳐요.</small>`],
      [6, '산성비는 탄소발자국에 비례해요', `산성비 상위 ${a['다른영향상위']}종 중 <mark>${a['함께상위']}종</mark>이 탄소발자국도 상위예요. 연소 공정이 두 범주에 함께 기여하기 때문으로 보여요.<span class="slens"><em>다른 범주</em>${LENSES.map(k => `<button type="button" data-slens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('')}</span>`]
    ];
    const leadPair = rv.same_pairs.find(p => [p.a, p.b].includes('납'));
    // 6건이 어느 영향범주에 있는지 (same: 다른 원료와 값 일치, odd: 자릿수 이상·열 밀림)
    const CVK = [['탄소', '탄소'], ['자원', '자원'], ['산성', '산성비'], ['부영', '부영양'], ['물', '물'], ['스모그', '스모그'], ['오존', '오존층']];
    const CVF = [
      { n: 1, t: '납·염소', s: '5개 범주 값 일치', same: ['탄소', '자원', '산성', '부영', '물'], odd: [] },
      { n: 2, t: '기기선', s: `물발자국이 PVC 전선의 약 ${wireX}만 배`, same: [], odd: ['물'] },
      { n: 3, t: '파티클보드·우드칩', s: '오존층영향↔산성비 열 밀림', same: ['탄소', '자원', '부영', '스모그'], odd: ['오존', '산성'], part: true },
      { n: 4, t: '스테인리스강·탄소강, 저항 4종', s: '물발자국 값 일치', same: ['물'], odd: [] },
      { n: 5, t: '오존층영향 상위 4종', s: '1kg당 0.001 kg CFC-11 eq 이상', same: [], odd: ['오존'] },
      { n: 6, t: '하천모래', s: `물발자국이 순환 잔골재의 약 ${sandX.toLocaleString('ko-KR')}분의 1`, same: [], odd: ['물'] }
    ].map(f => ({ ...f, has: [...f.same, ...f.odd] }));
    W1 = { wire: wire.value, pvc, med: wMed };

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <div class="hero-copy">
          <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}건 점검</p>
          <h1><span class="ln">평가계수 ${D.length}건 중</span><span class="ln">입력 오류가 의심되는 <em class="hn">6건</em></span></h1>
          <p class="lead">평가계수는 환경성적표지 산정 때 원료·에너지 투입량에 곱하는 배경 데이터예요. 공개된 ${D.length}건을 전수 점검한 결과, <b>서로 다른 원료의 값이 일치</b>하거나 <b>동종 원료보다 100만 배 이상 큰 값</b>이 있었어요. 이런 계수 하나가 제품 산정 결과를 좌우할 수 있어요.</p>
          <p class="scope">발행 기관에 산정 근거를 확인하기 전이라 오류로 단정하지는 않았어요.</p>
        </div>
        <figure class="hero-fig">
          <figcaption>납과 염소, 1kg당 환경영향</figcaption>
          <div class="hero-cmp">${pairTable(leadPair)}</div>
          <p class="hero-note"><b>금속(납)과 기체(염소)</b>의 5개 영향범주 값이 유효숫자 아홉 자리까지 일치해요. 398건 중 이런 쌍은 하나뿐이에요.</p>
        </figure>
      </div>
      <dl class="sum">
        <div><dt>값이 일치하는 원료</dt><dd>납·염소는 5개 범주가 모두 같고, 파티클보드·우드칩은 같은 값이 서로 다른 열에 들어가 있어요.</dd></div>
        <div><dt>자릿수 이상</dt><dd>기기선의 물발자국은 1kg당 ${Math.round(wire.value)}m³로, PVC 전선의 약 ${wireX}만 배예요.</dd></div>
        <div><dt>산정 결과에 미치는 영향</dt><dd>원료 2kg인 가전에 기기선 20g만 들어가도 제품 물발자국의 ${ex1Share.toFixed(1)}%가 이 계수에서 나와요.</dd></div>
      </dl>
      <a class="cue" href="#c1" data-go="c1">분석 과정 보기</a>
    </section>

    <div class="doc">
      <nav class="rail" aria-label="리포트 순서"><ol>${chapters.map(([id, t], i) => `<li><a href="#${id}" data-go="${id}"><span>${i + 1}</span>${t}</a></li>`).join('')}</ol></nav>
      <div class="chapters">

      <section class="ch" id="c1"><header><span class="chno">1</span><h2>데이터</h2></header>
        <p class="lead">환경성적표지는 제품 전과정의 환경영향을 7개 범주로 계량해 공개하는 제도예요. <b>기준치를 넘어야 받는 인증이 아니라, 산정 결과를 제3자 검증 후 공개하는 제도</b>예요. 평가계수는 이 산정에 쓰는 배경 데이터로, 원료 1kg·전기 1kWh 같은 기준량당 환경영향을 정리한 값이에요. <b>계수가 틀리면 산정 결과도 그만큼 틀려요.</b></p>
        <div class="impacts">${IMPACTS.map(([n, d]) => `<div><b>${n}</b><span>${d}</span></div>`).join('')}</div>
        <div class="data-grid two-col">
          <table class="src"><tbody>
            <tr><th>자료</th><td>한국환경산업기술원 환경성적표지 평가계수</td></tr>
            <tr><th>기준일</th><td>2021-08-02 (배포 파일 기준)</td></tr>
            <tr><th>규모</th><td>${D.length}건 × 영향범주 7개, CSV</td></tr>
            <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(2026-10-19 확인)</span></td></tr>
            <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">공공데이터포털 15120968</a></td></tr>
          </tbody></table>
          <div class="facts"><div><b>${cOnlyN}건</b><span>탄소발자국만 있고 나머지 6개 범주는 빈칸 (연료 사용, 화학반응공정 등)</span></div><div><b>${unitN}종</b><span>원료 단계 안에 섞인 기준 단위 (kg, ea, MJ, kWh 등)</span></div></div>
        </div>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>점검 방법</h2></header>
        <p class="lead">탄소발자국과 다른 영향범주를 비교하던 중(4장) <b>납과 염소의 값이 모두 같다는 것</b>을 발견했어요. 같은 문제가 더 있는지 ${D.length}건 전체에 네 가지 기준을 적용했어요.</p>
        <ol class="methods">
          <li><b>다중 범주 일치</b><p>서로 다른 원료의 3개 이상 범주 값이 소수점 끝자리까지 같은 경우</p><strong><span data-n="${rv.same_pairs.length}">0</span>쌍</strong></li>
          <li><b>단일 범주 일치</b><p>한 범주의 값이 다른 원료와 같은 경우 (위 두 쌍 제외)</p><strong><span data-n="${sharedExtra.length}">0</span>묶음</strong></li>
          <li><b>자릿수 이상</b><p>범주 중앙값의 1만 배 이상 또는 1만분의 1 이하</p><strong><span data-n="${rv.extreme.length}">0</span>건</strong></li>
          <li><b>오존층영향 고값</b><p>1kg당 0.001 kg CFC-11 eq 이상 (값이 있는 ${rv.ozone_n}건 중)</p><strong><span data-n="${rv.ozone_hi.length}">0</span>건</strong></li>
        </ol>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>확인이 필요한 계수 6건</h2></header>
        <p class="lead">입력 오류 가능성과 산정 결과에 미치는 영향이 큰 순서예요. <b>1~3번은 입력 오류의 흔적이 뚜렷하고</b>, 4~6번은 다른 설명의 여지도 있어요.</p>

        <article class="flag f1"><header><span class="rank">1</span><div><h3>납과 염소: 5개 범주 값이 모두 일치</h3><p>금속과 기체로 생산 공정이 전혀 다른데, <b>값이 있는 5개 범주가 유효숫자 아홉 자리까지 같아요.</b> ${D.length}건 중 유일한 사례예요. <em class="warn">한쪽 값이 다른 쪽에 복사됐을 가능성이 커요.</em></p></div></header>
          <div id="pairLead"></div></article>

        <article class="flag f2"><header><span class="rank">2</span><div><h3>기기선: 물발자국이 PVC 전선의 약 ${wireX}만 배</h3><p>기기선(UL 1007/1569) 1kg당 물발자국이 <b>${Math.round(wire.value)}m³</b>로, PVC 전선(${L.fmt(pvc)}m³)과 비교하면 자릿수 자체가 달라요. 다른 범주는 두 전선이 비슷해요(탄소발자국 ${wireRow.v[0]} 대 ${pvcRow.v[0].toFixed(2)}). 또 다른 범주 값은 ${wireRow.v[0]}, ${wireRow.v[1]}처럼 유효숫자 세 자리인데 물발자국만 ${wire.value}예요. <em class="warn">이 열만 다른 출처이거나 단위 환산 오류일 수 있어요.</em></p></div></header></article>

        <article class="flag f3"><header><span class="rank">3</span><div><h3>파티클보드·우드칩: 값이 인접 열로 밀린 흔적</h3><p>두 목재 원료는 4개 범주 값이 같아 공통 데이터를 쓴 것으로 보여요. 문제는 <b>파티클보드의 오존층영향과 우드칩의 산성비가 0.000999692로 같다는 점</b>이에요. 서로 다른 범주의 값이 우연히 일치하기는 어려워요. <em class="warn">입력 중 열이 밀렸을 가능성이 높아요.</em> 이 값은 오존층영향 ${rv.ozone_n}건 중 5위로, 상위 4건이 모두 불소 화합물·잉크라는 점에서도 목재 값으로 보기 어려워요.</p></div></header>
          <div id="pairWood"></div></article>

        <div class="two flag-two">
          <article class="flag f4"><header><span class="rank">4</span><div><h3>물발자국 값이 일치하는 원료</h3><p>물발자국 값이 서로 같은 원료가 5묶음 있어요. 폴리부타디엔과 그 고무처럼 같은 계열은 공통 데이터로 설명되지만, 두 묶음은 확인이 필요해요(표에서 강조).</p>
            <ul class="fl-list"><li><b>스테인리스강 = 탄소강</b> 스테인리스강은 크롬·니켈 합금이라 일반적으로 탄소강보다 공정이 복잡한데 값이 같아요.</li><li><b>저항 4종</b> 금속막·산화금속막·탄소막 등 저항막 재료가 다른데 네 값이 모두 같아요.</li></ul></div></header>
            <div id="shared"></div></article>
          <div>
            <article class="flag f5"><header><span class="rank">5</span><div><h3>오존층영향 고값 4건</h3><p>오존층영향 값 ${rv.ozone_n}건의 범위는 약 ${Math.round(rv.ozone_range[1] / rv.ozone_range[0] / 1e6)}00만 배예요. 불소·황 화합물은 생산 과정에서 오존층 파괴 물질이 배출될 수 있어 판단을 보류했고, 옵셋잉크는 확인이 필요해요.</p></div></header>
              <div id="ozone"></div></article>
            <article class="flag f6"><header><span class="rank">6</span><div><h3>하천모래: 물발자국이 지나치게 작음</h3><p>1kg당 ${L.fmt(sand.value)}m³로, 순환 잔골재(${L.fmt(fineAgg)}m³)의 약 ${sandX.toLocaleString('ko-KR')}분의 1이에요. 값이 있는 범주도 탄소발자국·물발자국 둘뿐이에요.</p></div></header></article>
          </div>
        </div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>탄소발자국만 보면</h2></header>
        <p class="lead">저탄소제품 인증을 비롯해 실무의 관심은 탄소발자국에 쏠려 있어요. 그렇다면 탄소발자국만 검토해도 위 6건을 찾을 수 있을까요? <b>6건 중 4건은 탄소발자국이 아닌 범주에 있어요.</b></p>
        <div class="cview carbon" id="cview">
          <div class="cv-ctl">
            <div class="seg" role="group" aria-label="보기 전환"><button type="button" data-cv="carbon" aria-pressed="true">탄소발자국만 검토</button><button type="button" data-cv="all" aria-pressed="false">7개 범주 모두 검토</button></div>
            <div class="cv-count"><span>찾은 건수</span><b id="cvN">2</b><span>/ 6건</span></div>
          </div>
          <div class="cv-key"><span><i class="k-same">=</i>다른 원료와 값 일치</span><span><i class="k-odd">!</i>자릿수 이상·열 밀림</span><span><i class="k-ok"></i>이상 없음 또는 빈칸</span></div>
          <div class="cv-grid">${CVF.map((f, i) => `<article class="cv-t${f.has.includes('탄소') ? ' cin' : ''}" style="--i:${i}"><span class="cv-badge found">발견</span><span class="cv-badge miss">놓침</span><header><span class="rank">${f.n}</span><div><h4>${f.t}</h4><p>${f.s}</p></div></header>
            <div class="strip">${CVK.map(([k, lb]) => `<i data-k="${k}" class="${f.same.includes(k) ? 'same' : f.odd.includes(k) ? 'odd' : ''}"><b>${f.same.includes(k) ? '=' : f.odd.includes(k) ? '!' : ''}</b><em>${lb}</em></i>`).join('')}</div>
            ${f.part ? `<small class="cv-part">탄소발자국 일치는 보이지만 열 밀림은 안 보여요</small>` : ''}</article>`).join('')}</div>
          <p class="cv-msg" id="cvMsg"></p>
        </div>
        <h3 class="sub">왜 탄소발자국으로 대신할 수 없나요</h3>
        <p class="sub-lead">계수 수준에서 탄소발자국과 다른 범주가 함께 움직이는지 원료 ${POOL.length}종으로 확인했어요. 산성비·자원발자국은 비례했지만, <b>물발자국은 거의 따로 움직였어요.</b></p>
        <div class="story">
          <div class="st-fig"><div class="st-sticky"><figure class="plotcard" id="stPlot"></figure><div class="meter" id="stMeter"></div></div></div>
          <div class="st-steps">${steps.map(([code, h, t], i) => `<article class="step" data-step="${code}"><span class="sn">${i + 1} / ${steps.length}</span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
        </div>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>산정 결과에 미치는 영향</h2></header>
        <p class="lead">위 계수를 그대로 쓰면 제품 산정 결과가 얼마나 달라지는지 가상의 제품 두 개로 계산했어요. 투입량은 설명을 위한 가정이에요.</p>
        <div class="examples">
          <article class="ex"><h3>예 1. 전선이 들어간 2kg 가전</h3>
            <p>전선 외 원료는 물발자국 중앙값(1kg당 ${L.fmt(wMed)}m³)을 적용했어요. <b>막대로 전선 투입량을 바꿔 볼 수 있어요.</b></p>
            <div class="wslider"><label for="wireG">전선 투입량</label><input type="range" id="wireG" min="1" max="100" step="1" value="20"><output><b id="wireGv">20</b>g</output></div>
            <div class="exbars" id="ex1Bars"><div class="exb hi"><span>기기선 계수 적용</span><div class="exb-t"><i id="ex1A"></i></div><b id="ex1At"></b></div><div class="exb"><span>PVC 전선 계수 적용</span><div class="exb-t"><i id="ex1B"></i></div><b id="ex1Bt"></b></div></div>
            <div class="share"><div class="share-t"><i id="ex1S"></i></div><span>기기선 계수 적용 시 전선의 기여율 <b id="ex1St"></b></span></div>
            <p class="ex-r" id="ex1R"></p></article>
          <article class="ex"><h3>예 2. 콘크리트 잔골재 ${kgAgg}kg</h3>
            <p>천연 모래와 순환 골재의 물발자국을 비교하는 상황이에요.</p>
            ${exBars([{ label: '순환 잔골재 계수 적용', v: ex2F, text: vol(ex2F), hi: true }, { label: '하천모래 계수 적용', v: ex2S, text: vol(ex2S) }])}
            <p class="ex-r">순환 골재가 <b>약 ${Math.round(ex2F / ex2S).toLocaleString('ko-KR')}배</b> 불리하게 계산돼요. 하천모래 값이 과소 입력된 것이라면 <b>재활용 원료가 실제보다 불리해 보여요.</b></p></article>
        </div>
        <p class="note">납·염소는 어느 쪽이 원래 값인지 알 수 없어 예시에서 뺐어요. 둘 중 하나를 쓰는 제품은 5개 범주 모두 다른 원료의 값으로 산정되고 있을 수 있어요.</p>

        <div class="checklist"><h3>시사점: 평가계수 적용 전 확인할 것</h3><ol>
          <li><b>기준 단위</b>1kg당인지, 1ea·1MJ·1m³당인지 확인해요. 같은 단계 안에서도 섞여 있어요.</li>
          <li><b>값 일치</b>다른 원료와 값이 같다면 대체 데이터인지 확인하고 출처를 기록해요.</li>
          <li><b>자릿수</b>동종 원료와 수천 배 이상 차이 나면 산정 근거를 확인해요.</li>
          <li><b>기여도 쏠림</b>결과 대부분이 한 원료에서 나오면 그 계수부터 재검토해요.</li>
          <li><b>전 범주 검토</b>탄소발자국만이 아니라 7개 범주 모두 같은 기준으로 점검해요.</li>
          <li><b>빈칸</b>‘해당없음’을 0으로 처리하지 않고, 별도 자료로 보완해요.</li></ol></div>
      </section>

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>결과 확인과 한계</h2></header>
        <p class="lead">이 분석의 주장은 세 가지예요. 각각의 근거, 확인 방법, 신뢰 수준을 정리했어요.</p>
        <div class="claims">
          <article class="claim"><span class="cl-no">주장 1</span><h3>입력 오류가 의심되는 계수가 있어요</h3>
            <dl><div><dt>근거</dt><dd>납·염소의 5개 범주 일치(${D.length}건 중 유일), 파티클보드·우드칩의 열 밀림 흔적</dd></div>
            <div><dt>확인 방법</dt><dd>눈에 띈 사례만이 아니라 네 가지 기준을 ${D.length}건 전체에 동일하게 적용</dd></div>
            <div><dt>신뢰 수준</dt><dd><span class="lv hi">높음</span> 공개 자료의 값 그대로라 재현 가능해요. 오류 확정은 발행 기관 확인이 필요해요.</dd></div></dl></article>
          <article class="claim"><span class="cl-no">주장 2</span><h3>탄소발자국만 검토하면 이상값을 놓쳐요</h3>
            <dl><div><dt>근거</dt><dd>6건 중 4건이 탄소발자국 외 범주에 있고, 물발자국과의 순위상관은 ρ ${CI('물').rho.toFixed(2)}</dd></div>
            <div><dt>확인 방법</dt><dd>부트스트랩 2,000회(ρ ${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}), 기초화학물질 제외(${nb.rho.toFixed(2)}), 6건 제외(${rs.strong['물소모'].rho.toFixed(2)})에서도 결론 동일</dd></div>
            <div><dt>신뢰 수준</dt><dd><span class="lv hi">높음</span> 원료 1kg당 계수에 한해서예요. 제품 단위는 아래 표를 보세요.</dd></div></dl></article>
          <article class="claim"><span class="cl-no">주장 3</span><h3>그대로 쓰면 산정 결과가 크게 바뀔 수 있어요</h3>
            <dl><div><dt>근거</dt><dd>가상 제품 계산에서 약 1,800배(전선), 약 1,400배(잔골재) 차이</dd></div>
            <div><dt>확인 방법</dt><dd>전선 투입량을 1~100g으로 바꿔도 결과 대부분이 전선 계수에서 발생</dd></div>
            <div><dt>신뢰 수준</dt><dd><span class="lv mid">중간</span> 계산은 확실하지만 투입량이 가정이라, 실제 차이는 제품마다 달라요.</dd></div></dl></article>
        </div>

        <h3 class="sub">이 분석으로 말할 수 없는 것</h3>
        <table class="tbl cant"><thead><tr><th>말할 수 없는 것</th><th>이유</th><th>확인하려면</th></tr></thead><tbody>
          <tr><td><b>6건이 실제 오류인지</b></td><td>배포 파일에는 계수별 산정 근거(기초 데이터셋, 환산 방법)가 없어요. 4~6번은 대체 데이터나 공정 특성으로 설명될 수도 있어요.</td><td>한국환경산업기술원에 산정 근거 문의</td></tr>
          <tr><td><b>실제 제품의 결과 변화</b></td><td>5장의 제품은 가정이에요. 영향은 해당 원료의 투입량에 따라 크게 달라져요.</td><td>실제 제품의 BOM으로 재계산</td></tr>
          <tr><td><b>제품 단위의 탄소–물 관계</b></td><td>제품 영향은 ‘투입량 × 계수’의 합이에요. 전기·연료 같은 공통 투입이 있어 제품 단위에서는 상관이 더 높아질 수 있어요.</td><td>동일 기능 제품들의 EPD 결과 비교</td></tr>
          <tr><td><b>원료 간 우열</b></td><td>1kg당 계수는 원료의 역할과 필요량이 달라 직접 비교할 수 없어요.</td><td>기능단위 기준 비교</td></tr>
          <tr><td><b>계수의 정확도와 현재성</b></td><td>불확도 정보가 없고, 2021년 8월 기준이에요.</td><td>최신 국가 LCI DB·작성지침 확인</td></tr>
        </tbody></table>
        <div class="next"><h3>다음 단계</h3><p>한국환경산업기술원에 6건의 산정 근거를 문의해 주장 1을 확정하고, 실제 제품 하나의 BOM으로 재계산해 주장 3의 가정을 실제 값으로 바꿀 계획이에요.</p></div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>분석 판단 기록</h2></header>
        <p class="lead">판단이 필요했던 지점마다 이유와 대안을 기록했어요. 영향범주 비교에 관한 판단은 <a href="#notes">방법·출처</a> 탭에 있어요.</p>
        <div class="dec">${decisions.map((d, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>
      </div>
    </div>`;

    story(); review();

    const links = [...document.querySelectorAll('.rail a')];
    document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', ev => { ev.preventDefault(); $(el.dataset.go).scrollIntoView({ behavior: L.reduce ? 'auto' : 'smooth', block: 'start' }); }));
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) links.forEach(x => x.classList.toggle('on', x.dataset.go === en.target.id)); }), { rootMargin: '-30% 0px -65% 0px' });
    chapters.forEach(([id]) => io.observe($(id)));
    const rail = document.querySelector('.rail');
    new IntersectionObserver(es => es.forEach(en => rail.classList.toggle('show', en.isIntersecting || en.boundingClientRect.top < 0)), { rootMargin: '0px 0px -60% 0px' }).observe(document.querySelector('.chapters'));
    document.querySelectorAll('.exbars').forEach(el => L.onView(el, () => el.classList.add('drawn')));
    document.querySelectorAll('.impacts > div').forEach((el, i) => el.style.setProperty('--d', i * 70 + 'ms'));
    reveal(); carbonView(); wireSlider();
  }
  L.tabs.report = { build, built: false };
})();
