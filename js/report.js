/* 분석 리포트 탭. 수치는 데이터에서 직접 계산하거나 analysis_results.json(Python 결과)에서 가져온다. */
(function () {
  const { $, esc, POOL, D, RES, NAME, RKEY } = L;
  const LENSES = ['물', '부영', '스모그', '자원', '산성'];
  const CI = k => RES.carbon_rho_ci[RKEY[k]], CAP = k => RES.screening_capture[RKEY[k]];
  const CUT = k => RES.cutoff_curve[RKEY[k]], cutAt = (k, q) => CUT(k).find(r => r.q === q);
  // 순위상관 ρ를 말로 바꾼다
  const relWord = r => (r >= 0.7 ? '비례한다' : r >= 0.4 ? '약하게 비례한다' : r > 0.1 ? '거의 비례하지 않는다' : '비례관계를 알 수 없다');
  // 탄소발자국 순위로 이 영향의 순위를 짐작할 수 있나: 상위 10·20·30% 모두에서 절반 이상이 같은 원료면 ‘있다’, 모두 절반 미만이면 ‘어렵다’
  const ANSWER = { '잘 맞음': ['ok', '짐작할 수 있다'], '기준에 따라 다름': ['mid', '일부만 가능하다'], '어긋남': ['no', '짐작하기 어렵다'] };
  const answer = k => ANSWER[RES.verdict[RKEY[k]]];

  /* ---------- 첫 화면: 33칸 그림 ---------- */
  function waffle() {
    const c = CAP('물'), cells = [];
    for (let i = 0; i < c['다른영향상위']; i++) cells.push(i < c['함께상위'] ? 'got' : 'miss');
    $('waffle').innerHTML = cells.map((t, i) => `<i class="${t}" style="--i:${i}"></i>`).join('');
    requestAnimationFrame(() => setTimeout(() => $('waffle').classList.add('on'), L.reduce ? 0 : 300));
  }

  /* ---------- 순위 비교 그래프 (스크롤에 따라 단계별로 바뀜) ---------- */
  const SW = 600, SH = 560, m = { l: 54, r: 16, t: 20, b: 50 }, iw = SW - m.l - m.r, ih = SH - m.t - m.b;
  const X = p => m.l + p / 100 * iw, Y = p => m.t + ih - p / 100 * ih;
  let lens = '물', step = 0;
  function story() {
    const grid = [0, 20, 40, 60, 80, 100];
    $('stPlot').innerHTML = `<svg viewBox="0 0 ${SW} ${SH}" role="img" aria-labelledby="stT"><title id="stT">원료별 탄소발자국 순위와 다른 영향 순위</title>
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
      $('stMeter').innerHTML = `<span class="mt-l">${L.josa(NAME[lens], '이', '가')} 큰 원료</span><b>${cap['다른영향상위']}종</b>
        <span class="mt-got"><i></i>탄소발자국도 큼 <b>${cap['함께상위']}</b></span><span class="mt-miss"><i></i>탄소발자국은 크지 않음 <b>${cap['빠진']}</b></span>`;
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
    $('score').innerHTML = `<div class="sc-h"><span>영향범주</span><span>탄소발자국과 함께 커지는 정도<small>순위상관 ρ, 띠는 95% 범위</small></span><span>큰 원료 중 탄소발자국도 큰 원료<small>상위 20% 기준, 세로선은 우연히 같을 때(20%)</small></span><span>상위 10·20·30%에서</span><span>탄소발자국으로 짐작</span></div>` +
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

  /* ---------- 상위 몇 %를 보느냐에 따른 결과 ---------- */
  function curve() {
    const W = 760, H = 330, m2 = { l: 48, r: 120, t: 16, b: 46 }, w2 = W - m2.l - m2.r, h2 = H - m2.t - m2.b;
    const qs = [10, 15, 20, 25, 30, 40, 50], CX = q => m2.l + (q - 10) / 40 * w2, CY = v => m2.t + h2 - v / 100 * h2;
    const col = { 물: '#0F3B2A', 부영: '#7DB547', 스모그: '#9CB8A3', 자원: '#4E8F69', 산성: '#2F8A4F' };
    const order = ['산성', '자원', '스모그', '부영', '물'];
    const ends = order.map(k => ({ k, y: CY(cutAt(k, 50).rate) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;
    const ly = Object.fromEntries(ends.map(e => [e.k, e.y]));
    $('curve').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="값이 큰 원료를 어디까지 보느냐에 따라 탄소발자국도 큰 원료의 비율">
      <rect class="pick20" x="${CX(19)}" y="${m2.t}" width="${CX(21) - CX(19)}" height="${h2}"/>
      ${[0, 25, 50, 75, 100].map(v => `<line class="g" x1="${m2.l}" x2="${m2.l + w2}" y1="${CY(v)}" y2="${CY(v)}"/><text class="tk" x="${m2.l - 8}" y="${CY(v) + 4}" text-anchor="end">${v}%</text>`).join('')}
      ${qs.map(q => `<text class="tk" x="${CX(q)}" y="${H - 22}" text-anchor="middle">상위 ${q}%</text>`).join('')}
      <text class="ax" x="${m2.l + w2 / 2}" y="${H - 4}" text-anchor="middle">값이 큰 원료를 어디까지 볼 것인가</text>
      <line class="base" x1="${CX(10)}" y1="${CY(10)}" x2="${CX(50)}" y2="${CY(50)}"/>
      <text class="bt" x="${CX(50) - 4}" y="${CY(50) + 16}" text-anchor="end">관계가 없어도 우연히 같은 비율</text>
      ${order.map(k => `<polyline class="ln ${k === '물' ? 'main' : ''}" style="stroke:${col[k]}" points="${CUT(k).map(r => `${CX(r.q)},${CY(r.rate)}`).join(' ')}"/>
        ${CUT(k).map(r => `<circle cx="${CX(r.q)}" cy="${CY(r.rate)}" r="${k === '물' ? 4.5 : 3.2}" style="fill:${col[k]}"><title>${NAME[k]} 상위 ${r.q}%: ${r.top}종 중 ${r.both}종이 탄소발자국도 상위 ${r.q}% (${r.rate}%)</title></circle>`).join('')}
        <text class="lb ${k === '물' ? 'main' : ''}" x="${CX(50) + 10}" y="${ly[k] + 4}" style="fill:${col[k]}">${NAME[k]}</text>`).join('')}
      <text class="pt" x="${CX(20)}" y="${m2.t + 12}" text-anchor="middle">본문 기준</text>
    </svg>`;
    L.onView($('curve'), () => $('curve').classList.add('drawn'));
  }

  /* ---------- 원자료에서 다시 확인할 값 ---------- */
  function pairTable(p) {
    const order = ['자원발자국', '탄소발자국', '오존층영향', '산성비', '부영양화', '광화학스모그', '물소모'];
    const disp = k => (k === '물소모' ? '물발자국' : k), fx = v => (v == null ? '<span class="muted">빈 값</span>' : String(Number(v.toPrecision(10))));
    return `<table class="cmp"><thead><tr><th>영향범주</th><th class="num">${esc(p.a)}</th><th class="num">${esc(p.b)}</th><th></th></tr></thead><tbody>${order.filter(k => p.a_values[k] != null || p.b_values[k] != null).map(k => {
      const x = p.a_values[k], y = p.b_values[k], same = x != null && y != null && Math.abs(x - y) <= Math.abs(x) * 1e-9;
      return `<tr class="${same ? 'same' : ''}"><td>${disp(k)}</td><td class="num">${fx(x)}</td><td class="num">${fx(y)}</td><td>${same ? '<b class="eq">같음</b>' : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function review() {
    const rv = RES.review, f = L.fmt;
    $('pairLead').innerHTML = pairTable(rv.same_pairs.find(p => [p.a, p.b].includes('납')));
    $('pairWood').innerHTML = pairTable(rv.same_pairs.find(p => [p.a, p.b].includes('우드칩')));
    const pairNames = new Set(rv.same_pairs.flatMap(p => [p.a, p.b]));
    const extra = rv.shared_values.filter(g => !g.items.every(it => pairNames.has(it.name)));
    $('shared').innerHTML = `<table class="tbl"><thead><tr><th>같은 물발자국 값을 쓰는 원료</th><th class="num">값 (m³/kg)</th></tr></thead><tbody>${extra.map(g => `<tr><td>${g.items.map(it => `<b>${esc(it.name.trim())}</b> <small class="muted">${esc(it.cat)}</small>`).join('<br>')}</td><td class="num">${f(g.value)}</td></tr>`).join('')}</tbody></table>`;
    $('ozone').innerHTML = `<table class="tbl"><thead><tr><th>원료</th><th class="num">오존층영향 (kg CFC-11 eq/kg)</th></tr></thead><tbody>${rv.ozone_hi.map(o => `<tr><td><b>${esc(o.name)}</b></td><td class="num">${f(o.value)}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------- 탄소발자국은 작은데 다른 영향은 큰 원료 ---------- */
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
      $('thTable').innerHTML = hid.length ? `<table class="tbl"><thead><tr><th>원료</th><th>소재군</th><th>탄소발자국</th><th>더 큰 영향</th><th>그 영향</th><th class="num">순위 차이</th></tr></thead><tbody>${shown.map(h => `<tr><td><b>${esc(h.r.name)}</b></td><td>${esc(h.r.category)}</td><td class="muted">${L.topLabel(h.c)}</td><td>${NAME[h.k]}</td><td class="hi"><b>${L.topLabel(h.o)}</b></td><td class="num">${Math.round(h.diff)}%p</td></tr>`).join('')}</tbody></table>${hid.length > 10 ? `<button type="button" class="more" id="thMore">${all ? '차이가 큰 10종만 보기' : `${hid.length}종 모두 보기`}</button>` : ''}` : '<p class="empty">이 기준을 넘는 원료가 없다.</p>';
      const more = $('thMore'); if (more) more.onclick = () => { all = !all; draw(); };
    };
    s.addEventListener('input', draw);
    document.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { s.value = b.dataset.th; draw(); }));
    draw();
  }

  function build() {
    const nStage = D.filter(r => r.stage === '원료 및 에너지 생산').length, nKg = RES.base_n;
    const pairNs = LENSES.map(k => CI(k).n), nMin = Math.min(...pairNs), nMax = Math.max(...pairNs);
    const ozMiss = 100 - Math.round(L.coverage(POOL, 6) * 100), ozN = L.has(POOL, 6).length;
    const wcw = RES.within_category_carbon_water, wcr = RES.within_category_carbon_resource, nb = RES.carbon_water_without_basic_chem;
    const ks = RES.k_scores, sens = RES.sensitivity, K = RES.chosen_k, silK = ks.find(x => x.k === K).실루엣;
    const w = CAP('물'), a = CAP('산성'), cb = L.PP['물'][POOL.find(r => r.name === '골판지').id];
    const tcN = L.top20('물').tc.size, nHid = L.hidden(40).length;
    const basicShare = Math.round(POOL.filter(r => r.category === '기초화학물질').length / POOL.length * 100);
    const sel = RES.selection, rv = RES.review, rs = RES.review_sensitivity;
    const wire = rv.extreme.find(x => x.name.startsWith('기기선')), sand = rv.extreme.find(x => x.name === '하천모래');
    const pvc = POOL.find(r => r.name === 'PVC 전선').v[4], fineAgg = POOL.find(r => r.name === '순환 잔골재').v[4];
    const missPool = ['탄소', '자원', '산성', '부영', '물', '스모그', '오존'].map(k => ({ k, v: 100 - Math.round(L.coverage(POOL, L.J(k)) * 100) }));
    const w10 = cutAt('물', 10), w20 = cutAt('물', 20), w30 = cutAt('물', 30), e20 = cutAt('부영', 20), e30 = cutAt('부영', 30);
    const funnel = [
      ['전체 평가계수', D.length, ''],
      ['원료 및 에너지 생산 단계', nStage, '다른 단계는 단위가 다르거나 탄소발자국만 있다'],
      ['단위가 kg인 원료', nKg, '개(ea)·m³·MJ·kWh·m² 단위 9건 제외'],
      ['수자원(상수·공업용수) 제외', POOL.length, '재료가 아닌 물이라 제외'],
      ['두 영향 값이 모두 있는 원료', `${nMin}~${nMax}`, '비교하는 두 영향에 따라 대상 수가 다르다']
    ];
    const decisions = [
      ['결론의 범위', '원료 1kg당 값에 대한 결론으로 한정했다', '제품의 환경영향은 원료마다 ‘사용량 × 1kg당 값’을 더해 계산한다. 이 데이터에는 사용량이 없으므로 제품끼리의 관계는 알 수 없다.', '초기 버전은 “탄소발자국으로 원료를 고르면 놓친다”처럼 제품 선택의 문제로 넓혀 썼다.'],
      ['순위를 매기는 대상', '비교하는 두 영향 값이 모두 있는 원료끼리 순위를 매겼다', '값이 있는 원료 수가 영향마다 다르다(탄소발자국 187종, 물발자국 163종). 서로 다른 대상에서 매긴 순위를 비교하면 결과가 틀어진다.', '초기 버전은 이 문제로 5장의 원료를 25종으로 적게 셌다. 수정 후 34종이다.'],
      ['빈 값', '0으로 채우지 않았다', '원자료의 ‘해당없음’은 측정하지 않았다는 뜻이지 영향이 없다는 뜻이 아니다.', '0으로 채우면 빈 값이 가장 작은 값처럼 다뤄진다.'],
      ['단계와 단위', '원료 단계에서 1kg당 값만 비교했다', `원료 단계 ${nStage}건 중 ${nKg}건이 1kg당 값이다. 다른 단계는 단위가 다르고, 재활용·소각 값은 계산 방식을 알 수 없어 서로 비교하지 않았다.`, '다이오드(1개당)와 트랜지스터(1kg당)를 같은 순위에 세우면 단위 차이가 순위를 정한다.'],
      ['수자원과 오존층영향', '분석에서 제외했다', `상수·공업용수는 재료가 아니다. 오존층영향은 원료 ${POOL.length}종 중 ${ozN}종에만 값이 있다.`, '오존층영향을 넣으면 십여 종으로 계산하게 되어 결과가 우연에 크게 좌우된다.'],
      ['비교 방법', '값의 크기 대신 순위로 비교했다', '같은 영향 안에서도 값이 수십만 배까지 차이 난다. 값으로 비교하면 큰 값 몇 개가 결과를 정한다.', '평균이나 일반 상관계수를 쓰면 극단값 몇 개에 끌려간다.'],
      ['상위 20% 기준', '모든 영향에서 상위 원료가 30종 이상이 되는 가장 작은 기준', `30종이면 원료 1종에 비율이 약 3%p 움직이고, 15종이면 약 7%p 움직인다. 15% 기준이면 가장 작은 그룹이 ${RES.cutoff_min_top['15']}종, 10%면 ${RES.cutoff_min_top['10']}종이다.`, '처음에는 관행대로 20%를 골랐다. 다른 기준을 확인해 보니 부영양화 결과가 기준에 따라 달라져, 10·20·30%를 함께 보도록 바꿨다.'],
      ['결과의 범위 표시', '원료를 다시 뽑아 2,000번 계산한 95% 범위를 함께 적었다', `물발자국이 큰 원료 중 탄소발자국도 큰 원료의 비율은 ${w['포착률']}%지만, 범위는 ${w.lo}~${w.hi}%로 넓다.`, '숫자 하나만 쓰면 데이터보다 강한 문장을 쓰게 된다.'],
      ['다시 확인할 값', '분석에서 빼지 않고, 뺀 결과를 함께 비교했다', '원본과 대조하기 전에는 오류라고 단정할 수 없다.', '임의로 빼거나 고치면 원자료를 바꾼 분석이 된다.'],
      ['소재군 차이', '소재군별로, 가장 많은 소재군을 빼고 다시 계산했다', `기초화학물질을 빼도 탄소발자국–물발자국 ρ는 ${nb.rho.toFixed(2)}(${nb.n}종)였다.`, '소재군이 섞여 생긴 결과였다면 결론이 바뀌었을 것이다.'],
      ['군집 분석', '결론에 쓰지 않았다', `비슷한 원료끼리 자동으로 묶어 봤지만(K-means), 묶음의 경계가 흐렸다(실루엣 점수 ${silK.toFixed(2)}, 0.5 이상이어야 뚜렷한 편). 묶는 기준을 바꾸면 결과도 달라졌다(일치도 ${sens['3개(탄소·자원·산성)'].ARI.toFixed(2)}~${sens['6개(+스모그)'].ARI.toFixed(2)}).`, '흐린 묶음을 등급처럼 제시하게 된다.']
    ];
    const chapters = [['c1', '데이터'], ['c2', '비교 방법'], ['c3', '탄소발자국과 물발자국'], ['c4', '영향범주별 결과'], ['c5', '원료별로 보기'], ['c6', '다시 확인할 값'], ['c7', '결과 확인'], ['c8', '해석할 때 주의할 점'], ['c9', '분석 과정의 판단']];
    const steps = [
      ['탄소발자국 순서대로 세우면', `원료 ${POOL.length}종을 탄소발자국이 작은 것부터 큰 것까지 순서대로 세웠다. 다른 영향도 똑같은 순서라면 모든 점이 이 대각선 위에 놓인다.`],
      ['세로축을 물발자국으로 바꾸면', `점이 넓게 흩어진다. 탄소발자국이 크다고 물발자국도 크지는 않다는 뜻이다. 두 값이 함께 커지는 정도(순위상관 ρ)는 <mark>${CI('물').rho.toFixed(2)}</mark>로, 거의 비례하지 않는다. ρ가 1이면 순서가 완전히 같고, 0이면 아무 관계가 없다.`],
      ['탄소발자국이 큰 원료', `탄소발자국 상위 20%인 원료는 <mark>${tcN}종</mark>이다. 오른쪽 세로 띠에 있다.`],
      ['물발자국이 큰 원료', `물발자국 상위 20%인 원료는 <mark>${w['다른영향상위']}종</mark>이다. 위쪽 가로 띠에 있다. 두 값이 비례한다면 두 띠에 같은 원료가 모여야 한다.`],
      [`두 띠에 함께 있는 원료는 ${w['함께상위']}종`, `물발자국이 큰 ${w['다른영향상위']}종 중 탄소발자국도 큰 원료는 <mark>${w['함께상위']}종</mark>이다. 나머지 <mark>${w['빠진']}종</mark>은 물발자국은 크지만 탄소발자국은 크지 않다.<small>두 값이 아무 관계가 없어도 우연히 20%(33종 중 7종 정도)는 겹친다. 14종은 그보다 많지만 10종 중 4종 꼴이다.</small>`],
      ['예: 골판지', `골판지는 탄소발자국이 <mark>${L.topLabel(cb.c)}</mark>로 작은 편이지만, 물발자국은 <mark>${L.topLabel(cb.o)}</mark>로 큰 편이다. 실제 제품에서 골판지의 물발자국이 클지는 얼마나 쓰느냐에 따라 달라진다.`],
      ['산성비는 탄소발자국에 비례한다', `산성비로 바꾸면 점이 대각선 근처에 모인다. 산성비가 큰 ${a['다른영향상위']}종 중 <mark>${a['함께상위']}종</mark>이 탄소발자국도 크다.<span class="slens"><em>다른 영향범주 보기</em>${LENSES.map(k => `<button type="button" data-slens="${k}" aria-pressed="false">${NAME[k]}</button>`).join('')}</span>`]
    ];

    $('report').innerHTML = `
    <section class="hero">
      <div class="hero-in">
        <div class="hero-copy">
          <p class="kicker">환경성적표지(EPD) 평가계수 ${D.length}건 분석</p>
          <h1>탄소발자국과 물발자국은<br>거의 비례하지 않았다</h1>
          <p class="lead">원료 ${POOL.length}종의 1kg당 환경영향 값을 크기 순서로 비교했다. 탄소발자국이 큰 원료는 산성비와 자원발자국도 대체로 컸지만, 물발자국은 그렇지 않았다. 분석 중 원자료에서 다시 확인해야 할 값도 발견했다.</p>
          <p class="scope">원료 1kg당 값에 대한 분석이다. 제품의 환경영향은 원료를 얼마나 쓰느냐에 따라 달라진다.</p>
        </div>
        <figure class="hero-fig">
          <figcaption>물발자국이 큰 원료(상위 20%) ${w['다른영향상위']}종</figcaption>
          <div class="waffle" id="waffle" aria-label="${w['다른영향상위']}종 중 ${w['함께상위']}종은 탄소발자국도 크고 ${w['빠진']}종은 크지 않음"></div>
          <div class="wf-key"><span><i class="got"></i>탄소발자국도 큰 원료 <b>${w['함께상위']}</b></span><span><i class="miss"></i>탄소발자국은 크지 않은 원료 <b>${w['빠진']}</b></span></div>
        </figure>
      </div>
      <dl class="sum">
        <div><dt>비례하는 영향</dt><dd>산성비(ρ ${CI('산성').rho.toFixed(2)}), 자원발자국(${CI('자원').rho.toFixed(2)}), 부영양화(${CI('부영').rho.toFixed(2)}). 탄소발자국이 큰 원료는 이 값들도 대체로 컸다.</dd></div>
        <div><dt>거의 비례하지 않는 영향</dt><dd>물발자국(ρ ${CI('물').rho.toFixed(2)}). 물발자국이 큰 원료 ${w['다른영향상위']}종 중 탄소발자국도 큰 원료는 ${w['함께상위']}종뿐이었다.</dd></div>
        <div><dt>다시 확인할 값</dt><dd>납과 염소는 다섯 가지 영향 값이 모두 같았다. 기기선은 1kg당 물발자국이 ${Math.round(wire.value)}m³로, PVC 전선의 100만 배가 넘었다.</dd></div>
      </dl>
      <a class="cue" href="#c1" data-go="c1">분석 과정 보기</a>
    </section>

    <div class="doc">
      <nav class="rail" aria-label="리포트 순서"><ol>${chapters.map(([id, t], i) => `<li><a href="#${id}" data-go="${id}"><span>${i + 1}</span>${t}</a></li>`).join('')}</ol></nav>
      <div class="chapters">

      <section class="ch" id="c1"><header><span class="chno">1</span><h2>어떤 데이터인가</h2></header>
        <p class="lead">환경성적표지(EPD)는 제품이 만들어지고 버려지기까지 환경에 주는 영향을 숫자로 표시하는 제도다. 평가계수는 이 숫자를 계산할 때 쓰는 기초 자료로, 원료 1kg이나 전기 1kWh처럼 정해진 양을 쓸 때 생기는 환경영향을 7가지 범주로 미리 계산해 둔 값이다. 한국환경산업기술원이 공공데이터포털에 공개한 파일을 그대로 내려받아 사용했다.</p>
        <div class="data-grid">
          <table class="src"><tbody>
            <tr><th>데이터</th><td>한국환경산업기술원_환경성적표지 평가계수</td></tr>
            <tr><th>기준일</th><td>2021-08-02 (배포 파일 기준)</td></tr>
            <tr><th>규모</th><td>${D.length}건, 영향범주 7가지, CSV</td></tr>
            <tr><th>이용 조건</th><td>이용허락범위 제한 없음 <span class="muted">(2026-10-19 확인)</span></td></tr>
            <tr><th>원문</th><td><a href="https://www.data.go.kr/data/15120968/fileData.do" target="_blank" rel="noopener">data.go.kr/data/15120968</a></td></tr>
          </tbody></table>
          <figure class="fig"><figcaption>분석 대상을 고른 과정</figcaption>
            <ol class="funnel" id="funnel">${funnel.map(([n, v, note]) => { const num = typeof v === 'number' ? v : +String(v).split('~')[1]; return `<li><div class="fn-h"><span>${n}</span><b>${v}</b></div><div class="fn-bar"><i style="--w:${(num / D.length * 100).toFixed(1)}%"></i></div>${note ? `<p>${note}</p>` : ''}</li>`; }).join('')}</ol></figure>
          <figure class="fig"><figcaption>원료 ${POOL.length}종 중 값이 비어 있는 비율</figcaption>
            <div class="missbars" id="missbars">${missPool.map(x => `<div class="xb${x.k === '오존' ? ' off' : ''}"><span>${NAME[x.k]}</span><div><i style="--w:${x.v}%"></i></div><b>${x.v}%</b></div>`).join('')}</div>
            <p class="read">오존층영향은 ${ozMiss}%가 비어 있어 분석에서 뺐다. 빈 값은 0으로 채우지 않았다.</p></figure>
        </div>
        <h3 class="sub">이렇게 고른 이유</h3>
        <table class="tbl why"><thead><tr><th>기준</th><th>이유</th><th>포함했다면</th></tr></thead><tbody>
          <tr><td><b>원료 및 에너지 생산 단계만</b><br><small class="muted">${D.length}건 → ${nStage}건</small></td><td>단계마다 기준이 되는 양이 다르다. 수송은 ‘1톤을 1km 옮길 때’, 화학반응공정은 ‘클링커 1kg’ 같은 ${sel.units_by_stage['화학반응공정'].length}가지 기준을 쓴다. 연료원별 사용 ${sel.carbon_only_by_stage['연료원별 사용']}건과 화학반응공정 ${sel.carbon_only_by_stage['화학반응공정']}건은 탄소발자국만 있어 다른 영향과 비교할 수 없다.</td><td>기준이 다른 값끼리 순서를 매기게 된다.</td></tr>
          <tr><td><b>단위가 kg인 원료만</b><br><small class="muted">${nStage}건 → ${nKg}건</small></td><td>원료 단계 ${nStage}건 중 ${nKg}건(${Math.round(nKg / nStage * 100)}%)이 1kg당 값이다. 나머지 ${nStage - nKg}건은 1개당(${sel.stage_units.ea}건), 1m³·1MJ·1kWh·1m²당(각 1건) 값이다. 예를 들어 다이오드는 1개당 값이라, 1kg당 값인 트랜지스터와 같은 줄에 세우면 소재가 아니라 단위 때문에 순서가 정해진다.</td><td>‘다이오드 1개’와 ‘트랜지스터 1kg’을 비교하는 셈이 된다.</td></tr>
          <tr><td><b>수자원 2건 제외</b><br><small class="muted">${nKg}건 → ${POOL.length}건</small></td><td>공업용수와 상수는 원료가 아니라 물이다. 탄소발자국이 1kg당 약 0.0002 kg CO₂ eq로, 다른 원료의 중앙값(${L.fmt(sel.pool_median['탄소발자국'])})의 약 5천분의 1이다.</td><td>탄소발자국–물발자국 ρ는 ${sel.rho_with_utility_water.toFixed(2)}(제외했을 때 ${CI('물').rho.toFixed(2)})로 결론은 같다.</td></tr>
          <tr><td><b>오존층영향 제외</b></td><td>원료 ${POOL.length}종 중 값이 있는 원료가 ${ozN}종뿐이다(${ozMiss}% 비어 있음).</td><td>${ozN}종으로 계산한 결과는 우연에 크게 흔들린다.</td></tr>
          <tr><td><b>빈 값은 채우지 않음</b></td><td>‘해당없음’은 측정하지 않았다는 뜻이다. 두 영향 값이 모두 있는 원료만 비교했다(${nMin}~${nMax}종).</td><td>0으로 채우면 빈 값이 가장 작은 값처럼 다뤄진다.</td></tr>
        </tbody></table>
      </section>

      <section class="ch" id="c2"><header><span class="chno">2</span><h2>어떻게 비교했나</h2></header>
        <p class="lead">질문은 하나다. <b>탄소발자국이 큰 원료는 다른 환경영향도 클까?</b> 그렇다면 탄소발자국만 보고도 다른 영향을 어느 정도 짐작할 수 있다.</p>
        <ol class="methods">
          <li><b>크기 대신 순서로</b><p>같은 영향 안에서도 값이 수십만 배까지 차이 난다. 그래서 값 대신 원료를 작은 것부터 큰 것까지 줄 세운 순서(순위)로 비교했다.</p></li>
          <li><b>함께 커지는 정도</b><p>두 순위가 얼마나 같이 움직이는지를 순위상관 ρ로 봤다. 0.7 이상이면 ‘비례한다’, 0.4~0.7은 ‘약하게 비례한다’, 그 아래는 ‘거의 비례하지 않는다’로 읽었다.</p></li>
          <li><b>큰 원료끼리 같은가</b><p>값이 가장 큰 원료(상위 20%)가 두 영향에서 같은 원료인지 셌다. 관계가 전혀 없어도 우연히 20%는 같다.</p></li>
          <li><b>얼마나 믿을 수 있나</b><p>원료를 다시 뽑아 2,000번 계산하고, 결과가 95% 확률로 들어오는 범위를 함께 적었다.</p></li>
        </ol>
        <div class="why20"><h3>왜 상위 20%를 봤나</h3>
          <p>비교하는 원료가 적으면 원료 한두 개에 결과가 크게 흔들린다. 30종이면 원료 1종이 바뀔 때 비율이 약 3%p 움직이지만, 15종이면 약 7%p씩 움직인다. 다섯 가지 영향 모두에서 상위 원료가 <b>30종 이상</b>이 되는 가장 작은 기준이 20%다.</p>
          <div class="mini-grid">${[10, 15, 20, 25, 30].map(q => `<div class="${q === 20 ? 'on' : ''}"><span>상위 ${q}%</span><b>${RES.cutoff_min_top[q]}종</b><small>가장 적은 영향범주 기준</small></div>`).join('')}</div>
          <p class="hint">실제로 상위 10%(물발자국 ${w10.top}종)만 보면 결과 범위가 ${w10.lo}~${w10.hi}%로 너무 넓어 판단에 쓰기 어렵다. 20% 하나에 결론을 맡기지 않도록, 4장에서 10~50%의 결과를 함께 보여 준다.</p></div>
      </section>

      <section class="ch" id="c3"><header><span class="chno">3</span><h2>탄소발자국과 물발자국</h2></header>
        <p class="lead">점 하나가 원료 하나다. 스크롤하면 그래프가 단계별로 바뀐다.</p>
        <div class="story">
          <div class="st-fig"><div class="st-sticky"><figure class="plotcard" id="stPlot"></figure><div class="meter" id="stMeter"></div></div></div>
          <div class="st-steps">${steps.map(([h, t], i) => `<article class="step" data-step="${i}"><span class="sn">${i + 1} / ${steps.length}</span><h3>${h}</h3><p>${t}</p></article>`).join('')}</div>
        </div>
      </section>

      <section class="ch" id="c4"><header><span class="chno">4</span><h2>영향범주별 결과</h2></header>
        <p class="lead">다섯 가지 영향범주에 같은 방법을 썼다. 산성비와 자원발자국은 탄소발자국에 비례했고, 물발자국은 거의 비례하지 않았다. 부영양화와 광화학스모그는 그 중간이다.</p>
        <div class="score" id="score"></div>
        <p class="hint">‘탄소발자국으로 짐작’은 상위 10·20·30% 세 기준 모두에서 큰 원료의 절반 이상이 탄소발자국도 크면 ‘짐작할 수 있다’, 세 기준 모두에서 절반이 안 되면 ‘짐작하기 어렵다’, 기준에 따라 다르면 ‘일부만 가능하다’로 적었다.</p>
        <figure class="fig curvefig"><figcaption>값이 큰 원료를 어디까지 보느냐에 따라 달라지는 결과</figcaption><div id="curve" class="curve"></div>
          <p class="read">점선은 두 영향이 아무 관계가 없을 때 우연히 같은 원료가 나오는 비율이다. 물발자국은 상위 10%에서 ${w10.top}종 중 ${w10.both}종만 탄소발자국도 커서 우연과 거의 같았다. 상위 30%까지 넓혀도 ${w30.top}종 중 ${w30.both}종이었다. 점에 마우스를 올리면 원료 수가 보인다.</p></figure>
        <p class="sc-why"><b>부영양화는 비례하는데 왜 ‘일부만 가능’인가</b>순위상관(ρ ${CI('부영').rho.toFixed(2)})은 원료 전체의 경향을 본다. 전체로는 탄소발자국과 함께 커지지만, 부영양화가 가장 큰 원료들만 놓고 보면 사정이 다르다. 상위 20%에서는 ${e20.top}종 중 ${e20.both}종만 탄소발자국도 컸고, 상위 30%로 넓히면 ${e30.top}종 중 ${e30.both}종이었다. 부영양화가 특히 큰 몇몇 원료는 탄소발자국으로 짐작하기 어렵다는 뜻이다.</p>
      </section>

      <section class="ch" id="c5"><header><span class="chno">5</span><h2>탄소발자국은 작은데 다른 영향은 큰 원료</h2></header>
        <p class="lead">탄소발자국 순위보다 다른 영향의 순위가 훨씬 높은 원료를 찾았다. 순위 차이 40%p 기준으로 ${POOL.length}종 중 ${nHid}종이고, 이 중 물발자국이 큰 원료가 가장 많다.</p>
        <div class="tool">
          <div class="tool-ctl">
            <p class="tool-q">순위 차이가 몇 %p 이상인 원료를 볼까</p>
            <div class="presets" role="group" aria-label="기준 고르기">${[20, 30, 40, 50, 60, 70].map(v => `<button type="button" data-th="${v}" aria-pressed="false">${v}%p</button>`).join('')}</div>
            <label for="thSlider" class="sr">순위 차이 기준 (%p)</label>
            <div class="range"><input type="range" id="thSlider" min="20" max="70" step="5" value="40"><output><b id="thVal">40</b>%p</output></div>
            <p class="hint">버튼을 누르거나 막대를 끌면 목록이 바로 바뀐다. 40%p는 예를 들어 탄소발자국이 하위 10%인데 다른 영향은 상위 50% 안에 드는 정도의 차이다.</p>
            <div class="big"><b id="thN">0</b><span>종 / ${POOL.length}종</span></div>
            <div class="mbars" id="thBy"></div>
          </div>
          <div class="tool-out" id="thTable"></div>
        </div>
        <p class="note">순위는 원료 1kg끼리 비교한 상대적인 위치다. 소재가 좋고 나쁨을 뜻하지 않는다. 다범주로 평가할 때 탄소발자국 외의 영향을 함께 확인해 볼 원료 목록으로 쓸 수 있다.</p>
      </section>

      <section class="ch" id="c6"><header><span class="chno">6</span><h2>원자료에서 다시 확인할 값</h2></header>
        <p class="lead">분석하다가 납과 염소의 값이 다섯 가지 영향범주에서 모두 같다는 것을 발견했다. 그래서 ${D.length}건 전체에서 비슷한 문제가 있는지 찾아봤다. 서로 다른 원료가 같은 값을 쓰는 경우, 다른 원료보다 1만 배 이상 크거나 작은 경우, 오존층영향이 특히 큰 경우를 확인했다. 원본과 대조하기 전이라 오류라고 단정하지 않고, 이상한 정도가 큰 순서로 정리했다.</p>

        <article class="flag f1"><header><span class="rank">1</span><div><h3>납과 염소의 값이 모두 같다</h3><p>금속인 납과 화학물질인 염소는 만드는 방법이 전혀 다르다. 그런데 값이 있는 다섯 가지 영향범주가 소수점 아래 아홉 자리까지 모두 같다. ${D.length}건 중 이런 경우는 이 한 쌍뿐이다. 한쪽 값을 다른 쪽에 잘못 옮겨 적었을 가능성이 크다.</p></div></header>
          <div id="pairLead"></div></article>

        <article class="flag f2"><header><span class="rank">2</span><div><h3>기기선의 물발자국이 PVC 전선의 100만 배가 넘는다</h3><p>기기선(UL 1007/1569) 1kg을 만드는 데 물 ${Math.round(wire.value)}m³, 즉 약 ${Math.round(wire.value)}톤이 든다는 값이다. 같은 전선인 PVC 전선은 ${L.fmt(pvc)}m³로 약 ${Math.round(wire.value / pvc / 1e4)}만 배 차이가 난다. 원료 전체의 중앙값과 비교해도 약 ${Math.round(wire.times_median / 1e4)}만 배다. 단위를 잘못 환산했을 가능성이 있다.</p></div></header></article>

        <article class="flag f3"><header><span class="rank">3</span><div><h3>파티클보드와 우드칩: 같은 숫자가 서로 다른 칸에 있다</h3><p>두 목재 원료는 다섯 가지 영향범주 중 네 가지 값이 같다. 같은 목재 계열이라 공통 자료를 썼을 수 있다. 눈여겨볼 점은 <b>파티클보드의 오존층영향과 우드칩의 산성비가 0.000999692로 같은 숫자</b>라는 것이다. 같은 값이 한 칸씩 옆에 들어가 있어, 입력할 때 칸이 밀렸을 가능성이 있다. 실제로 파티클보드의 오존층영향은 값이 있는 ${rv.ozone_n}건 중 다섯 번째로 크다. 이보다 큰 네 건은 모두 화학물질이나 잉크다.</p></div></header>
          <div id="pairWood"></div></article>

        <div class="two flag-two">
          <article class="flag f4"><header><span class="rank">4</span><div><h3>재질이 다른데 물발자국이 같다</h3><p>스테인리스강과 탄소강, 재질이 다른 리드저항 4종이 같은 물발자국 값을 쓴다. 같은 계열 소재(폴리부타디엔과 그 고무 등)는 공통 자료를 썼을 수 있지만, 어떤 자료를 썼는지 확인이 필요하다.</p></div></header>
            <div id="shared"></div></article>
          <div>
            <article class="flag f5"><header><span class="rank">5</span><div><h3>오존층영향이 특히 큰 원료</h3><p>오존층영향 값 ${rv.ozone_n}건은 가장 작은 값과 큰 값이 약 ${Math.round(rv.ozone_range[1] / rv.ozone_range[0] / 1e6)}00만 배 차이 난다. 1kg당 0.001 kg CFC-11 eq 이상인 원료는 아래 네 가지다. 불소·황 화합물은 만드는 과정에서 오존층에 영향을 주는 물질이 나올 수 있어 판단을 미뤘지만, 옵셋잉크는 확인이 필요하다.</p></div></header>
              <div id="ozone"></div></article>
            <article class="flag f6"><header><span class="rank">6</span><div><h3>하천모래의 물발자국이 지나치게 작다</h3><p>1kg당 ${L.fmt(sand.value)}m³로, 같은 골재인 순환 잔골재(${L.fmt(fineAgg)}m³)의 약 ${Math.round(fineAgg / sand.value).toLocaleString('ko-KR')}분의 1이다.</p></div></header></article>
          </div>
        </div>

        <div class="impact"><h3>이 값들을 빼면 결론이 바뀔까</h3>
          <div class="imp-grid">
            <div><span>그대로 계산</span><b>${CI('물').rho.toFixed(2)}</b><small>탄소발자국–물발자국 ρ</small></div>
            <div><span>1·2·3·6번 원료 ${rs.strong.excluded.length}종 제외</span><b>${rs.strong['물소모'].rho.toFixed(2)}</b><small>탄소발자국–물발자국 ρ</small></div>
            <div><span>1·2·3·4·6번 원료 ${rs.all.excluded_n}종 제외</span><b>${rs.all['물소모'].rho.toFixed(2)}</b><small>탄소발자국–물발자국 ρ</small></div>
          </div>
          <p>어느 경우든 물발자국은 탄소발자국에 거의 비례하지 않았다. 원자료를 임의로 고치지 않기 위해 본문 분석에서는 이 값들을 빼지 않았다.</p></div>

        <div class="checklist"><h3>시사점: 평가계수를 쓰기 전에 확인할 것</h3><ol>
          <li><b>단위</b>1kg당 값인지, 1개·1MJ·1m³당 값인지 먼저 본다. 같은 단계 안에서도 섞여 있다.</li>
          <li><b>같은 값</b>다른 원료가 똑같은 값을 쓰고 있지 않은지 본다. 공통 자료를 쓴 것이라면 그 출처를 기록한다.</li>
          <li><b>자릿수</b>같은 종류의 원료와 비교해 수천 배 이상 차이 나는 값은 원본과 대조한다.</li>
          <li><b>빈 값</b>‘해당없음’을 0으로 넣지 않는다. 탄소발자국만 있는 항목은 다른 영향범주를 별도 자료로 채운다.</li>
          <li><b>기준 시점</b>이 파일은 2021년 8월 기준이다. 최신 국가 LCI DB와 작성지침으로 값을 확인한다.</li></ol></div>
      </section>

      <section class="ch" id="c7"><header><span class="chno">7</span><h2>결과가 우연이 아닌지 확인</h2></header>
        <p class="lead">물발자국이 탄소발자국에 거의 비례하지 않는다는 결과가 우연이나 데이터 구성 때문은 아닌지 네 가지로 확인했다. 모두 같은 결과가 나왔다.</p>
        <div class="checks">
          <div class="ck"><h3>원료를 다시 뽑아 계산해도</h3><p>2,000번 다시 계산하면 탄소발자국–물발자국 ρ는 <b>${CI('물').lo.toFixed(2)}~${CI('물').hi.toFixed(2)}</b> 사이였다. 가장 높게 잡아도 약한 관계다.</p></div>
          <div class="ck"><h3>가장 많은 소재군을 빼도</h3><p>원료의 ${basicShare}%를 차지하는 기초화학물질을 빼고 계산해도 ρ는 <b>${nb.rho.toFixed(2)}</b>(${nb.n}종)였다.</p></div>
          <div class="ck"><h3>기준을 바꿔도</h3><p>물발자국이 큰 원료 중 탄소발자국도 큰 원료는 상위 10%에서 ${w10.rate}%, 20%에서 ${w20.rate}%, 30%에서 ${w30.rate}%였다. 5장의 순위 차이 기준을 20~70%p로 바꿔도 <b>물발자국이 큰 원료가 가장 많았다.</b></p></div>
          <div class="ck wide"><h3>소재군별로 나눠 봐도</h3><p>소재군마다 따로 계산해도 <b>6개 소재군 모두</b> 탄소발자국–물발자국 ρ가 탄소발자국–자원발자국 ρ보다 낮았다.</p>
            <table class="mini"><thead><tr><th>소재군</th><th class="num">원료 수</th><th class="num">탄소발자국–자원발자국</th><th class="num">탄소발자국–물발자국</th></tr></thead><tbody>${Object.keys(wcw).sort((x, y) => wcw[y].n - wcw[x].n).map(c => `<tr><td>${esc(c)}</td><td class="num">${wcw[c].n}</td><td class="num">${wcr[c] ? wcr[c].rho.toFixed(2) : '-'}</td><td class="num"><b>${wcw[c].rho.toFixed(2)}</b></td></tr>`).join('')}</tbody></table></div>
        </div>
      </section>

      <section class="ch" id="c8"><header><span class="chno">8</span><h2>해석할 때 주의할 점</h2></header>
        <p class="lead">이 분석은 원료 1kg당 값을 비교한 것이다. 제품의 환경영향은 아래처럼 계산하므로, 원료 값의 관계를 제품의 관계로 그대로 옮길 수 없다.</p>
        <div class="formula" aria-label="제품의 물발자국은 원료마다 사용량 곱하기 1kg당 값을 모두 더한 값">
          <span class="f-l">제품의 물발자국</span><span class="f-eq">=</span>
          <span class="f-t"><b>원료 A 사용량</b><i>×</i><b class="k">A의 1kg당 물발자국</b></span><span class="f-p">+</span>
          <span class="f-t"><b>원료 B 사용량</b><i>×</i><b class="k">B의 1kg당 물발자국</b></span><span class="f-p">+ …</span>
          <p class="f-note">이 분석은 <b class="k">1kg당 값</b>만 다뤘다. 사용량은 제품마다 다르고, 이 데이터에는 없다.</p>
        </div>
        <div class="limits">
          <div><h3>사용량이 결과를 바꾼다</h3><p>1kg당 물발자국이 큰 원료도 조금만 쓰면 제품의 물발자국에는 거의 영향을 주지 않는다.</p></div>
          <div><h3>제품끼리는 다를 수 있다</h3><p>많은 제품이 전기와 연료를 함께 쓴다. 이런 공통 원료 때문에 제품 단위에서는 두 값이 더 비례할 수도, 덜 비례할 수도 있다.</p></div>
          <div><h3>탄소를 줄이면 물이 느는지는 모른다</h3><p>이를 확인하려면 같은 기능을 하는 제품끼리 비교해야 한다. 원료 값만으로는 알 수 없다.</p></div>
        </div>
        <div class="yesno">
          <div class="yes"><h3>이 분석으로 말할 수 있는 것</h3><ul>
            <li>원료 1kg당 값에서 탄소발자국이 어떤 영향범주와 비례하고, 어떤 영향범주와 비례하지 않는지</li>
            <li>탄소발자국만 계산하고 물발자국을 생략해도 된다는 근거가 원료 값에서는 보이지 않는다는 것</li>
            <li>어느 단계와 영향범주에서 값이 비어 있는지, 어떤 값을 원본과 대조해야 하는지</li></ul></div>
          <div class="no"><h3>말할 수 없는 것</h3><ul>
            <li>제품 단위에서도 같은지, 탄소를 줄이면 물이 느는 일이 실제로 생기는지</li>
            <li>어느 소재가 더 친환경인지, 재활용과 소각 중 어느 쪽이 나은지</li>
            <li>6장의 값이 실제로 오류인지(원본 대조 전)</li>
            <li>값이 얼마나 정확한지(오차 정보 없음)와 현재 시점의 값(2021년 기준)</li></ul></div>
        </div>
        <div class="next"><h3>다음 단계</h3><p>첫째, 6장의 값을 국가 LCI DB 원본과 대조하고 한국환경산업기술원에 문의한다. 둘째, 환경성적표지 인증 제품의 영향범주별 결과로 같은 분석을 제품 단위에서 해 본다. 셋째, 작성지침에 따라 제품 하나의 기능단위와 시스템 경계를 정하고 실제 전과정 목록 데이터로 분석한다.</p></div>
      </section>

      <section class="ch" id="c9"><header><span class="chno">9</span><h2>분석 과정의 판단</h2></header>
        <p class="lead">정답이 없는 선택을 할 때마다 이유와, 다르게 했다면 어땠을지를 기록했다. 항목을 누르면 펼쳐진다.</p>
        <div class="dec">${decisions.map((d, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="dn">${String(i + 1).padStart(2, '0')}</span><span class="dq">${d[0]}</span><span class="da">${d[1]}</span></summary><div class="db"><p><b>이유</b>${d[2]}</p><p><b>다르게 했다면</b>${d[3]}</p></div></details>`).join('')}</div>
      </section>
      </div>
    </div>`;

    waffle(); story(); scorecard(); curve(); review(); mismatchTool();

    const links = [...document.querySelectorAll('.rail a')];
    document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', ev => { ev.preventDefault(); $(el.dataset.go).scrollIntoView({ behavior: L.reduce ? 'auto' : 'smooth', block: 'start' }); }));
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) links.forEach(x => x.classList.toggle('on', x.dataset.go === en.target.id)); }), { rootMargin: '-30% 0px -65% 0px' });
    chapters.forEach(([id]) => io.observe($(id)));
    const rail = document.querySelector('.rail');
    new IntersectionObserver(es => es.forEach(en => rail.classList.toggle('show', en.isIntersecting || en.boundingClientRect.top < 0)), { rootMargin: '0px 0px -60% 0px' }).observe(document.querySelector('.chapters'));
    L.onView($('funnel'), () => $('funnel').classList.add('drawn'));
    L.onView($('missbars'), () => $('missbars').classList.add('drawn'));
  }
  L.tabs.report = { build, built: false };
})();
