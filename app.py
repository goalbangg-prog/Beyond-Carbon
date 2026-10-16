import numpy as np
import pandas as pd
import streamlit as st
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

st.set_page_config(page_title="LCA 미니 계산기", layout="wide")

CSV_PATH = "lca_factors_clean.csv"

CARBON = "탄소발자국(kg CO2 eq)"
# 빈 값이 너무 많은 광화학스모그, 오존층영향은 제외
IMPACT_COLS = [
    CARBON,
    "자원발자국(kg Sb eq)",
    "산성비(kg SO2 eq)",
    "부영양화(kg PO43- eq)",
    "물소모계수(m3 H2O eq)",
]
# 단위가 제각각인 화학반응공정은 계산기에서 제외
CALC_STAGES = ["원료 및 에너지 생산", "수송", "연료원별 사용", "폐기물 처리"]


@st.cache_data
def load_data():
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    df[IMPACT_COLS] = df[IMPACT_COLS].apply(pd.to_numeric, errors="coerce")
    df["라벨"] = (
        df["대분류"] + " | " + df["구분"] + " | " + df["원료_에너지"] + " | " + df["단위"].str.strip()
    )
    return df


df = load_data()

st.title("LCA 미니 계산기")
st.caption(
    "한국환경산업기술원 환경성적표지 평가계수(2021년 기준, 공공데이터포털)로 만든 **연습용** 앱입니다. "
    "실제 LCA 결과나 인증 값이 아닙니다."
)

tab1, tab2, tab3 = st.tabs(["① 계산기", "② 원료 둘러보기", "③ 비슷한 원료 묶기"])

# ---------------------------------------------------------------- 탭 1
with tab1:
    st.subheader("제품에 들어가는 것들을 골라 사용량을 넣어보세요")
    calc = df[df["대분류"].isin(CALC_STAGES)]
    picked = st.multiselect("원료·에너지·수송·폐기 항목 선택", calc["라벨"].tolist())

    rows = []
    for lab in picked:
        r = calc[calc["라벨"] == lab].iloc[0]
        amount = st.number_input(
            f"{lab}  →  사용량 ({r['단위'].strip()})", min_value=0.0, value=1.0, key=lab
        )
        rows.append((r, amount))

    if rows:
        res = pd.DataFrame(
            [
                {"항목": r["라벨"], "단계": r["대분류"], **{c: amount * r[c] for c in IMPACT_COLS}}
                for r, amount in rows
            ]
        )
        total = res[IMPACT_COLS].sum(min_count=1)
        n_missing = res[IMPACT_COLS].isna().sum()

        st.markdown("### 결과 합계")
        summary = pd.DataFrame(
            {"합계": total, "값이 없는 항목 수": n_missing, "선택한 항목 수": len(res)}
        )
        st.dataframe(summary, use_container_width=True)
        if (n_missing > 0).any():
            st.warning(
                "일부 항목은 계수가 비어 있어서(해당없음) 합계에 포함되지 않았습니다. "
                "그 영향 항목의 합계는 실제보다 작을 수 있습니다."
            )

        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**항목별 탄소발자국 (kg CO2 eq)**")
            st.bar_chart(res.set_index("항목")[CARBON])
        with c2:
            st.markdown("**단계별 탄소발자국 (kg CO2 eq)**")
            st.bar_chart(res.groupby("단계")[CARBON].sum())

        st.caption(
            "시스템 경계: 이 데이터에 들어 있는 원료·에너지 생산, 수송, 연료 사용, 폐기 계수만 사용했습니다. "
            "제품 사용 단계 등은 포함되어 있지 않습니다."
        )
    else:
        st.info("위에서 항목을 하나 이상 선택해 주세요.")

# ---------------------------------------------------------------- 탭 2
with tab2:
    st.subheader("단계와 단위를 골라 탄소발자국 상위 항목 보기")
    stage = st.selectbox("대분류", df["대분류"].unique())
    sub = df[df["대분류"] == stage]
    unit = st.selectbox("단위 (같은 단위끼리만 비교할 수 있어요)", sub["단위"].str.strip().value_counts().index)
    sub = sub[sub["단위"].str.strip() == unit]
    top = sub.nlargest(10, CARBON)[["구분", "원료_에너지", CARBON]]
    top["이름"] = top["구분"] + " / " + top["원료_에너지"]
    st.bar_chart(top.set_index("이름")[CARBON])
    st.dataframe(top[["구분", "원료_에너지", CARBON]], use_container_width=True)

# ---------------------------------------------------------------- 탭 3
with tab3:
    st.subheader("계수가 비슷한 원료끼리 묶어보기 (탐색용)")
    base = df[(df["대분류"] == "원료 및 에너지 생산") & (df["단위"].str.strip() == "kg")]
    base = base.dropna(subset=IMPACT_COLS)
    base = base[(base[IMPACT_COLS] > 0).all(axis=1)].copy()

    st.write(
        f"5개 영향 항목의 값이 모두 있고 양수인 원료 **{len(base)}개**를 사용합니다. "
        "값 차이가 크기 때문에 로그(log10)로 바꾼 뒤 표준화해서 KMeans로 묶었습니다."
    )

    k = st.slider("묶음 개수", 2, 6, 4)
    if len(base) < k * 5:
        st.warning("묶을 데이터가 너무 적습니다. 묶음 개수를 줄여보세요.")
    else:
        X = StandardScaler().fit_transform(np.log10(base[IMPACT_COLS]))
        base["묶음"] = (KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(X) + 1).astype(str)
        base["log10 탄소"] = np.log10(base[CARBON])
        base["log10 자원"] = np.log10(base["자원발자국(kg Sb eq)"])
        base["이름"] = base["구분"] + " / " + base["원료_에너지"]

        st.scatter_chart(base, x="log10 탄소", y="log10 자원", color="묶음")
        st.markdown("**묶음별 중앙값 (원래 단위)**")
        st.dataframe(base.groupby("묶음")[IMPACT_COLS].median(), use_container_width=True)
        st.markdown("**묶음별 원료 목록**")
        st.dataframe(base.sort_values("묶음")[["묶음", "이름", CARBON]], use_container_width=True)
        st.caption("데이터 탐색용 분류이며, 공식적인 분류나 인증 기준이 아닙니다.")

st.divider()
st.caption(
    "출처: 한국환경산업기술원 환경성적표지 평가계수(2021년 기준), 공공데이터포털 · "
    "'해당없음'은 0이 아니라 빈 값으로 처리했습니다."
)
