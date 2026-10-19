"""Beyond Carbon 분석: 환경성적표지(EPD) 평가계수 398건(한국환경산업기술원, 2021-08-02 기준)
질문: 탄소발자국만 보면 다른 환경영향을 놓치지 않을까?
원자료(7개 영향 전부)에서 시작하고, 결측은 0으로 채우지 않으며 영향별로 쓸 수 있는 값만 쓴다.
실행: python3 analysis/reanalysis.py  -> data/analysis_results.json, js/results.js, data/clusters_k*.csv(부록)
"""
import json, numpy as np, pandas as pd
from scipy.stats import spearmanr
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score, adjusted_rand_score

df = pd.read_csv("data/lca_factors_clean.csv", encoding="utf-8-sig")
df["단위"] = df["단위"].str.strip()
COLS = list(df.columns[4:])
KEY = dict(zip(["자원","탄소","오존","산성","부영","스모그","물"], COLS))
SHORT = {"탄소":"탄소발자국","자원":"자원발자국","산성":"산성비","부영":"부영양화","스모그":"광화학스모그","물":"물소모","오존":"오존층영향"}
R = {}

# 1) 영향별 채워진 비율 (대분류별)
cov = {}
for st, g in df.groupby("대분류"):
    cov[st] = {"항목수": int(len(g)), **{SHORT[k]: round(float(g[c].notna().mean()*100), 1) for k, c in KEY.items()}}
R["coverage_by_stage"] = cov

# 2) 분석 범위: 원료 및 에너지 생산 + kg
base = df[(df["대분류"]=="원료 및 에너지 생산") & (df["단위"]=="kg")].copy()
R["base_n"] = int(len(base))
R["coverage_base"] = {SHORT[k]: round(float(base[c].notna().mean()*100), 1) for k, c in KEY.items()}
# 수돗물·공업용수는 '재료'가 아니라 물 자체라 값이 1000배 작아 따로 둔다
util = base[base["구분"]=="수자원"]
base = base[base["구분"]!="수자원"].copy()
R["utility_water"] = util["원료_에너지"].tolist()
R["pool_n"] = int(len(base))

# 3) 묶을 때 쓸 영향: 원료·kg 항목에서 85% 이상 채워진 것만
cov_pool = {k: float(base[c].notna().mean()) for k, c in KEY.items()}
FEAT = [k for k, v in cov_pool.items() if v >= 0.85]
R["feature_rule"] = "원료·kg 항목에서 85% 이상 채워진 영향만 묶는 데 사용"
R["coverage_pool"] = {SHORT[k]: round(v*100, 1) for k, v in cov_pool.items()}
R["features"] = [SHORT[k] for k in FEAT]
fc = [KEY[k] for k in FEAT]
d = base.dropna(subset=fc).copy()
R["cluster_n"] = int(len(d)); R["cluster_excluded_n"] = int(len(base)-len(d))

# 4) 빠진 항목이 어느 쪽에 쏠리는지 (구분별)
t = pd.DataFrame({"전체": base["구분"].value_counts(), "분석": d["구분"].value_counts()}).fillna(0).astype(int)
t["빠진비율"] = ((t["전체"]-t["분석"])/t["전체"]*100).round(0).astype(int)
R["bias_by_category"] = t.reset_index().rename(columns={"구분":"구분"}).to_dict("records")
core3 = base.dropna(subset=[KEY[k] for k in ["탄소","자원","산성"]])
R["core3_n"] = int(len(core3))
t3 = pd.DataFrame({"전체": base["구분"].value_counts(), "핵심3": core3["구분"].value_counts()}).fillna(0).astype(int)
R["bias_core3"] = {i: int(r["핵심3"]) for i, r in t3.iterrows()}
# 비교: 예전 방식(5개 영향 모두 필요)
old = base.dropna(subset=[KEY[k] for k in ["탄소","자원","산성","부영","물"]])
R["old_rule_n"] = int(len(old))

# 5) [부록] k-means 군집: 탐색적으로 시도했으나 경계가 뚜렷하지 않음 (웹에서는 요약만 표시) (로그 → 표준화), k=2..6
X = StandardScaler().fit_transform(np.log10(d[fc].values))
pca = np.round(__import__("sklearn.decomposition", fromlist=["PCA"]).PCA().fit(X).explained_variance_ratio_, 3).tolist()
R["pca_ratio"] = pca
rows, models = [], {}
for k in range(2, 7):
    ms = [KMeans(k, n_init=10, random_state=s).fit(X) for s in range(20)]
    m = min(ms, key=lambda z: z.inertia_); models[k] = m
    ari = float(np.mean([adjusted_rand_score(m.labels_, z.labels_) for z in ms]))
    rows.append({"k": k, "실루엣": round(float(silhouette_score(X, m.labels_)),3), "DB": round(float(davies_bouldin_score(X, m.labels_)),2),
                 "안정성": round(ari,2), "크기": sorted(np.bincount(m.labels_).tolist(), reverse=True), "최소군집": int(np.bincount(m.labels_).min())})
R["k_scores"] = rows

# 6) 다른 특성 조합과의 일치도 (같은 항목끼리 비교)
def labels_for(cols, k):
    dd = base.dropna(subset=cols)
    Z = StandardScaler().fit_transform(np.log10(dd[cols].values))
    m = min([KMeans(k, n_init=10, random_state=s).fit(Z) for s in range(10)], key=lambda z: z.inertia_)
    return pd.Series(m.labels_, index=dd.index)
K = None  # 아래에서 정함
R["_sens_pending"] = True

# k 선택 규칙(미리 정해 둔 기준): 안정성 0.95 이상, 가장 작은 군집이 전체의 10% 이상인 k 중 Davies-Bouldin이 가장 낮은 k
ok = [r for r in rows if r["안정성"] >= 0.95 and r["최소군집"] >= 0.10*len(d)]
K = min(ok, key=lambda r: r["DB"])["k"] if ok else 3
R["chosen_k"] = K
R["k_rule"] = "안정성 0.95 이상 · 가장 작은 군집이 전체의 10% 이상 · 그중 Davies-Bouldin이 가장 낮은 k"
R["k_candidates"] = [r["k"] for r in ok]
m = models[K]; d["cluster_raw"] = m.labels_
# 군집 번호는 탄소 중앙값이 낮은 순서로 1,2,3...
order = d.groupby("cluster_raw")[KEY["탄소"]].median().sort_values().index.tolist()
remap = {o: i+1 for i, o in enumerate(order)}; d["군집"] = d["cluster_raw"].map(remap)

# 7) 군집 설명: 7개 영향 전부의 중앙값과, 값이 있는 항목 수
prof = []
for c, g in d.groupby("군집"):
    rec = {"군집": int(c), "항목수": int(len(g))}
    for k, col in KEY.items():
        s = g[col].dropna()
        rec[SHORT[k]] = {"중앙값": float(s.median()) if len(s) else None, "n": int(len(s))}
    rec["구분"] = g["구분"].value_counts().to_dict()
    rec["예시"] = g.sort_values(KEY["탄소"])["원료_에너지"].iloc[[0, len(g)//2, -1]].tolist()
    prof.append(rec)
R["cluster_profile"] = prof
R["cluster_members"] = {str(int(i)): int(c) for i, c in d["군집"].items()}
R["cluster_overall_median"] = {SHORT[k]: float(d[col].median()) for k, col in KEY.items() if k != "오존"}
# 구분이 군집을 얼마나 설명하나 (순수도): 구분별로 가장 많은 군집의 비율
ct = pd.crosstab(d["구분"], d["군집"])
big = ct[ct.sum(axis=1) >= 8]
R["category_purity"] = {i: round(float(r.max()/r.sum()*100),0) for i, r in big.iterrows()}
R["category_by_cluster"] = {int(c): ct[c].to_dict() for c in ct.columns}

# 8) 민감도: 특성을 바꿔도 같은 군집이 나오나 (공통 항목, ARI)
sens = {}
for name, cs in {"3개(탄소·자원·산성)": ["탄소","자원","산성"], "5개(+부영양화)": ["탄소","자원","산성","부영","물"], "6개(+스모그)": ["탄소","자원","산성","부영","물","스모그"]}.items():
    lab = labels_for([KEY[c] for c in cs], K)
    common = lab.index.intersection(d.index)
    sens[name] = {"n": int(len(lab)), "공통": int(len(common)), "ARI": round(float(adjusted_rand_score(d.loc[common,"군집"], lab.loc[common])),2)}
R["sensitivity"] = sens
R.pop("_sens_pending")

# 9) 상관 (순위 상관, 영향별로 쓸 수 있는 쌍만) - 전체 pool
names = [k for k in KEY if k != "오존"]
mat = {}
for a in names:
    for b in names:
        if a < b or a == b: continue
        s = base[[KEY[a], KEY[b]]].dropna()
        mat[f"{SHORT[a]}|{SHORT[b]}"] = {"rho": round(float(spearmanr(s.iloc[:,0], s.iloc[:,1])[0]),2), "n": int(len(s))}
R["spearman_pairs"] = mat
within = {}
for c, g in base.groupby("구분"):
    s = g[[KEY["탄소"], KEY["자원"]]].dropna()
    if len(s) >= 10: within[c] = {"rho": round(float(spearmanr(s.iloc[:,0], s.iloc[:,1])[0]),2), "n": int(len(s))}
R["within_category_carbon_resource"] = within

# 10) 탄소만 보면 놓치는 것: 같은 집단 안에서 매긴 순위(백분위) 비교
# 두 영향 값이 모두 있는 원료끼리만 순위를 매긴다. (서로 다른 집단에서 매긴 순위를 빼면 비교가 어긋난다)
PAIRK = ["자원","산성","부영","스모그","물"]
def paired_pct(k):
    s = base[[KEY["탄소"], KEY[k]]].dropna()
    return pd.DataFrame({"탄소": s[KEY["탄소"]].rank(pct=True)*100, "다른": s[KEY[k]].rank(pct=True)*100})
PP = {k: paired_pct(k) for k in PAIRK}
def hidden_list(th):
    out = {}
    for k, t in PP.items():
        dd = t["다른"] - t["탄소"]
        for i, v in dd.items():
            if v >= th and (i not in out or v > out[i][1]): out[i] = (k, v)
    return out
hb = hidden_list(40)
hid = sorted([{"이름": base.loc[i,"원료_에너지"], "구분": base.loc[i,"구분"], "탄소순위(%)": round(float(PP[k].loc[i,"탄소"]),0),
               "더큰영향": SHORT[k], "그영향순위(%)": round(float(PP[k].loc[i,"다른"]),0), "차이": round(float(v),0)} for i, (k, v) in hb.items()], key=lambda x: -x["차이"])
R["hidden_burden"] = hid[:15]; R["hidden_burden_n"] = len(hid)
R["hidden_rank_rule"] = "영향 쌍마다 두 값이 모두 있는 원료끼리 순위를 매겨 비교"
# 영향별로 따로 센 수 (첫 화면 렌즈용)
R["hidden_per_impact"] = {SHORT[k]: int(((t["다른"]-t["탄소"]) >= 40).sum()) for k, t in PP.items()}
R["carbon_top10"] = base.nlargest(10, KEY["탄소"])[["구분","원료_에너지",KEY["탄소"]]].rename(columns={KEY["탄소"]:"탄소"}).to_dict("records")
c = base[KEY["탄소"]]
R["carbon_range"] = {"min": float(c.min()), "median": float(c.median()), "max": float(c.max()), "배율": round(float(c.max()/c.min()),0), "p10": float(c.quantile(.1)), "p90": float(c.quantile(.9))}

# 11) 다른 단계의 쓸 수 있는 범위
R["stage_notes"] = {
 "연료원별 사용": "탄소발자국만 있음 (다른 6개 영향은 전부 비어 있음)",
 "화학반응공정": "탄소발자국만 있음, 단위가 제각각",
 "폐기물 처리": f"항목 {int((df['대분류']=='폐기물 처리').sum())}개, 영향 값은 약 60~75%만 채워짐",
 "수송": "ton.km 기준 10개, 영향별로 50~100% 채워짐"}


# ---------------------------------------------------------------
# 12) 핵심 질문 보강: 상관계수의 불확실성 (부트스트랩 95% 구간, 2,000회)
rng = np.random.default_rng(42)
OTHERS = ["자원","산성","부영","스모그","물"]
boot = {}
for k in OTHERS:
    s = base[[KEY["탄소"], KEY[k]]].dropna().values
    rho0 = float(spearmanr(s[:,0], s[:,1])[0]); bs = []
    for _ in range(2000):
        i = rng.integers(0, len(s), len(s)); bs.append(spearmanr(s[i,0], s[i,1])[0])
    lo, hi = np.percentile(bs, [2.5, 97.5])
    boot[SHORT[k]] = {"rho": round(rho0,2), "lo": round(float(lo),2), "hi": round(float(hi),2), "n": int(len(s))}
R["carbon_rho_ci"] = boot

# 13) 실무 질문: 탄소 상위 20%만 관리하면, 다른 영향의 상위 20%를 몇 % 잡아내나 (선별 포착률 + 부트스트랩 95% 구간)
def capture_rate(x):
    tc = x[:,0] >= np.quantile(x[:,0], 0.8); to = x[:,1] >= np.quantile(x[:,1], 0.8)
    return (tc & to).sum(), to.sum()
cap = {}
for k in OTHERS:
    s = base[[KEY["탄소"], KEY[k]]].dropna().values
    both, top = capture_rate(s); bs = []
    for _ in range(2000):
        bb, tt = capture_rate(s[rng.integers(0, len(s), len(s))]); bs.append(bb/tt*100)
    lo, hi = np.percentile(bs, [2.5, 97.5])
    cap[SHORT[k]] = {"포착률": round(float(both/top*100),0), "lo": round(float(lo),0), "hi": round(float(hi),0), "다른영향상위": int(top), "함께상위": int(both), "빠진": int(top-both), "n": int(len(s))}
R["screening_capture"] = cap
R["screening_rule"] = "각 영향에서 상위 20%(값이 큰 쪽)인 원료 중, 탄소발자국도 상위 20%인 원료의 비율. 무작위로 고르면 약 20%"

# 14) 기준 민감도: '놓치는 원료' 기준(순위 차이)을 바꾸면 몇 종인가
R["hidden_threshold"] = {str(t): len(hidden_list(t)) for t in [20, 30, 40, 50, 60]}
R["hidden_by_impact"] = pd.Series([h["더큰영향"] for h in hid]).value_counts().to_dict()
R["hidden_by_category"] = pd.Series([h["구분"] for h in hid]).value_counts().to_dict()

# 15) 소재군 효과 확인: 같은 구분 안에서도 탄소–물 관계가 약한가 (항목 10개 이상 구분)
wcw = {}
for c, g in base.groupby("구분"):
    s = g[[KEY["탄소"], KEY["물"]]].dropna()
    if len(s) >= 10: wcw[c] = {"rho": round(float(spearmanr(s.iloc[:,0], s.iloc[:,1])[0]),2), "n": int(len(s))}
R["within_category_carbon_water"] = wcw
s = base[base["구분"]!="기초화학물질"][[KEY["탄소"], KEY["물"]]].dropna()
R["carbon_water_without_basic_chem"] = {"rho": round(float(spearmanr(s.iloc[:,0], s.iloc[:,1])[0]),2), "n": int(len(s))}

# 16) 단계별 격차: 수송(ton·km)과 폐기(kg)
tr = df[df["대분류"]=="수송"]
R["transport"] = [{"구분": r["구분"], "이름": r["원료_에너지"], **{SHORT[k]: (None if pd.isna(r[KEY[k]]) else float(r[KEY[k]])) for k in KEY}} for _, r in tr.iterrows()]
tc = tr.set_index("원료_에너지")[KEY["탄소"]]
R["transport_ratio_air_vs_ship"] = round(float(tc["항공"]/tc.min()), 0)
R["transport_min_name"] = str(tc.idxmin())
ws = df[(df["대분류"]=="폐기물 처리") & (df["구분"].isin(["매립","소각","재활용"]))]
R["waste"] = [{"구분": r["구분"], "이름": r["원료_에너지"], **{SHORT[k]: (None if pd.isna(r[KEY[k]]) else float(r[KEY[k]])) for k in KEY}} for _, r in ws.iterrows()]
wm = ws.groupby("구분")[KEY["탄소"]].median()
R["waste_median_carbon"] = {k: float(v) for k, v in wm.items()}
R["waste_ratio_incin_vs_recycle"] = round(float(wm["소각"]/wm["재활용"]), 0)
# 같은 폐기물을 소각 vs 재활용 (이름이 짝지어지는 것만)
pairs = []
for nm in ["폐목","폐유리","폐지","혼합폐플라스틱","폐금속"]:
    a = ws[(ws["구분"]=="소각") & ws["원료_에너지"].str.startswith(nm)]
    b = ws[(ws["구분"]=="재활용") & ws["원료_에너지"].str.contains(nm.replace("폐금속","폐철금속"))]
    if len(a) and len(b):
        pairs.append({"폐기물": nm, "소각": float(a[KEY["탄소"]].iloc[0]), "재활용": float(b[KEY["탄소"]].iloc[0]), "배율": round(float(a[KEY["탄소"]].iloc[0]/b[KEY["탄소"]].iloc[0]),0)})
R["waste_pairs"] = pairs
R["recycling_any_negative"] = bool((ws[ws["구분"]=="재활용"][list(KEY.values())] < 0).any().any())

out = d[["대분류","구분","원료_에너지","단위"]+fc+["군집"]]
out.to_csv(f"data/clusters_k{K}.csv", encoding="utf-8-sig", index=True, index_label="행번호")
json.dump(R, open("data/analysis_results.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
open("js/results.js","w",encoding="utf-8").write("window.LCA_RESULTS="+json.dumps(R, ensure_ascii=False, separators=(",",":"))+";\n")
print(json.dumps({k:R[k] for k in ["base_n","pool_n","features","cluster_n","old_rule_n","coverage_pool","pca_ratio","k_scores","chosen_k","sensitivity","category_purity","carbon_range","hidden_burden_n"]}, ensure_ascii=False, indent=1))
