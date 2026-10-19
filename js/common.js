/* 공통: 데이터 준비, 색, 표시 도구 */
(function (g) {
  const L = {};
  L.D = window.LCA_DATA; L.RES = window.LCA_RESULTS;
  // v 배열의 순서와 같다
  L.IMP = [
    { k: '탄소', name: '탄소발자국', sym: 'kg CO₂ eq', plain: '기후변화' },
    { k: '자원', name: '자원발자국', sym: 'kg Sb eq', plain: '광물·화석 자원 고갈' },
    { k: '산성', name: '산성화', sym: 'kg SO₂ eq', plain: '산성비' },
    { k: '부영', name: '부영양화', sym: 'kg PO₄³⁻ eq', plain: '물속 영양 과잉' },
    { k: '물', name: '물소모', sym: 'm³ H₂O eq', plain: '물 사용' },
    { k: '스모그', name: '광화학스모그', sym: 'kg C₂H₄ eq', plain: '지표 오존 생성' },
    { k: '오존', name: '오존층영향', sym: 'kg CFC-11 eq', plain: '성층권 오존 파괴' }
  ];
  L.J = k => L.IMP.findIndex(i => i.k === k);
  L.NAME = Object.fromEntries(L.IMP.map(i => [i.k, i.name]));
  // Python 결과(json)의 영향 이름
  L.RKEY = { 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성비', 부영: '부영양화', 스모그: '광화학스모그', 물: '물소모', 오존: '오존층영향' };
  L.OTHERS = ['자원', '산성', '부영', '스모그', '물'];
  L.STAGES = ['원료 및 에너지 생산', '연료원별 사용', '화학반응공정', '폐기물 처리', '수송'];
  // 진녹색(forest) · 초록(green) · 연두(lime)
  L.C = { ink: '#13281D', forest: '#0F3B2A', green: '#2F8A4F', leaf: '#7DB547', lime: '#C6E05A', sage: '#AFC4B4', slate: '#56695D', rule: '#D7E2D8', paper: '#F4F7F1', mint: '#E4F0E3' };
  L.C.teal = L.C.green; L.C.ochre = L.C.forest; // 데이터 탐색 탭 호환
  L.COLORS = ['#2F8A4F', '#0F3B2A', '#7DB547', '#56695D', '#A3C93A', '#AFC4B4'];
  L.$ = id => document.getElementById(id);
  L.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  // 숫자를 읽기 쉽게: 보통 범위는 유효숫자 3자리, 아주 작거나 큰 값은 ×10ⁿ
  L.fmt = v => {
    if (v == null || Number.isNaN(v)) return '결측';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 100 && a < 100000) return Math.round(v).toLocaleString('ko-KR');
    if (a >= 0.01 && a < 100) return String(Number(v.toPrecision(3)));
    const [m, e] = v.toExponential(2).split('e'); return m + '×10' + String(+e).split('').map(c => SUP[c] || c).join('');
  };
  L.lbl = r => (r.stage === '원료 및 에너지 생산' ? r.name : r.category + ' · ' + r.name);
  L.POOL = L.D.filter(r => r.stage === '원료 및 에너지 생산' && r.unit === 'kg' && r.category !== '수자원');
  L.col = (rows, j) => rows.filter(r => r.v[j] != null && r.v[j] > 0);
  L.coverage = (rows, j) => rows.length ? rows.filter(r => r.v[j] != null).length / rows.length : 0;
  L.has = (rows, j) => rows.filter(r => r.v[j] != null);
  L.times = v => !isFinite(v) ? '-' : v >= 10000 ? `약 ${Math.round(v / 1000) / 10}만 배` : v >= 100 ? `약 ${Math.round(v).toLocaleString('ko-KR')}배` : v >= 10 ? `약 ${Math.round(v)}배` : `${v.toFixed(1)}배`;
  L.josa = (w, a, b) => { const h = String(w).replace(/[^가-힣]+$/, '').slice(-1); const c = h ? h.charCodeAt(0) : 0; return w + (c && (c - 0xAC00) % 28 !== 0 ? a : b); };
  L.topLabel = p => (p >= 50 ? `상위 ${Math.max(1, Math.round(100 - p))}%` : `하위 ${Math.max(1, Math.round(p))}%`);
  L.reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // 영향 쌍마다 '두 값이 모두 있는 원료'끼리 순위(백분위)를 매긴다 (Python 분석과 동일)
  // PP[k][id] = { c: 탄소 백분위, o: 영향 k 백분위 }
  L.PP = (() => {
    const out = {}, jc = L.J('탄소');
    for (const k of L.OTHERS) {
      const j = L.J(k), rows = L.POOL.filter(r => r.v[jc] != null && r.v[j] != null);
      const rc = S.rank(rows.map(r => r.v[jc])), ro = S.rank(rows.map(r => r.v[j])), n = rows.length;
      out[k] = {}; rows.forEach((r, i) => (out[k][r.id] = { c: rc[i] / n * 100, o: ro[i] / n * 100 }));
    }
    return out;
  })();
  L.pair = (a, b) => { const ja = L.J(a), jb = L.J(b), rows = L.POOL.filter(r => r.v[ja] != null && r.v[jb] != null); return { rho: S.spearman(rows.map(r => r.v[ja]), rows.map(r => r.v[jb])), n: rows.length, rows }; };
  // 탄소 순위보다 다른 영향 순위가 th%p 이상 높은 원료 (원료마다 차이가 가장 큰 영향 하나로 센다)
  L.hidden = (th = 40) => {
    const best = {};
    for (const k of L.OTHERS) for (const [id, p] of Object.entries(L.PP[k])) {
      const d = p.o - p.c; if (d >= th && (!best[id] || d > best[id].diff)) best[id] = { k, c: p.c, o: p.o, diff: d };
    }
    const byId = Object.fromEntries(L.POOL.map(r => [r.id, r]));
    return Object.entries(best).map(([id, b]) => ({ r: byId[id], ...b })).sort((a, b) => b.diff - a.diff);
  };
  // 상위 20% 선별: 값이 80% 분위수 이상 (numpy.quantile 과 같은 선형 보간)
  L.top20 = k => {
    const jc = L.J('탄소'), j = L.J(k), rows = L.POOL.filter(r => r.v[jc] != null && r.v[j] != null);
    const qc = S.quantile(rows.map(r => r.v[jc]), .8), qo = S.quantile(rows.map(r => r.v[j]), .8);
    const tc = new Set(rows.filter(r => r.v[jc] >= qc).map(r => r.id)), to = new Set(rows.filter(r => r.v[j] >= qo).map(r => r.id));
    return { tc, to, both: [...to].filter(id => tc.has(id)), missed: [...to].filter(id => !tc.has(id)) };
  };

  // 차트: Plotly 가 없으면 안내 문구
  L.plot = (id, traces, layout, extra) => {
    const el = L.$(id); if (!el) return;
    if (!window.Plotly) { el.innerHTML = '<p class="empty">차트를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 새로고침해 주세요.</p>'; return; }
    const base = {
      font: { family: '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif', size: 13, color: L.C.ink },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 70, r: 20, t: 16, b: 56 },
      hoverlabel: { font: { size: 13, family: '"Pretendard Variable", Pretendard, sans-serif' }, bgcolor: '#fff', bordercolor: L.C.rule },
      xaxis: { gridcolor: '#E5ECE5', zerolinecolor: '#D3DED4', linecolor: L.C.rule }, yaxis: { gridcolor: '#E5ECE5', zerolinecolor: '#D3DED4', linecolor: L.C.rule }
    };
    const lay = Object.assign({}, base, layout || {});
    for (const ax of ['xaxis', 'yaxis']) lay[ax] = Object.assign({}, base[ax], (layout || {})[ax] || {});
    lay.margin = Object.assign({}, base.margin, (layout || {}).margin || {});
    Plotly.newPlot(el, traces, lay, Object.assign({ displayModeBar: false, responsive: true }, extra || {}));
  };
  L.purge = id => { const el = L.$(id); if (!el) return; try { if (window.Plotly) Plotly.purge(el); } catch (e) { } el.classList.remove('js-plotly-plot'); el.innerHTML = ''; };
  L.resizeAll = root => { if (!window.Plotly) return; (root || document).querySelectorAll('.js-plotly-plot').forEach(el => { try { Plotly.Plots.resize(el); } catch (e) { } }); };
  L.opts = (sel, list, valueFn, textFn, keep) => {
    const prev = keep ? sel.value : null;
    sel.innerHTML = list.map(x => `<option value="${L.esc(valueFn(x))}">${L.esc(textFn(x))}</option>`).join('');
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  };
  // 화면에 들어올 때 한 번 실행 (차트 그리기, 막대 채우기)
  L.onView = (el, fn) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } }), { threshold: 0.15 });
    io.observe(el);
  };
  // 숫자 세기 애니메이션 (동작 줄이기 설정이면 바로 표시)
  L.count = (el, to, dec = 0, dur = 900) => {
    if (!el) return; const f = v => v.toFixed(dec);
    if (L.reduce) { el.textContent = f(to); return; }
    const t0 = performance.now(), from = +(el.dataset.v || 0);
    const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = f(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else el.dataset.v = to; };
    requestAnimationFrame(step);
  };
  L.tabs = {};
  g.L = L;
})(window);
