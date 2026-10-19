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
for (const t of ['20', '30', '40', '50', '60']) eq(L.hidden(+t).length, R.hidden_threshold[t], `놓치는 원료(${t}%p) = Python`);
for (const k of L.OTHERS) { const t = L.top20(k), c = R.screening_capture[L.RKEY[k]]; eq(t.both.length, c['함께상위'], `선별 포착(${k}) 함께 잡힘 = Python`); eq(t.to.size, c['다른영향상위'], `선별 포착(${k}) 상위 수 = Python`); }
// 순위는 두 값이 모두 있는 원료끼리 매긴다: 영향 쌍마다 백분위 최댓값이 100
for (const k of L.OTHERS) { const v = Object.values(L.PP[k]); eq(Math.max(...v.map(p => p.c)), 100, `${k} 쌍의 탄소 백분위 최댓값 100`); eq(v.length, R.carbon_rho_ci[L.RKEY[k]].n, `${k} 쌍 원료 수 = Python`); }
// 검토가 필요한 값: 납과 염소는 5개 범주가 같다
const pr = R.review.same_pairs.find(p => [p.a, p.b].includes('납'));
eq(pr ? pr.n_same : 0, 5, '납–염소 5개 범주 일치');
eq(R.cutoff_min_top['20'] >= 30 && R.cutoff_min_top['15'] < 30 ? 1 : 0, 1, '20%가 상위 그룹 30종 이상인 최소 기준');
eq(R.verdict['물소모'] === '어긋남' ? 1 : 0, 1, '물발자국 = 짐작하기 어렵다(세 기준 모두 절반 미만)');
