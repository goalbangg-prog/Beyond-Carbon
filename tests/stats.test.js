// node tests/stats.test.js — 통계 함수와 웹 계산이 Python 결과와 같은지 검산 (외부 의존성 없음)
global.window = global; global.matchMedia = () => ({ matches: false });
require('../js/data.js'); require('../js/results.js'); require('../js/stats.js'); require('../js/common.js');
const eq = (a, b, m, t = 1e-9) => { if (!(Math.abs(a - b) <= t)) { console.error('FAIL', m, a, b); process.exitCode = 1; } else console.log('ok  ', m); };
eq(S.mean([1, 2, 3, 4]), 2.5, 'mean'); eq(S.median([5, 1, 3]), 3, 'median'); eq(S.median([1, 2, 3, 4]), 2.5, 'median even');
eq(S.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 'pearson +1'); eq(S.pearson([1, 2, 3], [3, 2, 1]), -1, 'pearson -1');
eq(S.spearman([1, 10, 100, 1000], [1, 2, 3, 4]), 1, 'spearman monotone');
eq(S.spearman([1, 2, 2, 3], [1, 2, 2, 3]), 1, 'spearman ties');
const R = window.LCA_RESULTS;
eq(L.POOL.length, R.pool_n, '원료 풀 크기 = Python');
for (const k of L.OTHERS) { const p = L.pair('탄소', k), py = R.carbon_rho_ci[L.RKEY[k]]; eq(+p.rho.toFixed(2), py.rho, `탄소–${k} ρ = Python`, 1e-9); eq(p.n, py.n, `탄소–${k} n = Python`); }
for (const t of ['30', '40', '50', '60']) eq(L.hidden(+t).length, R.hidden_threshold[t], `놓치는 원료(${t}%p) = Python`);
