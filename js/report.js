/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. 본문은 ‘~요’체. */
(function () {
  const { $, esc, POOL, D, RES, NAME, RKEY } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];
  const CUT = k => RES.cutoff_curve[RKEY[k]], cutAt = (k, q) => CUT(k).find(r => r.q === q);
  // 순위상관 ρ를 말로 바꾼다
  const relWord = r => (r >= 0.7 ? '비례해요' : r >= 0.4 ? '약하게 비례해요' : r > 0.1 ? '거의 비례하지 않아요' : '관계를 알 수 없어요');
  // 탄소발자국 순위로 이 영향의 순위를 짐작할 수 있나: 상위 10·20·30% 모두에서 절반 이상이 같은 원료면 ‘있다’, 모두 절반 미만이면 ‘어렵다’
  const ANSWER = { '잘 맞음': ['ok', '짐작할 수 있어요'], '기준에 따라 다름': ['mid', '일부만 가능해요'], '어긋남': ['no', '짐작하기 어려워요'] };
  const answer = k => ANSWER[RES.verdict[RKEY[k]]];

  /* ---------- 순위 비교 그래프 (스크롤에 따라 단계별로 바뀜) ---------- */
  const SW = 600, SH = 560, m = { l: 54, r: 16, t: 20, b: 50 }, iw = SW - m.l - m.r, ih = SH - m.t - m.b;
  const X = p => m.l + p / 100 * iw, Y = p => m.t + ih - p / 100 * ih;
  let lens = '물', step = 0;
  function story() {
    const grid = [0, 20, 40, 60, 80, 100];
    $('stPlot').innerHTML = `<svg viewBox="0 0 ${SW} ${SH}" role="img" aria-labelledby="stT"><title id="stT">재료별 탄소발자국 순위와 다른 영향 순위</title>
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
      $('stMeter').innerHTML = `<span class="mt-l">${L.josa(NAME[lens], '이', '가')} 큰 재료</span><b>${cap['다른영향상위']}종</b>
        <span class="mt-got"><i></i>탄소발자국도 큼 <b>${cap['함께상위']}종</b></span><span class="mt-miss"><i></i>탄소발자국은 크지 않음 <b>${cap['빠진']}종</b></span>`;
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

  /* ---------- 영향범주별 결과표 ---------- */
  function scorecard() {
    const rows = [...LENSES].sort((a, b) => CI(b).rho - CI(a).rho);
    $('score').innerHTML = `<div class="sc-h"><span>영향범주</span><span>탄소발자국과 함께 커지는 정도<small>1이면 순서가 똑같고 0이면 관계가 없어요</small></span><span>이 영향이 큰 재료 중 탄소발자국도 큰 재료<small>상위 20% 기준, 세로선은 관계가 없어도 우연히 나오는 20%</small></span><span>상위 10·20·30%로 바꿔 봐도</span><span>탄소발자국만 보고 짐작하면</span></div>` +
      rows.map(k => {
        const ci = CI(k), c = CAP(k), [vc, vt] = answer(k);
        return `<div class="sc-r ${vc}"><b class="sc-n">${NAME[k]}</b>
          <div class="rho"><div class="track"><i class="ci" style="left:${ci.lo * 100}%;width:${(ci.hi - ci.lo) * 100}%"></i><i class="pt" style="left:${ci.rho * 100}%"></i></div><span><b>${ci.rho.toFixed(2)}</b> ${relWord(ci.rho)}</span></div>
          <div class="capb"><div class="track"><i class="fill" style="--v:${c['포착률']}%"></i><i class="ci" style="left:${c.lo}%;width:${c.hi - c.lo}%"></i><i class="base"></i></div><span><b>${c['다른영향상위']}종 중 ${c['함께상위']}종</b> (${c['포착률']}%)</span></div>
          <div class="tri">${[10, 20, 30].map(q => { const r = cutAt(k, q); return `<span class="${r.rate >= 50 ? 'hi' : 'lo'}" title="상위 ${q}%: ${r.top}종 중 ${r.both}종">${r.rate}%</span>`; }).join('')}</div>
          <span class="tag ${vc}">${vt}</span></div>`;
      }).join('');
    L.onView($('score'), () => $('score').classList.add('drawn'));
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
      return `<tr class="${same ? 'same' : ''}${sh ? ' shift-row' : ''}" style="--i:${i}"><td>${disp(k)}</td><td class="num${shiftA.has(k) ? ' shift' : ''}">${fx(x)}</td><td class="num${shiftB.has(k) ? ' shift' : ''}">${fx(y)}</td><td>${same ? '<b class="eq">똑같음</b>' : sh ? '<b class="eq sh">같은 숫자, 다른 칸</b>' : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
    if (!shiftA.size) return tbl;
    const ka = [...shiftA][0], kb = [...shiftB][0];
    return tbl + `<div class="shift-call"><div><span>${esc(p.a)}</span><b>${disp(ka)}</b><strong>${fx(p.a_values[ka])}</strong></div><i aria-hidden="true">=</i><div><span>${esc(p.b)}</span><b>${disp(kb)}</b><strong>${fx(p.b_values[kb])}</strong></div>
      <p>서로 다른 항목인데 숫자가 열 자리까지 똑같아요. 게다가 두 재료 모두 이 두 칸 중 한 칸은 숫자가 있고 다른 한 칸은 비어 있어요. 엑셀에 옮겨 적다가 숫자가 한 칸 옆으로 밀려 들어간 것으로 보는 게 자연스러워요.</p></div>`;
  }
  function review() {
    const rv = RES.review, f = L.fmt;
    $('pairLead').innerHTML = pairTable(rv.same_pairs.find(p => [p.a, p.b].includes('납')));
    $('pairWood').innerHTML = pairTable(rv.same_pairs.find(p => [p.a, p.b].includes('우드칩')));
    const pairNames = new Set(rv.same_pairs.flatMap(p => [p.a, p.b]));
    const extra = rv.shared_values.filter(g => !g.items.every(it => pairNames.has(it.name)));
    $('shared').innerHTML = `<table class="tbl"><thead><tr><th>물발자국 숫자가 똑같은 재료</th><th class="num">값 (m³/kg)</th></tr></thead><tbody>${extra.map(g => `<tr><td>${g.items.map(it => `<b>${esc(it.name.trim())}</b> <small class="muted">${esc(it.cat)}</small>`).join('<br>')}</td><td class="num">${f(g.value)}</td></tr>`).join('')}</tbody></table>`;
    $('ozone').innerHTML = `<table class="tbl"><thead><tr><th>재료</th><th class="num">오존층영향 (kg CFC-11 eq/kg)</th></tr></thead><tbody>${rv.ozone_hi.map(o => `<tr><td><b>${esc(o.name)}</b></td><td class="num">${f(o.value)}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- 스크롤 등장 효과 ---------- */
  function reveal() {
    const SEL = '.ch > header, .ch > .lead, .impacts, .ch > .hint, .ch > .note, .ch > .sub, .ch > .sub-lead, .ch > .concl, .cview, .methods li, .flag, .ex, .checklist, .checklist li, .ck, .yesno > div, .next, .dec details, .formula, .score, .sc-why, .more-box, .data-grid > *, .story';
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
        ? `탄소발자국만 보면 6건 중 <b>${tiles.length - n}건</b>을 놓쳐요. 찾은 2건도 파티클보드·우드칩의 칸 밀림까지는 보이지 않아요.`
        : `7가지를 모두 보면 <b>${tiles.length}건</b>이 다 드러나요. 새로 찾은 4건은 물발자국과 오존층영향 칸에 있었어요.`;
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
      $('ex1R').innerHTML = `전선 ${s.value}g의 숫자 하나 때문에 제품의 물발자국이 <b>약 ${r}배</b> 달라져요. 1g만 넣어도 결과 대부분이 전선에서 나와요.`;
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
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n;
    const ozMiss = 100 - Math.round(L.coverage(POOL, 6) * 100), ozN = L.has(POOL, 6).length;
    const nb = RES.carbon_water_without_basic_chem;
    const w = CAP('물'), a = CAP('산성');
    const basicShare = Math.round(POOL.filter(r => r.category === '기초화학물질').length / POOL.length * 100);
    const sel = RES.selection, rv = RES.review, rs = RES.review_sensitivity;
    const wire = rv.extreme.find(x => x.name.startsWith('기기선')), sand = rv.extreme.find(x => x.name === '하천모래');
    const wireRow = POOL.find(r => r.name.startsWith('기기선')), pvcRow = POOL.find(r => r.name === 'PVC 전선');
    const pvc = pvcRow.v[4], fineAgg = POOL.find(r => r.name === '순환 잔골재').v[4];
    const wMed = wire.value / wire.times_median;
    const pairNames = new Set(rv.same_pairs.flatMap(p => [p.a, p.b]));
    const sharedExtra = rv.shared_values.filter(g => !g.items.every(it => pairNames.has(it.name)));
    const pcb = POOL.filter(r => r.v[4] != null).sort((x, y) => y.v[4] - x.v[4])[1];
    const wireX = Math.round(wire.value / pvc / 1e4), sandX = Math.round(fineAgg / sand.value / 100) * 100;

    // 계산 예시 1: 재료 2kg 중 전선 20g인 가상의 소형 가전
    const g = 0.02, rest = 1.98, restW = rest * wMed;
    const ex1A = g * wire.value + restW, ex1Share = g * wire.value / ex1A * 100;
    // 계산 예시 2: 잔골재 800kg
    const kgAgg = 800, ex2S = kgAgg * sand.value, ex2F = kgAgg * fineAgg;

    // 단계별 개요 (전체 398건)
    const STAGE_PLAIN = { '원료 및 에너지 생산': '재료·에너지를 만들 때', '연료원별 사용': '연료를 태울 때', '화학반응공정': '화학 반응이 일어날 때', '폐기물 처리': '버리고 처리할 때', '수송': '실어 나를 때' };
    const stageRows = L.STAGES.map(st => {
      const rows = D.filter(r => r.stage === st);
      return { st, n: rows.length, units: new Set(rows.map(r => r.unit)).size, all7: rows.filter(r => r.v.every(v => v != null)).length, cOnly: rows.filter(r => r.v[0] != null && r.v.filter(v => v != null).length === 1).length };
    });
    const IMPACTS = [
      ['탄소발자국', '온실가스를 얼마나 내보내는지'], ['물발자국', '물을 얼마나 쓰는지'], ['자원발자국', '광물·화석 자원을 얼마나 쓰는지'],
      ['산성비', '산성비를 만드는 물질을 얼마나 내보내는지'], ['부영양화', '강과 호수에 녹조를 일으키는 물질'], ['광화학스모그', '여름철 스모그를 만드는 물질'], ['오존층영향', '오존층을 파괴하는 물질']
    ];
    const decisions = [
      ['리포트의 중심', '의심스러운 숫자 찾기를 앞에, 영향 비교를 뒤에 뒀어요', '평가계수는 컨설턴트가 재료 사용량에 그대로 곱해서 쓰는 숫자예요. 하나만 틀려도 제품 결과가 통째로 바뀌어요. 재료끼리 비교하는 것보다 이쪽이 실무에 바로 쓰여요.', '처음에는 탄소발자국과 물발자국 비교를 주제로 삼았어요. 그런데 재료 숫자끼리의 관계라 “그래서 제품은요?”라는 질문에 답하기 어려웠어요.'],
      ['6건의 순서', '실수일 가능성과 계산에 주는 영향을 함께 보고 정했어요', '납·염소처럼 전혀 다른 재료의 숫자가 모두 같으면 우연으로 보기 어려워요. 기기선은 실수라면 제품 결과를 수천 배 바꿔요. 불소 화합물처럼 만드는 과정을 생각하면 설명이 되는 숫자는 뒤에 뒀어요.', '찾은 순서대로 늘어놓으면 덜 중요한 숫자가 앞에 와요.'],
      ['6건의 처리', '오류라고 쓰지 않고, 분석에서도 빼지 않았어요', '원본 자료와 맞춰 보기 전에는 실수인지 알 수 없어요. 대신 이 숫자들을 뺀 결과를 따로 계산해 비교했어요.', '마음대로 빼거나 고치면 원자료를 바꾼 분석이 돼요.'],
      ['1만 배 기준', '중앙값의 1만 배 이상, 1만분의 1 이하만 골랐어요', `같은 항목 안에서도 수천 배 차이는 흔해요. 물발자국 2위인 ${pcb.name}도 중앙값의 약 ${Math.round(pcb.v[4] / wMed / 100) * 100}배예요. 그보다 확실히 튀는 숫자만 고르려고 1만 배로 정했어요.`, '기준을 1천 배로 낮추면 원래 큰 게 자연스러운 숫자까지 섞여요.'],
      ['결론의 범위', '재료 1kg당 숫자에 대한 이야기로 한정했어요', '제품의 환경영향은 재료마다 ‘사용량 × 1kg당 숫자’를 더해서 계산해요. 이 자료에는 사용량이 없어서 제품끼리의 관계는 알 수 없어요. 4장의 제품 계산은 가상의 예예요.', '재료 숫자의 관계를 제품의 관계처럼 쓰게 돼요.'],
      ['비교 대상', '재료 단계의 1kg당 숫자 187종만 비교했어요', `단계마다 기준이 되는 양이 달라요. 재료 단계 ${nStage}건 중 ${nKg}건이 1kg당 숫자이고, 나머지는 1개당(${sel.stage_units.ea}건) 등이에요. 다이오드(1개당)와 트랜지스터(1kg당)를 한 줄에 세우면 재료가 아니라 단위가 순서를 정해요. 공업용수·상수는 재료가 아니라서 뺐고, 오존층영향은 ${POOL.length}종 중 ${ozN}종에만 숫자가 있어(${ozMiss}% 비어 있음) 비교에서 뺐어요.`, `공업용수·상수를 넣어도 탄소발자국–물발자국 관계(ρ)는 ${sel.rho_with_utility_water.toFixed(2)}로 비슷해요.`],
      ['비교 방법', '크기 대신 순서로, 두 숫자가 모두 있는 재료끼리 비교했어요', '같은 항목 안에서도 숫자가 수십만 배까지 차이 나요. 크기로 비교하면 큰 숫자 몇 개가 결과를 정해요. 또 숫자가 있는 재료 수가 항목마다 달라서(탄소발자국 187종, 물발자국 163종) 둘 다 있는 재료끼리 순서를 매겼어요. ‘해당없음’은 0으로 채우지 않았어요.', '평균을 쓰면 아주 큰 숫자 몇 개에 결과가 끌려가요.'],
      ['상위 20% 기준', '모든 항목에서 상위 재료가 30종 이상 되는 가장 작은 기준이에요', `30종이면 재료 1종이 바뀔 때 비율이 약 3%p 움직이지만, 15종이면 약 7%p씩 움직여요. 15% 기준이면 가장 작은 그룹이 ${RES.cutoff_min_top['15']}종, 10%면 ${RES.cutoff_min_top['10']}종이에요.`, '20% 하나만 보면 기준에 따라 결과가 달라지는 경우를 놓쳐요. 그래서 10·20·30%를 함께 봤어요.'],
      ['재료 종류 차이', '재료 종류별로, 가장 많은 종류를 빼고 다시 계산했어요', `기초화학물질을 빼도 탄소발자국–물발자국 관계(ρ)는 ${nb.rho.toFixed(2)}(${nb.n}종)였어요.`, '특정 재료 종류 때문에 생긴 결과였다면 결론이 바뀌었을 거예요.']
    ];
    const chapters = [['c1', '이 숫자표는 뭔가요'], ['c2', '어떻게 찾았나요'], ['c3', '의심스러운 숫자 6개'], ['c4', '결과가 얼마나 바뀔까요'], ['c5', '탄소만 보면 될까요'], ['c6', '결과 확인과 한계'], ['c7', '분석하며 내린 판단']];
    const steps = [
      [0, '탄소발자국 순서대로 줄 세우기', `점 하나가 재료 하나예요. 재료 ${POOL.length}종을 탄소발자국이 작은 것부터 큰 것까지 왼쪽에서 오른쪽으로 세웠어요. 다른 영향도 순서가 똑같다면 모든 점이 이 대각선 위에 놓여요.`],
      [1, '세로축을 물발자국으로 바꾸면', `점이 사방으로 흩어져요. 탄소발자국이 크다고 물발자국도 큰 건 아니라는 뜻이에요. 두 순서가 얼마나 같은지를 나타내는 숫자(ρ)는 <mark>${CI('물').rho.toFixed(2)}</mark>이에요. 1이면 순서가 똑같고, 0이면 아무 관계가 없어요.`],
      [4, `물을 많이 쓰는 ${w['다른영향상위']}종 중 탄소도 많은 건 ${w['함께상위']}종`, `위쪽 띠는 물발자국이 큰 재료(상위 20%), 오른쪽 띠는 탄소발자국이 큰 재료예요. 물발자국이 큰 ${w['다른영향상위']}종 중 <mark class="m-got">탄소발자국도 큰 재료는 ${w['함께상위']}종</mark>(진녹색)뿐이고, <mark class="m-miss">나머지 ${w['빠진']}종은 탄소발자국이 크지 않아요</mark>(주황색).<small>둘이 아무 관계가 없어도 20%(33종 중 7종 정도)는 우연히 겹쳐요.</small>`],
      [6, '산성비는 탄소발자국과 함께 움직여요', `산성비로 바꾸면 점이 대각선 근처에 모여요. 산성비가 큰 ${a['다른영향상위']}종 중 <mark>${a['함께상위']}종</mark>이 탄소발자국도 커요.<span class="slens"><em>다른 영향도 보기</em>${LENSES.map(k => `<button type="button" data-slens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('')}</span>`]
    ];
    const leadPair = rv.same_pairs.find(p => [p.a, p.b].includes('납'));
    // 6건이 어느 항목에 있는지 (same: 다른 재료와 숫자가 똑같음, odd: 자릿수가 튀거나 칸이 밀림)
    const CVK = [['탄소', '탄소'], ['자원', '자원'], ['산성', '산성비'], ['부영', '부영양'], ['물', '물'], ['스모그', '스모그'], ['오존', '오존층']];
    const CVF = [
      { n: 1, t: '납·염소', s: '다섯 가지 숫자가 모두 똑같아요', same: ['탄소', '자원', '산성', '부영', '물'], odd: [] },
      { n: 2, t: '기기선', s: `물발자국이 다른 전선의 약 ${wireX}만 배`, same: [], odd: ['물'] },
      { n: 3, t: '파티클보드·우드칩', s: '숫자가 옆 칸으로 밀렸어요', same: ['탄소', '자원', '부영', '스모그'], odd: ['오존', '산성'], part: true },
      { n: 4, t: '물발자국 숫자 공유', s: '다른 재료인데 숫자가 같아요', same: ['물'], odd: [] },
      { n: 5, t: '오존층영향이 큰 숫자', s: '1kg당 0.001 이상 4종', same: [], odd: ['오존'] },
      { n: 6, t: '하천모래', s: `물발자국이 비슷한 골재의 약 ${sandX.toLocaleString('ko-KR')}분의 1`, same: [], odd: ['물'] }
    ].map(f => ({ ...f, has: [...f.same, ...f.odd] }));
    W1 = { wire: wire.value, pvc, med: wMed };

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <div class="hero-copy">
          <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}개 점검</p>
          <h1><span class="ln">환경 계산에 쓰는 숫자표에서</span><span class="ln">의심스러운 숫자 <em class="hn">6개</em>를 찾았어요</span></h1>
          <p class="lead">제품이 환경에 주는 영향은 재료마다 정해진 숫자를 곱해서 계산해요. 음식 칼로리를 <b>재료별 칼로리표</b>로 계산하는 것과 비슷해요. 정부 기관이 공개한 이 숫자표 ${D.length}개를 하나하나 살펴봤더니, 전혀 다른 재료의 숫자가 똑같이 적혀 있거나 비슷한 재료보다 100만 배 넘게 큰 숫자가 있었어요.</p>
          <p class="scope">원본 자료와 맞춰 보기 전이라 오류라고 단정하지는 않았어요.</p>
        </div>
        <figure class="hero-fig">
          <figcaption>납과 염소를 1kg 만들 때 환경에 주는 영향</figcaption>
          <div class="hero-cmp">${pairTable(leadPair)}</div>
          <p class="hero-note"><b>납은 금속, 염소는 기체</b>인데 다섯 가지 숫자가 소수점 아홉 자리까지 똑같아요. 칼로리표에 소고기와 설탕의 칼로리가 똑같이 적혀 있는 셈이에요.</p>
        </figure>
      </div>
      <dl class="sum">
        <div><dt>복사한 것처럼 똑같은 숫자</dt><dd>납과 염소처럼 전혀 다른 재료인데 숫자가 같아요. 파티클보드와 우드칩은 숫자가 옆 칸으로 밀려 들어간 흔적도 있어요.</dd></div>
        <div><dt>자릿수가 튀는 숫자</dt><dd>한 전선(기기선)은 1kg을 만드는 데 물이 ${Math.round(wire.value)}톤 든다고 적혀 있어요. 다른 전선의 약 ${wireX}만 배예요.</dd></div>
        <div><dt>결과가 통째로 바뀌어요</dt><dd>2kg짜리 가전에 이 전선이 20g만 들어가도, 제품이 쓰는 물의 ${ex1Share.toFixed(1)}%가 이 전선에서 나온 것으로 계산돼요.</dd></div>
      </dl>
      <a class="cue" href="#c1" data-go="c1">자세히 보기</a>
    </section>

    <div class="doc">
      <nav class="rail" aria-label="리포트 순서"><ol>${chapters.map(([id, t], i) => `<li><a href="#${id}" data-go="${id}"><span>${i + 1}</span>${t}</a></li>`).join('')}</ol></nav>
      <div class="chapters">

      <section class="ch" id="c1"><header><span class="chno">1</span><h2>이 숫자표는 뭔가요</h2></header>
        <p class="lead">환경성적표지는 제품이 만들어지고 버려질 때까지 환경에 주는 영향을 7가지 숫자로 공개하는 제도예요. <b>기준을 넘어야 받는 인증이 아니라, 계산 결과를 검증받아 공개하는 제도</b>예요. 이 계산에 쓰는 기초 숫자가 평가계수예요. ‘재료 1kg을 만들면 온실가스가 얼마나 나오는지’ 같은 숫자를 미리 정리해 둔 표예요. 컨설턴트는 제품에 들어간 재료 양에 이 숫자를 곱해 결과를 내요. <b>표의 숫자가 틀리면 결과도 그만큼 틀려요.</b></p>
        <div class="impacts">${IMPACTS.map(([n, d]) => `<div><b>${n}</b><span>${d}</span></div>`).join('')}</div>
        <div class="data-grid two-col">
          <table class="src"><tbody>
            <tr><th>자료</th><td>한국환경산업기술원 환경성적표지 평가계수</td></tr>
            <tr><th>기준일</th><td>2021-08-02 (배포 파일 기준)</td></tr>
            <tr><th>규모</th><td>${D.length}개, 영향 7가지, CSV 파일</td></tr>
            <tr><th>이용 조건</th><td>제한 없음 <span class="muted">(2026-10-19 확인)</span></td></tr>
            <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">공공데이터포털에서 보기</a></td></tr>
          </tbody></table>
          <figure class="fig"><figcaption>언제 생기는 영향인지에 따라 나눠 보면</figcaption>
            <table class="tbl stages"><thead><tr><th>단계</th><th class="num">개수</th><th class="num">단위 종류</th><th class="num">7가지가 다 있음</th><th class="num">탄소발자국만 있음</th></tr></thead><tbody>
              ${stageRows.map(r => `<tr><td>${STAGE_PLAIN[r.st]}</td><td class="num"><b>${r.n}</b></td><td class="num">${r.units}</td><td class="num">${r.all7}</td><td class="num">${r.cOnly}</td></tr>`).join('')}
            </tbody></table>
            <p class="read">한 단계 안에서도 ‘1kg당’, ‘1개당’, ‘1MJ당’ 숫자가 섞여 있어요. 연료와 화학 반응 쪽은 대부분 탄소발자국만 있어요.</p></figure>
        </div>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>어떻게 찾았나요</h2></header>
        <p class="lead">처음에는 탄소발자국과 다른 영향을 비교하고 있었어요(5장). 그러다 <b>납과 염소의 숫자가 모두 똑같은 것</b>을 우연히 발견했고, 비슷한 문제가 더 있는지 ${D.length}개 전체를 네 가지 방법으로 훑었어요.</p>
        <ol class="methods">
          <li><b>통째로 똑같은 재료</b><p>서로 다른 재료인데 세 가지 이상 숫자가 소수점 끝자리까지 같은 경우</p><strong><span data-n="${rv.same_pairs.length}">0</span>쌍</strong></li>
          <li><b>한 항목만 똑같은 재료</b><p>한 가지 숫자가 다른 재료와 완전히 같은 경우 (위의 두 쌍은 빼고 셌어요)</p><strong><span data-n="${sharedExtra.length}">0</span>묶음</strong></li>
          <li><b>자릿수가 튀는 숫자</b><p>같은 항목의 중간값보다 1만 배 이상 크거나 1만분의 1 이하로 작은 경우</p><strong><span data-n="${rv.extreme.length}">0</span>개</strong></li>
          <li><b>오존층영향이 큰 숫자</b><p>오존층을 파괴하는 정도가 1kg당 0.001 이상인 경우 (숫자가 있는 ${rv.ozone_n}개 중)</p><strong><span data-n="${rv.ozone_hi.length}">0</span>개</strong></li>
        </ol>
        <p class="hint">찾은 숫자는 <b>실수일 가능성이 높고, 실수라면 결과를 크게 바꾸는 것</b>부터 순서를 매겼어요.</p>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>의심스러운 숫자 6개</h2></header>
        <p class="lead">아래 여섯 가지는 <b>원본 자료와 맞춰 볼 필요가 있어요.</b> 1~3번은 옮겨 적다 생긴 실수로 보이는 흔적이 뚜렷하고, 4~6번은 설명이 될 여지도 있어요.</p>

        <article class="flag f1"><header><span class="rank">1</span><div><h3>납과 염소의 숫자가 모두 똑같아요</h3><p>납은 금속이고 염소는 기체라서 만드는 방법이 전혀 달라요. 그런데 <b>숫자가 있는 다섯 가지가 소수점 아홉 자리까지 모두 같아요.</b> ${D.length}개 중 다섯 가지가 모두 같은 경우는 이 한 쌍뿐이에요. <em class="warn">한쪽 숫자를 다른 쪽에 복사해 넣었을 가능성이 커요.</em></p></div></header>
          <div id="pairLead"></div></article>

        <article class="flag f2"><header><span class="rank">2</span><div><h3>전선 하나가 물을 다른 전선의 100만 배 넘게 써요</h3><p>기기선(UL 1007/1569)이라는 전선 1kg을 만드는 데 물이 약 <b>${Math.round(wire.value)}톤</b> 든다고 적혀 있어요. 비슷한 PVC 전선은 ${L.fmt(pvc)}m³라서 <b>약 ${wireX}만 배</b> 차이가 나요. 다른 항목은 두 전선이 비슷해요(탄소발자국 ${wireRow.v[0]} 대 ${pvcRow.v[0].toFixed(2)}). 또 기기선의 다른 숫자는 ${wireRow.v[0]}, ${wireRow.v[1]}처럼 짧은데 물발자국만 ${wire.value}처럼 길어요. <em class="warn">이 칸만 다른 자료에서 왔거나 단위를 잘못 바꿨을 수 있어요.</em></p></div></header></article>

        <article class="flag f3"><header><span class="rank">3</span><div><h3>파티클보드와 우드칩: 숫자가 옆 칸으로 밀렸어요</h3><p>두 목재는 네 가지 숫자가 같아요. 비슷한 재료라 같은 자료를 썼다면 이상한 일은 아니에요. 문제는 남은 칸이에요. <b>파티클보드의 오존층영향과 우드칩의 산성비가 0.000999692로 똑같아요.</b> 오존층영향과 산성비는 전혀 다른 항목이라 숫자가 우연히 같을 수 없어요. <em class="warn">입력하다가 한 칸이 밀렸을 가능성이 높아요.</em> 실제로 파티클보드의 오존층영향은 ${rv.ozone_n}개 중 다섯 번째로 큰데, 이보다 큰 네 개는 모두 불소 화합물이나 잉크예요. 나무가 이만큼 오존층을 파괴한다고 보기는 어려워요.</p></div></header>
          <div id="pairWood"></div></article>

        <div class="two flag-two">
          <article class="flag f4"><header><span class="rank">4</span><div><h3>다른 재료인데 물발자국이 같아요</h3><p>스테인리스강과 탄소강, 종류가 다른 저항 4종이 같은 물발자국 숫자를 써요. 비슷한 재료의 숫자를 대신 썼을 수 있어요. 그렇다면 어떤 자료를 썼는지 기록이 있어야 해요. 폴리부타디엔과 그 고무처럼 같은 계열은 같은 자료를 썼다고 볼 수 있어요.</p></div></header>
            <div id="shared"></div></article>
          <div>
            <article class="flag f5"><header><span class="rank">5</span><div><h3>오존층영향이 특히 큰 재료</h3><p>오존층영향 숫자 ${rv.ozone_n}개는 가장 작은 것과 큰 것이 약 ${Math.round(rv.ozone_range[1] / rv.ozone_range[0] / 1e6)}00만 배 차이 나요. 1kg당 0.001이 넘는 재료는 아래 네 가지예요. 불소·황 화합물은 만들 때 오존층을 파괴하는 물질이 나올 수 있어 판단을 미뤘어요. 옵셋잉크(인쇄용 잉크)는 확인이 필요해요.</p></div></header>
              <div id="ozone"></div></article>
            <article class="flag f6"><header><span class="rank">6</span><div><h3>하천모래의 물발자국이 너무 작아요</h3><p>1kg당 ${L.fmt(sand.value)}m³로, 비슷한 골재인 순환 잔골재(${L.fmt(fineAgg)}m³)의 약 ${sandX.toLocaleString('ko-KR')}분의 1이에요. 하천모래는 탄소발자국과 물발자국 두 가지만 숫자가 있어요.</p></div></header></article>
          </div>
        </div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>결과가 얼마나 바뀔까요</h2></header>
        <p class="lead">이 숫자를 그대로 쓰면 <b>제품의 결과가 얼마나 달라지는지</b> 가상의 제품 두 개로 계산해 봤어요. 재료 양은 설명을 위해 정한 숫자예요.</p>
        <div class="examples">
          <article class="ex"><h3>예 1. 전선이 들어간 2kg짜리 가전</h3>
            <p>전선을 뺀 나머지 재료는 물발자국 중간값(1kg당 ${L.fmt(wMed)}m³)으로 계산했어요. <b>막대를 끌어서 전선 무게를 바꿔 보세요.</b></p>
            <div class="wslider"><label for="wireG">전선 무게</label><input type="range" id="wireG" min="1" max="100" step="1" value="20"><output><b id="wireGv">20</b>g</output></div>
            <div class="exbars" id="ex1Bars"><div class="exb hi"><span>기기선 숫자로 계산</span><div class="exb-t"><i id="ex1A"></i></div><b id="ex1At"></b></div><div class="exb"><span>PVC 전선 숫자로 계산</span><div class="exb-t"><i id="ex1B"></i></div><b id="ex1Bt"></b></div></div>
            <div class="share"><div class="share-t"><i id="ex1S"></i></div><span>기기선 숫자로 계산하면 제품이 쓰는 물의 <b id="ex1St"></b>가 전선에서 나와요</span></div>
            <p class="ex-r" id="ex1R"></p></article>
          <article class="ex"><h3>예 2. 콘크리트에 들어가는 모래 ${kgAgg}kg</h3>
            <p>천연 모래와 재활용 골재 중 무엇이 물을 덜 쓰는지 비교하는 상황이에요.</p>
            ${exBars([{ label: '재활용 골재로 계산', v: ex2F, text: vol(ex2F), hi: true }, { label: '하천모래로 계산', v: ex2S, text: vol(ex2S) }])}
            <p class="ex-r">재활용 골재가 물을 <b>약 ${Math.round(ex2F / ex2S).toLocaleString('ko-KR')}배</b> 더 쓰는 것으로 나와요. 하천모래 숫자가 너무 작게 들어가 있다면, <b>재활용 재료가 실제보다 나빠 보일 수 있어요.</b></p></article>
        </div>
        <p class="note">납과 염소는 어느 쪽이 원래 숫자인지 알 수 없어 계산 예를 들지 않았어요. 다만 둘 중 하나를 쓰는 제품은 다섯 가지 모두 다른 재료의 숫자로 계산되고 있을 수 있어요.</p>

        <div class="checklist"><h3>그래서, 숫자표를 쓰기 전에 확인할 것</h3><ol>
          <li><b>단위</b>1kg당 숫자인지, 1개·1MJ·1m³당 숫자인지 먼저 봐요. 한 단계 안에서도 섞여 있어요.</li>
          <li><b>똑같은 숫자</b>다른 재료와 숫자가 똑같지 않은지 봐요. 비슷한 재료의 숫자를 대신 썼다면 출처를 적어 둬요.</li>
          <li><b>자릿수</b>비슷한 재료와 수천 배 이상 차이 나는 숫자는 원본과 맞춰 봐요.</li>
          <li><b>쏠림</b>제품 결과 대부분이 재료 하나에서 나오면, 그 재료의 숫자부터 다시 봐요.</li>
          <li><b>7가지 모두</b>탄소발자국만이 아니라 7가지 숫자를 모두 같은 방식으로 확인해요. 6건 중 4건은 탄소발자국이 아닌 칸에 있었어요.</li>
          <li><b>빈칸</b>‘해당없음’을 0으로 넣지 않아요. 탄소발자국만 있는 항목은 다른 숫자를 따로 찾아 채워요.</li></ol></div>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>탄소만 보면 될까요</h2></header>
        <p class="lead">환경성적표지는 7가지를 공개하지만, 많은 사람이 관심을 갖는 건 탄소발자국 하나예요. 정부의 저탄소제품 인증도 탄소발자국만 봐요. 그렇다면 <b>탄소발자국이 큰 재료는 물도 많이 쓰고, 자원도 많이 쓸까요?</b> 재료 ${POOL.length}종으로 확인해 보니 <b>산성비·자원발자국은 탄소와 함께 움직였지만, 물발자국은 거의 따로 움직였어요.</b></p>
        <div class="story">
          <div class="st-fig"><div class="st-sticky"><figure class="plotcard" id="stPlot"></figure><div class="meter" id="stMeter"></div></div></div>
          <div class="st-steps">${steps.map(([code, h, t], i) => `<article class="step" data-step="${code}"><span class="sn">${i + 1} / ${steps.length}</span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
        </div>
        <h3 class="sub">다섯 가지 영향을 한눈에</h3>
        <div class="score" id="score"></div>
        <p class="hint">‘짐작할 수 있어요’는 상위 10·20·30% 어느 기준으로 봐도 그 영향이 큰 재료의 절반 이상이 탄소발자국도 크다는 뜻이에요. 부영양화는 전체로는 탄소와 함께 움직이지만, 부영양화가 특히 큰 재료들은 탄소발자국이 크지 않은 경우가 많아서 ‘일부만 가능’이에요.</p>

        <h3 class="sub">탄소발자국만 봤을 때</h3>
        <p class="sub-lead">3장의 의심스러운 숫자 6개는 어느 항목에 있을까요? 버튼을 눌러 비교해 보세요. 빨간 칸이 문제가 있는 항목이에요.</p>
        <div class="cview carbon" id="cview">
          <div class="cv-ctl">
            <div class="seg" role="group" aria-label="보기 전환"><button type="button" data-cv="carbon" aria-pressed="true">탄소발자국만 보기</button><button type="button" data-cv="all" aria-pressed="false">7가지 모두 보기</button></div>
            <div class="cv-count"><span>찾은 문제</span><b id="cvN">2</b><span>/ 6건</span></div>
          </div>
          <div class="cv-key"><span><i class="k-same">=</i>다른 재료와 숫자가 똑같음</span><span><i class="k-odd">!</i>자릿수가 튀거나 칸이 밀림</span><span><i class="k-ok"></i>문제 없음 또는 빈칸</span></div>
          <div class="cv-grid">${CVF.map((f, i) => `<article class="cv-t${f.has.includes('탄소') ? ' cin' : ''}" style="--i:${i}"><span class="cv-badge found">문제 발견</span><span class="cv-badge miss">놓침</span><header><span class="rank">${f.n}</span><div><h4>${f.t}</h4><p>${f.s}</p></div></header>
            <div class="strip">${CVK.map(([k, lb]) => `<i data-k="${k}" class="${f.same.includes(k) ? 'same' : f.odd.includes(k) ? 'odd' : ''}"><b>${f.same.includes(k) ? '=' : f.odd.includes(k) ? '!' : ''}</b><em>${lb}</em></i>`).join('')}</div>
            ${f.part ? `<small class="cv-part">탄소발자국만 보면 똑같은 숫자는 보이지만, 칸 밀림은 안 보여요</small>` : ''}</article>`).join('')}</div>
          <p class="cv-msg" id="cvMsg"></p>
        </div>
        <p class="concl">탄소발자국과 다른 영향은 따로 움직이는 경우가 많았고, 의심스러운 숫자도 <b>6건 중 4건이 탄소발자국이 아닌 칸</b>에 있었어요. 숫자표는 탄소발자국만이 아니라 <b>7가지를 모두 같은 방식으로 확인</b>해야 해요.</p>
      </section>

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>결과 확인과 한계</h2></header>
        <p class="lead">5장의 결과가 우연은 아닌지 세 가지로 확인했어요. <b>어느 경우에도 물발자국은 탄소발자국과 거의 따로 움직였어요.</b></p>
        <div class="checks">
          <div class="ck"><h3>재료를 다시 뽑아 계산해도</h3><p>재료 목록을 무작위로 다시 뽑아 2,000번 계산해도 탄소–물 관계(ρ)는 <b>${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}</b> 사이였어요.</p></div>
          <div class="ck"><h3>가장 많은 재료 종류를 빼도</h3><p>재료의 ${basicShare}%를 차지하는 기초화학물질을 빼도 ρ는 <b>${nb.rho.toFixed(2)}</b>(${nb.n}종)였어요.</p></div>
          <div class="ck"><h3>의심스러운 숫자를 빼도</h3><p>1·2·3·6번 재료 ${rs.strong.excluded.length}종을 빼면 ρ는 <b>${rs.strong['물소모'].rho.toFixed(2)}</b>, 1·2·3·4·6번 재료 ${rs.all.excluded_n}종을 빼면 <b>${rs.all['물소모'].rho.toFixed(2)}</b>였어요.</p></div>
        </div>
        <h3 class="sub">읽을 때 주의할 점</h3>
        <div class="formula" aria-label="제품의 물발자국은 재료마다 사용량 곱하기 1kg당 숫자를 모두 더한 값">
          <span class="f-l">제품의 물발자국</span><span class="f-eq">=</span>
          <span class="f-t"><b>재료 A 사용량</b><i>×</i><b class="k">A의 1kg당 물발자국</b></span><span class="f-p">+</span>
          <span class="f-t"><b>재료 B 사용량</b><i>×</i><b class="k">B의 1kg당 물발자국</b></span><span class="f-p">+ …</span>
          <p class="f-note">이 분석은 <b class="k">1kg당 숫자</b>만 다뤘어요. 사용량은 제품마다 다르고, 이 자료에는 없어요.</p>
        </div>
        <div class="yesno">
          <div class="yes"><h3>이 분석으로 말할 수 있는 것</h3><ul>
            <li>숫자표에서 원본과 맞춰 봐야 할 숫자와 그 이유</li>
            <li>그 숫자를 그대로 쓰면 제품 계산이 얼마나 달라질 수 있는지 (가상의 예)</li>
            <li>재료 1kg당 숫자에서 탄소발자국과 함께 움직이는 영향, 따로 움직이는 영향</li>
            <li>의심스러운 숫자 6건 중 4건이 탄소발자국이 아닌 칸에 있다는 것</li></ul></div>
          <div class="no"><h3>말할 수 없는 것</h3><ul>
            <li>3장의 숫자가 실제로 오류인지 (원본 확인 전)</li>
            <li>완성된 제품끼리 비교해도 같은 결과가 나오는지</li>
            <li>어느 재료가 더 친환경적인지</li>
            <li>숫자가 얼마나 정확한지(오차 정보 없음)와 지금 시점의 숫자 (2021년 기준)</li></ul></div>
        </div>
        <div class="next"><h3>다음 단계</h3><p>3장의 숫자를 국가 LCI DB 원본과 맞춰 보고, 한국환경산업기술원에 문의해 확인할 계획이에요. 그다음 실제 제품 하나를 정해 재료 사용량까지 넣어 계산하면 결과가 얼마나 달라지는지 볼 거예요.</p></div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>분석하며 내린 판단</h2></header>
        <p class="lead">정답이 없는 선택을 할 때마다 이유와, 다르게 했다면 어땠을지 적어 뒀어요. 항목을 누르면 펼쳐져요.</p>
        <div class="dec">${decisions.map((d, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>
      </div>
    </div>`;

    story(); scorecard(); review();

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
