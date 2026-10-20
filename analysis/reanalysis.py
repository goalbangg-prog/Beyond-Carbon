"""EPD 데이터 분석: 환경성적표지(EPD) 평가계수 398건 점검 (한국환경산업기술원, 2021-08-02 기준)

1) 입력 오류가 의심되는 계수를 네 가지 기준으로 전수 점검하고
2) 탄소발자국과 다른 영향범주가 원료 계수 수준에서 함께 움직이는지 확인한다.
결측('해당없음')은 0으로 채우지 않고, 영향범주 쌍마다 두 값이 모두 있는 원료만 쓴다.

실행: python analysis/reanalysis.py  ->  data/analysis_results.json, js/results.js
"""
import json
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

df = pd.read_csv("data/lca_factors_clean.csv", encoding="utf-8-sig")
df["단위"] = df["단위"].str.strip()
KEY = dict(zip(["자원", "탄소", "오존", "산성", "부영", "스모그", "물"], df.columns[4:]))
SHORT = {"탄소": "탄소발자국", "자원": "자원발자국", "산성": "산성비", "부영": "부영양화",
         "스모그": "광화학스모그", "물": "물소모", "오존": "오존층영향"}
OTHERS = ["자원", "산성", "부영", "스모그", "물"]
R = {}


def rho(x, y):
    return round(float(spearmanr(x, y)[0]), 2)


# 1) 비교 대상: 원료 및 에너지 생산 단계 · 단위 kg · 수자원(상수·공업용수) 제외
stage = df[df["대분류"] == "원료 및 에너지 생산"]
kg = stage[stage["단위"] == "kg"]
base = kg[kg["구분"] != "수자원"].copy()
R["base_n"] = int(len(kg))
R["pool_n"] = int(len(base))

# 2) 선별 근거
s = kg[[KEY["탄소"], KEY["물"]]].dropna()
R["selection"] = {
    "stage_units": stage["단위"].value_counts().to_dict(),
    "carbon_only_by_stage": {st: int((g[list(KEY.values())].notna().sum(axis=1) == 1).sum()) for st, g in df.groupby("대분류")},
    "pool_median": {SHORT[k]: float(base[c].median()) for k, c in KEY.items()},
    "rho_with_utility_water": rho(s.iloc[:, 0], s.iloc[:, 1]),
}

# 3) 탄소발자국과의 순위상관 + 부트스트랩 95% 범위 (2,000회)
rng = np.random.default_rng(42)
boot = {}
for k in OTHERS:
    x = base[[KEY["탄소"], KEY[k]]].dropna().values
    bs = []
    for _ in range(2000):
        i = rng.integers(0, len(x), len(x))
        bs.append(spearmanr(x[i, 0], x[i, 1])[0])
    lo, hi = np.percentile(bs, [2.5, 97.5])
    boot[SHORT[k]] = {"rho": rho(x[:, 0], x[:, 1]), "lo": round(float(lo), 2), "hi": round(float(hi), 2), "n": int(len(x))}
R["carbon_rho_ci"] = boot


# 4) 각 영향범주 상위 20% 원료 중 탄소발자국도 상위 20%인 원료 (+ 부트스트랩 95% 범위)
def capture(x, q=0.2):
    tc = x[:, 0] >= np.quantile(x[:, 0], 1 - q)
    to = x[:, 1] >= np.quantile(x[:, 1], 1 - q)
    return int((tc & to).sum()), int(to.sum())


cap = {}
for k in OTHERS:
    x = base[[KEY["탄소"], KEY[k]]].dropna().values
    both, top = capture(x)
    bs = [b / t * 100 for b, t in (capture(x[rng.integers(0, len(x), len(x))]) for _ in range(2000))]
    lo, hi = np.percentile(bs, [2.5, 97.5])
    cap[SHORT[k]] = {"포착률": round(both / top * 100), "lo": round(float(lo)), "hi": round(float(hi)),
                     "다른영향상위": top, "함께상위": both, "빠진": top - both, "n": int(len(x))}
R["screening_capture"] = cap

# 5) 상위 기준(10~50%)별 상위 그룹 크기: 모든 범주에서 30종 이상이 되는 가장 작은 기준을 찾는다
R["cutoff_min_top"] = {
    str(round(q * 100)): min(capture(base[[KEY["탄소"], KEY[k]]].dropna().values, q)[1] for k in OTHERS)
    for q in [0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50]}

# 6) 원료 종류(구분)별 상관: 원료 10종 이상인 구분만
for name, k in [("within_category_carbon_water", "물"), ("within_category_carbon_resource", "자원")]:
    out = {}
    for c, g in base.groupby("구분"):
        x = g[[KEY["탄소"], KEY[k]]].dropna()
        if len(x) >= 10:
            out[c] = {"rho": rho(x.iloc[:, 0], x.iloc[:, 1]), "n": int(len(x))}
    R[name] = out
x = base[base["구분"] != "기초화학물질"][[KEY["탄소"], KEY["물"]]].dropna()
R["carbon_water_without_basic_chem"] = {"rho": rho(x.iloc[:, 0], x.iloc[:, 1]), "n": int(len(x))}

# 7) 확인이 필요한 계수 (네 가지 기준, 오류로 단정하지 않음)
num = list(KEY.values())
vals = lambda row: {SHORT[k]: (None if pd.isna(row[c]) else float(row[c])) for k, c in KEY.items()}
same_pairs = []  # 기준 1: 서로 다른 원료의 3개 이상 범주 값이 일치 (398건 전체)
for i in range(len(df)):
    for j in range(i + 1, len(df)):
        a, b = df.iloc[i][num], df.iloc[j][num]
        both = a.notna() & b.notna()
        eq = both & np.isclose(a.astype(float).fillna(-1), b.astype(float).fillna(-2), rtol=1e-9, atol=0)
        if eq.sum() >= 3:
            same_pairs.append({"a": df.iloc[i]["원료_에너지"], "a_cat": df.iloc[i]["구분"],
                               "b": df.iloc[j]["원료_에너지"], "b_cat": df.iloc[j]["구분"],
                               "n_same": int(eq.sum()), "n_both": int(both.sum()),
                               "a_values": vals(df.iloc[i]), "b_values": vals(df.iloc[j])})
shared = []  # 기준 2: 한 범주 값이 다른 원료와 일치 (비교 대상 원료 안에서)
for k, c in KEY.items():
    v = base[c].dropna()
    g = v[v.duplicated(keep=False)]
    for val, idx in g.groupby(g).groups.items():
        shared.append({"impact": SHORT[k], "value": float(val),
                       "items": [{"name": base.loc[i, "원료_에너지"], "cat": base.loc[i, "구분"]} for i in idx]})
extreme = []  # 기준 3: 범주 중앙값의 1만 배 이상 또는 1만분의 1 이하
for k, c in KEY.items():
    v = base[c].dropna()
    dev = np.log10(v) - np.log10(v.median())
    for i in v[abs(dev) >= 4].index:
        extreme.append({"impact": SHORT[k], "name": base.loc[i, "원료_에너지"], "cat": base.loc[i, "구분"],
                        "value": float(v[i]), "times_median": float(10 ** dev[i])})
oz = df[KEY["오존"]].dropna()  # 기준 4: 오존층영향 1kg당 0.001 kg CFC-11 eq 이상 (398건 전체)
ozone_hi = [{"name": df.loc[i, "원료_에너지"], "stage": df.loc[i, "대분류"], "value": float(oz[i])}
            for i in oz[oz >= 1e-3].sort_values(ascending=False).index]
R["review"] = {"same_pairs": same_pairs, "shared_values": shared, "extreme": extreme,
               "ozone_range": [float(oz.min()), float(oz.max())], "ozone_n": int(len(oz)), "ozone_hi": ozone_hi}

# 8) 확인이 필요한 계수를 빼도 결론이 같은가
flag_strong = {n for p in same_pairs for n in (p["a"], p["b"])} | {e["name"] for e in extreme}
flag_all = flag_strong | {it["name"] for g in shared for it in g["items"]}


def without(exclude, k):
    x = base[~base["원료_에너지"].isin(exclude)][[KEY["탄소"], KEY[k]]].dropna().values
    both, top = capture(x)
    return {"rho": rho(x[:, 0], x[:, 1]), "rate": round(both / top * 100), "n": int(len(x))}


R["review_sensitivity"] = {
    "strong": {"excluded": sorted(flag_strong), **{SHORT[k]: without(flag_strong, k) for k in OTHERS}},
    "all": {"excluded_n": len(flag_all), **{SHORT[k]: without(flag_all, k) for k in OTHERS}}}

json.dump(R, open("data/analysis_results.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open("js/results.js", "w", encoding="utf-8").write("window.LCA_RESULTS=" + json.dumps(R, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(json.dumps({k: R[k] for k in ["base_n", "pool_n", "carbon_rho_ci", "cutoff_min_top"]}, ensure_ascii=False, indent=1))
