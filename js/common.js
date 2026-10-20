/* 공통: 데이터 준비와 표시 도구 */
(function (g) {
  const L = {};
  L.D = window.LCA_DATA; L.RES = window.LCA_RESULTS;
  // v 배열의 순서와 같다
  L.IMP = [
    { k: '탄소', name: '탄소발자국' }, { k: '자원', name: '자원발자국' }, { k: '산성', name: '산성비' }, { k: '부영', name: '부영양화' },
    { k: '물', name: '물발자국' }, { k: '스모그', name: '광화학스모그' }, { k: '오존', name: '오존층영향' }
  ];
  L.J = k => L.IMP.findIndex(i => i.k === k);
  L.NAME = Object.fromEntries(L.IMP.map(i => [i.k, i.name]));
  // 탄소발자국과 비교하는 다섯 범주, Python 결과(json)의 영향 이름
  L.OTHERS = ['자원', '산성', '부영', '스모그', '물'];
  L.RKEY = { 탄소: '탄소발자국', 자원: '자원발자국', 산성: '산성비', 부영: '부영양화', 스모그: '광화학스모그', 물: '물소모', 오존: '오존층영향' };
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
  L.POOL = L.D.filter(r => r.stage === '원료 및 에너지 생산' && r.unit === 'kg' && r.category !== '수자원');
  L.coverage = (rows, j) => rows.length ? rows.filter(r => r.v[j] != null).length / rows.length : 0;
  L.has = (rows, j) => rows.filter(r => r.v[j] != null);
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
  // 상위 20% 선별: 값이 80% 분위수 이상 (numpy.quantile 과 같은 선형 보간)
  L.top20 = k => {
    const jc = L.J('탄소'), j = L.J(k), rows = L.POOL.filter(r => r.v[jc] != null && r.v[j] != null);
    const qc = S.quantile(rows.map(r => r.v[jc]), .8), qo = S.quantile(rows.map(r => r.v[j]), .8);
    const tc = new Set(rows.filter(r => r.v[jc] >= qc).map(r => r.id)), to = new Set(rows.filter(r => r.v[j] >= qo).map(r => r.id));
    return { tc, to, both: [...to].filter(id => tc.has(id)), missed: [...to].filter(id => !tc.has(id)) };
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
