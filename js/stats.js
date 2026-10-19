/* 통계 도구 (외부 라이브러리 없이). Python(scipy) 결과와 같은지 tests/stats.test.js 에서 검산한다. */
(function (g) {
  const S = {};
  S.mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  S.median = a => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null; };
  S.quantile = (a, q) => { const b = [...a].sort((x, y) => x - y), p = (b.length - 1) * q, i = Math.floor(p); return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i); };
  // 같은 값은 평균 순위 (scipy.stats.rankdata 와 같은 방식)
  S.rank = a => {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let t = i; t <= j; t++) r[idx[t][1]] = avg; i = j + 1; }
    return r;
  };
  S.pearson = (x, y) => { const mx = S.mean(x), my = S.mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN; };
  S.spearman = (x, y) => S.pearson(S.rank(x), S.rank(y));
  // 값 v 가 기준 집합 ref 에서 차지하는 위치 (0~100)
  S.percentile = (ref, v) => { let below = 0, eq = 0; for (const x of ref) { if (x < v) below++; else if (x === v) eq++; } return (below + eq / 2) / ref.length * 100; };
  g.S = S;
})(window);
