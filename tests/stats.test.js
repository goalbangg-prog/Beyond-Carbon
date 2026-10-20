// node tests/stats.test.js — 웹 화면의 계산이 Python 결과(js/results.js)와 같은지 검산한다 (외부 의존성 없음)
global.window = global; global.matchMedia = () => ({ matches: false });
require('../js/data.js'); require('../js/results.js'); require('../js/stats.js'); require('../js/common.js');
let n = 0;
const eq = (a, b, m, t = 1e-9) => { n++; if (!(Math.abs(a - b) <= t)) { console.error('FAIL', m, a, b); process.exitCode = 1; } else console.log('ok  ', m); };
const R = window.LCA_RESULTS, J = L.J;

// 통계 함수
eq(S.mean([1, 2, 3, 4]), 2.5, 'mean'); eq(S.median([5, 1, 3]), 3, 'median'); eq(S.median([1, 2, 3, 4]), 2.5, 'median (짝수)');
eq(S.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 'pearson +1'); eq(S.pearson([1, 2, 3], [3, 2, 1]), -1, 'pearson -1');
eq(S.spearman([1, 10, 100, 1000], [1, 2, 3, 4]), 1, 'spearman 단조 증가'); eq(S.spearman([1, 2, 2, 3], [1, 2, 2, 3]), 1, 'spearman 동순위');

// 비교 대상 원료
eq(L.POOL.length, R.pool_n, '비교 대상 원료 수 = Python');

// 탄소발자국과의 순위상관, 상위 20% 원료 수, 순위 집단
for (const k of L.OTHERS) {
  const rows = L.POOL.filter(r => r.v[J('탄소')] != null && r.v[J(k)] != null), py = R.carbon_rho_ci[L.RKEY[k]];
  eq(+S.spearman(rows.map(r => r.v[J('탄소')]), rows.map(r => r.v[J(k)])).toFixed(2), py.rho, `탄소–${k} ρ = Python`);
  eq(rows.length, py.n, `탄소–${k} 원료 수 = Python`);
  const t = L.top20(k), c = R.screening_capture[L.RKEY[k]];
  eq(t.both.length, c['함께상위'], `${k} 상위 20% 중 탄소발자국도 상위 = Python`); eq(t.to.size, c['다른영향상위'], `${k} 상위 20% 원료 수 = Python`);
  const v = Object.values(L.PP[k]); eq(Math.max(...v.map(p => p.c)), 100, `${k} 쌍의 탄소 백분위 최댓값 100`);
}

// 확인이 필요한 계수
const pr = R.review.same_pairs.find(p => [p.a, p.b].includes('납'));
eq(pr ? pr.n_same : 0, 5, '납–염소 5개 범주 일치');
const wood = R.review.same_pairs.find(p => [p.a, p.b].includes('우드칩'));
eq(wood.a_values['오존층영향'] ?? wood.b_values['오존층영향'], wood.b_values['산성비'] ?? wood.a_values['산성비'], '파티클보드 오존층영향 = 우드칩 산성비');
eq(R.review.extreme.length, 2, '자릿수 이상 2건'); eq(R.review.ozone_hi.length, 4, '오존층영향 고값 4건');
eq(R.cutoff_min_top['20'] >= 30 && R.cutoff_min_top['15'] < 30 ? 1 : 0, 1, '20%가 상위 그룹 30종 이상인 최소 기준');

// 산정 예시: 2kg 가전에 기기선 1g → 물발자국 기여율 98.9%
const wire = R.review.extreme.find(x => x.name.startsWith('기기선')), med = wire.value / wire.times_median;
eq(+(0.001 * wire.value / (0.001 * wire.value + 1.999 * med) * 100).toFixed(1), 98.9, '기기선 1g 기여율 98.9%');
console.log(`\n${n}개 항목 확인`);
