from pathlib import Path
import altair as alt
import numpy as np
import pandas as pd
import streamlit as st
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

# =====================================================================
# 기본 설정
# =====================================================================
st.set_page_config(page_title="LCA 미니 계산기", page_icon="🌏", layout="wide")

st.markdown(
    """
    <style>
    .block-container {padding-top: 2rem; max-width: 1200px;}
    [data-testid="stMetricValue"] {font-size: 1.5rem;}
    </style>
    """,
    unsafe_allow_html=True,
)

CSV_PATH = str(Path(__file__).resolve().parent.parent / "data" / "lca_factors_clean.csv")

# 짧은 이름: (CSV 열 이름, 표시용 단위)
IMPACTS = {
    "탄소": ("탄소발자국(kg CO2 eq)", "kg CO2 eq"),
    "자원": ("자원발자국(kg Sb eq)", "kg Sb eq"),
    "산성비": ("산성비(kg SO2 eq)", "kg SO2 eq"),
    "부영양화": ("부영양화(kg PO43- eq)", "kg PO43- eq"),
    "물소모": ("물소모계수(m3 H2O eq)", "m3 H2O eq"),
}
KEYS = list(IMPACTS)
IMPACT_HELP = {
    "탄소": "지구온난화에 영향을 주는 온실가스 양",
    "자원": "광물·화석연료 같은 자원이 줄어드는 정도",
    "산성비": "대기오염으로 비나 토양이 산성이 되는 정도",
    "부영양화": "물에 영양분이 늘어 녹조 등이 생기는 정도",
    "물소모": "사용한 물의 양",
}
# 계산기에서 쓰는 단계 (단위가 제각각인 화학반응공정은 제외)
CALC_STAGES = ["원료 및 에너지 생산", "수송", "연료원별 사용", "폐기물 처리"]

# 단위 변환표: 각 묶음의 기준 단위 대비 배수
UNIT_FAMILIES = {
    "질량": {"mg": 1e-6, "g": 1e-3, "kg": 1.0, "t": 1000.0, "lb": 0.45359237},
    "부피": {"mL": 1e-3, "L": 1.0, "m3": 1000.0, "kL": 1000.0, "gal(US)": 3.785411784},
    "에너지": {"MJ": 1.0, "kWh": 3.6, "GJ": 1000.0, "kcal": 0.004184},
    "수송량": {"kg.km": 0.001, "ton.km": 1.0},
}
DEFAULT_PAIR = {
    "질량": ("kg", "t"),
    "부피": ("L", "m3"),
    "에너지": ("kWh", "MJ"),
    "수송량": ("kg.km", "ton.km"),
}
# 데이터의 단위 표기 → 변환표의 이름
UNIT_ALIAS = {
    "kg": "kg", "g": "g", "t": "t", "ton": "t",
    "l": "L", "m3": "m3", "ton.km": "ton.km",
    "mj": "MJ", "kwh": "kWh",
}

EXAMPLES = [
    ({"대분류": "원료 및 에너지 생산", "원료_에너지": "1종 포틀랜드 시멘트"}, 500, "kg"),
    ({"대분류": "원료 및 에너지 생산", "원료_에너지": "강화유리"}, 20, "kg"),
    ({"대분류": "연료원별 사용", "구분": "경유", "원료_에너지": "가정"}, 10, "L"),
]


# =====================================================================
# 도우미 함수 (화면과 상관없는 계산)
# =====================================================================
@st.cache_data
def load_data():
    raw = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    df = raw[["대분류", "구분", "원료_에너지", "단위"]].copy()
    df["단위"] = df["단위"].astype(str).str.strip()
    for key, (col, _) in IMPACTS.items():
        df[key] = pd.to_numeric(raw[col], errors="coerce")  # "해당없음"은 빈 값이 됨
    df["이름"] = df["원료_에너지"] + " (" + df["구분"] + ")"
    return df


def base_unit(unit_text):
    """데이터의 단위 글자를 변환표 이름으로 바꿈. 모르면 None."""
    text = str(unit_text).strip()
    if not text:
        return None
    return UNIT_ALIAS.get(text.split()[0].lower())


def family_of(unit_name):
    for name, table in UNIT_FAMILIES.items():
        if unit_name in table:
            return name, table
    return None, None


def convert_amount(amount, from_unit, factor_unit_text):
    """입력한 사용량을 계수의 기준 단위로 환산."""
    base = base_unit(factor_unit_text)
    _, table = family_of(base)
    if table is None or from_unit not in table:
        return amount
    return amount * table[from_unit] / table[base]


def fmt(x):
    return "-" if pd.isna(x) else f"{x:,.4g}"


def level(z):
    return "높음" if z > 0.5 else "낮음" if z < -0.5 else "보통"


def run_clustering(data, cols, k):
    """로그 변환 → 표준화 → KMeans. 평균 영향이 작은 묶음이 1번이 되도록 번호를 다시 붙임."""
    X = StandardScaler().fit_transform(np.log10(data[cols].to_numpy()))
    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X)
    order = np.argsort(km.cluster_centers_.mean(axis=1))
    rank = {int(old): new + 1 for new, old in enumerate(order)}
    out = data.copy()
    out["묶음"] = [rank[int(label)] for label in km.labels_]
    centers = pd.DataFrame(km.cluster_centers_[order], columns=cols, index=range(1, k + 1))
    dist = np.linalg.norm(X - km.cluster_centers_[km.labels_], axis=1)
    out["_거리"] = dist
    return out, centers, X


# =====================================================================
# ===== UI =====
# =====================================================================
df = load_data()

if "basket" not in st.session_state:
    st.session_state.basket = []
    st.session_state.next_id = 1


def add_item(idx, amount, unit):
    nid = st.session_state.next_id
    st.session_state.next_id += 1
    st.session_state[f"amt_{nid}"] = float(amount)
    st.session_state[f"unit_{nid}"] = unit
    st.session_state.basket.append({"id": nid, "idx": idx})


def remove_item(item_id):
    st.session_state.basket = [b for b in st.session_state.basket if b["id"] != item_id]


def clear_basket():
    st.session_state.basket = []


def load_example():
    for cond, amount, unit in EXAMPLES:
        mask = pd.Series(True, index=df.index)
        for col, val in cond.items():
            mask &= df[col] == val
        if mask.any():
            add_item(df[mask].index[0], amount, unit)


# ---------------------------------------------------------------- 사이드바
with st.sidebar:
    st.header("단위 변환기")
    st.caption("값을 다른 단위로 바꿔볼 수 있어요. (예: kg → t)")
    fam_name = st.selectbox("종류", list(UNIT_FAMILIES))
    table = UNIT_FAMILIES[fam_name]
    names = list(table)
    d_from, d_to = DEFAULT_PAIR[fam_name]
    value = st.number_input("값", value=1.0, format="%g", key="conv_value")
    u_from = st.selectbox("바꾸기 전", names, index=names.index(d_from), key=f"conv_from_{fam_name}")
    u_to = st.selectbox("바꾼 후", names, index=names.index(d_to), key=f"conv_to_{fam_name}")
    st.success(f"{value:g} {u_from} = {value * table[u_from] / table[u_to]:.6g} {u_to}")
    st.divider()
    st.caption("t = 미터톤(1,000 kg), gal(US) = 미국 갤런")

# ---------------------------------------------------------------- 머리말
st.title("LCA 미니 계산기")
st.caption(
    "한국환경산업기술원 환경성적표지 평가계수(2021년 기준, 공공데이터포털)를 사용한 **연습용** 앱입니다. "
    "실제 LCA 결과나 인증 값이 아닙니다."
)

tab_calc, tab_explore, tab_cluster, tab_about = st.tabs(
    ["① 계산기", "② 데이터 탐색", "③ 비슷한 원료 묶기", "④ 안내"]
)

# =====================================================================
# ① 계산기
# =====================================================================
with tab_calc:
    st.markdown("#### 1단계. 항목 찾기")
    with st.container(border=True):
        r1c1, r1c2 = st.columns(2)
        stage = r1c1.selectbox("대분류", CALC_STAGES, help="원료 만들기, 수송, 연료 사용, 폐기 중 어느 단계인가요?")
        keyword = r1c2.text_input("이름으로 좁히기 (선택)", placeholder="예: 시멘트, 경유", help="대분류 안에서 이름에 이 글자가 들어간 것만 보여줘요.")
        pool = df[df["대분류"] == stage]
        if keyword.strip():
            pool = pool[
                pool["원료_에너지"].str.contains(keyword.strip(), case=False, regex=False)
                | pool["구분"].str.contains(keyword.strip(), case=False, regex=False)
            ]

        idx = None
        if pool.empty:
            st.info("조건에 맞는 항목이 없어요. 검색어를 바꿔보세요.")
        else:
            r2c1, r2c2 = st.columns(2)
            cat = r2c1.selectbox("구분", sorted(pool["구분"].unique()))
            pool2 = pool[pool["구분"] == cat]
            idx = r2c2.selectbox(
                "소분류 (원료·에너지 이름)",
                pool2.index.tolist(),
                format_func=lambda i: f"{df.at[i, '원료_에너지']}  [{df.at[i, '단위']}]",
            )

        if idx is not None:
            row = df.loc[idx]
            base = base_unit(row["단위"])
            _, fam = family_of(base)
            unit_opts = list(fam) if fam else [row["단위"]]
            default_unit = base if base in unit_opts else unit_opts[0]

            a1, a2, a3 = st.columns([2, 2, 1])
            amount = a1.number_input("사용량", min_value=0.0, value=1.0, step=1.0, format="%g", key="new_amount")
            unit = a2.selectbox("입력 단위", unit_opts, index=unit_opts.index(default_unit), key=f"new_unit_{idx}")
            a3.write("")
            a3.write("")
            a3.button("담기", type="primary", on_click=add_item, args=(idx, amount, unit), use_container_width=True)

            note = f"이 항목의 계수는 **{row['단위']}** 기준입니다. 탄소 {fmt(row['탄소'])} kg CO2 eq / {row['단위']}"
            if unit != base and fam:
                note += f"  ·  입력값 {amount:g} {unit} = {convert_amount(amount, unit, row['단위']):.6g} {row['단위']} 로 환산해 계산해요."
            st.caption(note)

    st.markdown("#### 2단계. 담은 항목")
    basket = st.session_state.basket
    if not basket:
        st.info("아직 담은 항목이 없어요. 위에서 항목을 골라 '담기'를 누르거나, 예시를 불러와 보세요.")
        st.button("예시 불러오기 (시멘트 + 유리 + 경유)", on_click=load_example)
    else:
        head = st.columns([4, 2, 2, 1])
        head[0].caption("항목")
        head[1].caption("사용량")
        head[2].caption("단위")
        records = []
        for n, item in enumerate(basket, start=1):
            r = df.loc[item["idx"]]
            b_unit = base_unit(r["단위"])
            _, fam_i = family_of(b_unit)
            opts = list(fam_i) if fam_i else [r["단위"]]
            cols = st.columns([4, 2, 2, 1])
            cols[0].markdown(f"**{n}. {r['원료_에너지']}**  \n{r['대분류']} › {r['구분']} · 계수 기준 {r['단위']}")
            amt = cols[1].number_input("사용량", min_value=0.0, step=1.0, format="%g", key=f"amt_{item['id']}", label_visibility="collapsed")
            if st.session_state.get(f"unit_{item['id']}") not in opts:
                st.session_state[f"unit_{item['id']}"] = opts[0]
            u = cols[2].selectbox("단위", opts, key=f"unit_{item['id']}", label_visibility="collapsed")
            cols[3].button("삭제", key=f"del_{item['id']}", on_click=remove_item, args=(item["id"],))
            converted = convert_amount(amt, u, r["단위"])
            records.append(
                {
                    "항목": f"{n}. {r['원료_에너지']}",
                    "대분류": r["대분류"],
                    "구분": r["구분"],
                    "입력량": amt,
                    "입력단위": u,
                    "환산량": converted,
                    "기준단위": r["단위"],
                    **{k: converted * r[k] for k in KEYS},
                }
            )
        st.button("모두 비우기", on_click=clear_basket)

        res = pd.DataFrame(records)

        st.markdown("#### 3단계. 결과")
        total = res[KEYS].sum(min_count=1)
        missing = res[KEYS].isna().sum()
        metric_cols = st.columns(len(KEYS))
        for col, k in zip(metric_cols, KEYS):
            with col:
                with st.container(border=True):
                    st.metric(k, f"{fmt(total[k])}", help=f"{IMPACT_HELP[k]} (단위: {IMPACTS[k][1]})")
                    st.caption(IMPACTS[k][1])
                    if missing[k] > 0:
                        st.caption(f"⚠ 값 없는 항목 {int(missing[k])}개")
        if (missing > 0).any():
            with st.expander("⚠ 계수가 비어 있는 항목이 있어요 (합계가 실제보다 작을 수 있음)"):
                for k in KEYS:
                    names_missing = res.loc[res[k].isna(), "항목"].tolist()
                    if names_missing:
                        st.write(f"**{k}**: " + ", ".join(names_missing))
                st.caption("'해당없음'은 0이 아니라 값이 없다는 뜻이라, 합계에 넣지 않았어요.")

        st.markdown("##### 그래프로 보기")
        k_sel = st.radio("영향 항목", KEYS, horizontal=True, key="calc_k", format_func=lambda k: f"{k} ({IMPACTS[k][1]})")
        g1, g2, g3 = st.tabs(["항목별 크기", "영향별 기여율", "단계별 비중"])

        with g1:
            d = res[["항목", "구분", k_sel]].dropna().rename(columns={k_sel: "값"})
            if d.empty:
                st.info("이 영향 항목은 담은 항목 모두 값이 없어요.")
            else:
                base_chart = alt.Chart(d).encode(
                    x=alt.X("값:Q", title=f"{k_sel} ({IMPACTS[k_sel][1]})"),
                    y=alt.Y("항목:N", sort="-x", title=None),
                    tooltip=["항목", "구분", alt.Tooltip("값:Q", format=".4g")],
                )
                chart = base_chart.mark_bar() + base_chart.mark_text(align="left", dx=4).encode(text=alt.Text("값:Q", format=".3g"))
                st.altair_chart(chart.properties(height=max(120, 42 * len(d))), use_container_width=True)
                st.caption("읽는 법: 막대가 길수록 그 항목이 선택한 영향을 더 많이 만들어요.")

        with g2:
            long = res.melt(id_vars="항목", value_vars=KEYS, var_name="영향", value_name="값")
            denom = long.groupby("영향")["값"].transform(lambda s: s.abs().sum())
            long["기여율"] = (long["값"] / denom * 100).replace([np.inf, -np.inf], np.nan)
            long = long.dropna(subset=["기여율"])
            if long.empty:
                st.info("기여율을 계산할 수 있는 값이 없어요.")
            else:
                heat = alt.Chart(long).encode(
                    x=alt.X("영향:N", sort=KEYS, title=None),
                    y=alt.Y("항목:N", title=None),
                )
                layer = heat.mark_rect().encode(
                    color=alt.Color("기여율:Q", scale=alt.Scale(domain=[0, 100], scheme="blues"), legend=alt.Legend(title="기여율(%)")),
                    tooltip=["항목", "영향", alt.Tooltip("값:Q", format=".4g"), alt.Tooltip("기여율:Q", format=".1f")],
                ) + heat.mark_text().encode(
                    text=alt.Text("기여율:Q", format=".0f"),
                    color=alt.condition(alt.datum["기여율"] > 55, alt.value("white"), alt.value("black")),
                )
                st.altair_chart(layer.properties(height=max(120, 42 * res.shape[0])), use_container_width=True)
                st.caption("읽는 법: 칸 안의 숫자는 그 영향의 합계에서 이 항목이 차지하는 비율(%)이에요. 빈 칸은 값이 없는 경우입니다.")

        with g3:
            d = res.groupby("대분류")[k_sel].sum(min_count=1).dropna().reset_index().rename(columns={k_sel: "값"})
            d = d[d["값"] > 0]
            if d.empty:
                st.info("그릴 수 있는 값이 없어요.")
            else:
                donut = alt.Chart(d).mark_arc(innerRadius=60).encode(
                    theta=alt.Theta("값:Q"),
                    color=alt.Color("대분류:N", title="단계"),
                    tooltip=["대분류", alt.Tooltip("값:Q", format=".4g")],
                )
                st.altair_chart(donut.properties(height=320), use_container_width=True)
                st.caption("읽는 법: 원료 만들기, 수송, 연료, 폐기 중 어느 단계가 큰 비중인지 보여줘요. (0보다 큰 값만 표시)")

        with st.expander("계산 상세표 보기 / 내려받기"):
            conf = {k: st.column_config.NumberColumn(f"{k} ({IMPACTS[k][1]})", format="%.4g") for k in KEYS}
            conf["입력량"] = st.column_config.NumberColumn(format="%g")
            conf["환산량"] = st.column_config.NumberColumn(format="%.6g")
            st.dataframe(res, use_container_width=True, hide_index=True, column_config=conf)
            st.download_button(
                "결과 CSV 내려받기",
                res.to_csv(index=False).encode("utf-8-sig"),
                file_name="lca_result.csv",
                mime="text/csv",
            )
        st.caption(
            "시스템 경계: 이 데이터의 원료·에너지 생산, 수송, 연료 사용, 폐기 계수만 사용했어요. 제품을 쓰는 단계 등은 포함되지 않습니다."
        )

# =====================================================================
# ② 데이터 탐색
# =====================================================================
with tab_explore:
    st.markdown("#### 데이터를 여러 방식으로 살펴보기")
    f1, f2, f3 = st.columns(3)
    ex_stage = f1.selectbox("대분류", df["대분류"].unique(), key="ex_stage")
    sub_stage = df[df["대분류"] == ex_stage]
    unit_counts = sub_stage["단위"].value_counts()
    ex_unit = f2.selectbox(
        "단위 (같은 단위끼리만 비교해요)",
        unit_counts.index.tolist(),
        format_func=lambda u: f"{u} ({unit_counts[u]}개)",
        key="ex_unit",
    )
    ex_k = f3.selectbox("영향 항목", KEYS, format_func=lambda k: f"{k} ({IMPACTS[k][1]})", key="ex_k")
    data = sub_stage[sub_stage["단위"] == ex_unit]

    chart_type = st.selectbox(
        "그래프 종류",
        ["순위 (높은 순·낮은 순)", "분포 (히스토그램)", "구분별 비교 (박스플롯)", "두 영향 항목 비교 (산점도)", "영향 항목 사이의 관계 (상관 히트맵)"],
    )
    st.caption(f"대상: {ex_stage} · 단위 {ex_unit} · {len(data)}개 항목")

    if chart_type.startswith("순위"):
        c1, c2 = st.columns(2)
        direction = c1.radio("정렬", ["높은 순", "낮은 순"], horizontal=True)
        top_n = c2.slider("보여줄 개수", 5, 20, 10)
        d = data.dropna(subset=[ex_k])
        d = d.nlargest(top_n, ex_k) if direction == "높은 순" else d.nsmallest(top_n, ex_k)
        if d.empty:
            st.info("값이 있는 항목이 없어요.")
        else:
            b = alt.Chart(d).encode(
                x=alt.X(f"{ex_k}:Q", title=f"{ex_k} ({IMPACTS[ex_k][1]} / {ex_unit})"),
                y=alt.Y("이름:N", sort="-x" if direction == "높은 순" else "x", title=None),
                tooltip=["이름", alt.Tooltip(f"{ex_k}:Q", format=".4g")],
            )
            st.altair_chart((b.mark_bar() + b.mark_text(align="left", dx=4).encode(text=alt.Text(f"{ex_k}:Q", format=".3g"))).properties(height=max(150, 32 * len(d))), use_container_width=True)
            st.caption("읽는 법: 같은 단위 안에서 영향이 가장 큰(또는 작은) 항목을 찾아볼 수 있어요.")

    elif chart_type.startswith("분포"):
        d = data.dropna(subset=[ex_k])
        d = d[d[ex_k] > 0].copy()
        if len(d) < 5:
            st.info("값이 너무 적어서 분포를 그리기 어려워요.")
        else:
            d["log10값"] = np.log10(d[ex_k])
            h = alt.Chart(d).mark_bar().encode(
                x=alt.X("log10값:Q", bin=alt.Bin(maxbins=25), title=f"log10({ex_k})"),
                y=alt.Y("count():Q", title="항목 수"),
                tooltip=[alt.Tooltip("count():Q", title="항목 수")],
            )
            st.altair_chart(h.properties(height=320), use_container_width=True)
            st.caption("읽는 법: 값이 몇 배씩 차이 나서 로그(10을 몇 번 곱했는지)로 바꿨어요. 오른쪽으로 갈수록 영향이 큰 항목이에요. 예: -2는 0.01, 0은 1, 2는 100.")

    elif chart_type.startswith("구분별"):
        d = data.dropna(subset=[ex_k])
        d = d[d[ex_k] > 0]
        if d["구분"].nunique() < 2:
            st.info("비교할 구분이 2개 이상 필요해요. 다른 대분류나 단위를 골라보세요.")
        else:
            order = d.groupby("구분")[ex_k].median().sort_values(ascending=False).index.tolist()
            bx = alt.Chart(d).mark_boxplot().encode(
                y=alt.Y("구분:N", sort=order, title=None),
                x=alt.X(f"{ex_k}:Q", scale=alt.Scale(type="log"), title=f"{ex_k} ({IMPACTS[ex_k][1]} / {ex_unit}, 로그 눈금)"),
            )
            st.altair_chart(bx.properties(height=max(200, 36 * len(order))), use_container_width=True)
            st.caption("읽는 법: 상자는 가운데 절반의 범위, 선은 전체 범위예요. 값이 한두 개뿐인 구분은 상자가 점처럼 보일 수 있어요.")

    elif chart_type.startswith("두 영향"):
        s1, s2 = st.columns(2)
        x_k = s1.selectbox("가로축", KEYS, index=0, key="sx")
        y_k = s2.selectbox("세로축", KEYS, index=1, key="sy")
        d = data.dropna(subset=[x_k, y_k])
        d = d[(d[x_k] > 0) & (d[y_k] > 0)]
        if x_k == y_k:
            st.info("가로축과 세로축을 다르게 골라주세요.")
        elif len(d) < 3:
            st.info("두 값이 모두 있는 항목이 너무 적어요.")
        else:
            sc = alt.Chart(d).mark_circle(size=80, opacity=0.7).encode(
                x=alt.X(f"{x_k}:Q", scale=alt.Scale(type="log"), title=f"{x_k} ({IMPACTS[x_k][1]}, 로그 눈금)"),
                y=alt.Y(f"{y_k}:Q", scale=alt.Scale(type="log"), title=f"{y_k} ({IMPACTS[y_k][1]}, 로그 눈금)"),
                color=alt.Color("구분:N", legend=alt.Legend(title="구분")),
                tooltip=["이름", alt.Tooltip(f"{x_k}:Q", format=".4g"), alt.Tooltip(f"{y_k}:Q", format=".4g")],
            )
            st.altair_chart(sc.properties(height=420).interactive(), use_container_width=True)
            st.caption(f"읽는 법: 점 {len(d)}개. 오른쪽 위에 있을수록 두 영향이 모두 큰 항목이에요. 점 위에 마우스를 올리면 이름이 나와요.")

    else:
        sub = data[KEYS]
        usable = sub.dropna(how="all")
        if len(usable) < 5:
            st.info("항목이 너무 적어서 관계를 보기 어려워요.")
        else:
            corr = sub.corr(method="spearman").reset_index().melt(id_vars="index", var_name="y", value_name="상관")
            corr = corr.rename(columns={"index": "x"}).dropna()
            hm = alt.Chart(corr).encode(x=alt.X("x:N", sort=KEYS, title=None), y=alt.Y("y:N", sort=KEYS, title=None))
            layer = hm.mark_rect().encode(
                color=alt.Color("상관:Q", scale=alt.Scale(domain=[-1, 1], scheme="redblue", reverse=True), legend=alt.Legend(title="상관")),
                tooltip=["x", "y", alt.Tooltip("상관:Q", format=".2f")],
            ) + hm.mark_text().encode(text=alt.Text("상관:Q", format=".2f"))
            st.altair_chart(layer.properties(height=320), use_container_width=True)
            st.caption("읽는 법: 1에 가까우면 한쪽이 클 때 다른 쪽도 큰 경향, -1에 가까우면 반대 경향이에요. 이 값은 '관계'일 뿐 '원인'은 아니에요. 값이 있는 항목끼리만 계산했습니다.")

# =====================================================================
# ③ 비슷한 원료 묶기
# =====================================================================
with tab_cluster:
    st.markdown("#### 계수가 비슷한 원료끼리 묶어보기")
    st.write(
        "선택한 영향 항목들의 값이 **비슷한 원료끼리** 컴퓨터가 자동으로 묶어줘요. "
        "묶음 번호는 **1번이 영향이 가장 작은 묶음, 번호가 클수록 전반적으로 영향이 큰 묶음**이에요."
    )

    st.markdown("##### 1. 무엇을 기준으로 묶을까요? (체크한 항목만 사용)")
    ccols = st.columns(len(KEYS))
    sel = [k for c, k in zip(ccols, KEYS) if c.checkbox(k, value=True, key=f"cl_{k}", help=IMPACT_HELP[k])]

    if len(sel) < 2:
        st.warning("기준 항목을 2개 이상 체크해 주세요.")
    else:
        comp = df.dropna(subset=sel)
        comp = comp[(comp[sel] > 0).all(axis=1)]
        counts = comp.groupby(["대분류", "단위"]).size()
        counts = counts[counts >= 12].sort_values(ascending=False)
        if counts.empty:
            st.warning("선택한 기준으로 묶을 수 있는 데이터가 부족해요. 기준 항목을 줄여보세요.")
        else:
            st.markdown("##### 2. 어떤 원료를 묶을까요?")
            scope = st.selectbox(
                "대상 (단위가 같은 것끼리만 묶을 수 있어요)",
                list(counts.index),
                format_func=lambda t: f"{t[0]} · 단위 {t[1]}  ({counts[t]}개)",
            )
            data = comp[(comp["대분류"] == scope[0]) & (comp["단위"] == scope[1])].copy()

            st.markdown("##### 3. 몇 개로 묶을까요?")
            k_num = st.radio("묶음 개수", [2, 3, 4, 5, 6], index=2, horizontal=True, format_func=lambda n: f"{n}개", label_visibility="collapsed")
            st.caption("개수는 한 가지만 고르는 거라 동그라미 선택으로 만들었어요. 체크박스는 위의 '기준 항목'처럼 여러 개를 고를 때 써요.")

            if len(data) < k_num * 4:
                st.warning("데이터가 적어서 이 개수로는 묶기 어려워요. 개수를 줄여보세요.")
            else:
                with st.expander("몇 개가 좋을지 모르겠다면 (자동 점검)"):
                    scores = []
                    Xs = StandardScaler().fit_transform(np.log10(data[sel].to_numpy()))
                    for kk in range(2, 7):
                        if len(data) > kk * 4:
                            lab = KMeans(n_clusters=kk, n_init=10, random_state=42).fit_predict(Xs)
                            scores.append({"묶음 개수": kk, "구분 뚜렷함 점수": round(float(silhouette_score(Xs, lab)), 3)})
                    if scores:
                        sdf = pd.DataFrame(scores)
                        best = int(sdf.loc[sdf["구분 뚜렷함 점수"].idxmax(), "묶음 개수"])
                        st.write(f"점수가 높을수록 묶음이 뚜렷하게 나뉘어요(최대 1). 이 데이터에서는 **{best}개**가 가장 뚜렷해요.")
                        st.dataframe(sdf, hide_index=True)
                        st.caption("점수가 가장 높다고 꼭 정답은 아니에요. 해석하기 쉬운 개수를 고르는 것도 좋아요.")

                clustered, centers, X = run_clustering(data, sel, k_num)
                clustered["묶음"] = clustered["묶음"].astype(int)

                st.markdown("##### 결과: 묶음별 특징")
                per_row = 3
                for start in range(1, k_num + 1, per_row):
                    cols = st.columns(per_row)
                    for j in range(per_row):
                        n = start + j
                        if n > k_num:
                            break
                        members = clustered[clustered["묶음"] == n]
                        with cols[j]:
                            with st.container(border=True):
                                st.markdown(f"**{n}번 묶음** · {len(members)}개")
                                for k in sel:
                                    z = centers.loc[n, k]
                                    mark = "▲" if z > 0.5 else "▼" if z < -0.5 else "●"
                                    st.write(f"{mark} {k}: {level(z)}")
                                reps = members.nsmallest(3, "_거리")["원료_에너지"].tolist()
                                st.caption("대표 원료: " + ", ".join(reps))
                st.caption("▲ 다른 묶음보다 높음 · ● 보통 · ▼ 낮음 (같은 데이터 안에서 상대적으로 비교한 값)")

                prof = centers.reset_index().rename(columns={"index": "묶음"}).melt(id_vars="묶음", var_name="영향", value_name="상대값")
                prof["수준"] = prof["상대값"].apply(level)
                ph = alt.Chart(prof).encode(x=alt.X("영향:N", sort=sel, title=None), y=alt.Y("묶음:O", title="묶음 번호"))
                prof_layer = ph.mark_rect().encode(
                    color=alt.Color("상대값:Q", scale=alt.Scale(domain=[-2, 2], scheme="blueorange"), legend=alt.Legend(title="상대 수준")),
                    tooltip=["묶음", "영향", alt.Tooltip("상대값:Q", format=".2f"), "수준"],
                ) + ph.mark_text().encode(text="수준:N")
                st.altair_chart(prof_layer.properties(height=40 * k_num + 60), use_container_width=True)
                st.caption("한눈에 보기: 파란색은 낮음, 주황색은 높음이에요. 번호가 커질수록 주황색이 늘어나는 게 정상이에요.")

                st.markdown("##### 그림으로 보기")
                p1, p2 = st.columns(2)
                x_k = p1.selectbox("가로축", sel, index=0, key="cx")
                y_k = p2.selectbox("세로축", sel, index=1, key="cy")
                if x_k == y_k:
                    st.info("가로축과 세로축을 다르게 골라주세요.")
                else:
                    plot = clustered.copy()
                    plot["묶음"] = plot["묶음"].astype(str) + "번"
                    domain = [f"{n}번" for n in range(1, k_num + 1)]
                    sc = alt.Chart(plot).mark_circle(size=90, opacity=0.8).encode(
                        x=alt.X(f"{x_k}:Q", scale=alt.Scale(type="log"), title=f"{x_k} ({IMPACTS[x_k][1]}, 로그 눈금)"),
                        y=alt.Y(f"{y_k}:Q", scale=alt.Scale(type="log"), title=f"{y_k} ({IMPACTS[y_k][1]}, 로그 눈금)"),
                        color=alt.Color("묶음:N", scale=alt.Scale(domain=domain), legend=alt.Legend(title="묶음")),
                        tooltip=["이름", "묶음"] + [alt.Tooltip(f"{k}:Q", format=".4g") for k in sel],
                    )
                    st.altair_chart(sc.properties(height=420).interactive(), use_container_width=True)

                st.markdown("##### 묶음별 원료 목록")
                view = st.selectbox("보고 싶은 묶음", ["전체"] + [f"{n}번" for n in range(1, k_num + 1)])
                table_df = clustered.drop(columns=["_거리"])
                if view != "전체":
                    table_df = table_df[table_df["묶음"] == int(view[0])]
                show_cols = ["묶음", "구분", "원료_에너지"] + sel
                conf = {k: st.column_config.NumberColumn(f"{k} ({IMPACTS[k][1]})", format="%.4g") for k in sel}
                st.dataframe(table_df.sort_values("묶음")[show_cols], hide_index=True, use_container_width=True, column_config=conf)
                st.download_button(
                    "묶음 결과 CSV 내려받기",
                    table_df.sort_values("묶음")[show_cols].to_csv(index=False).encode("utf-8-sig"),
                    file_name="lca_clusters.csv",
                    mime="text/csv",
                )

                st.caption(
                    "어떻게 묶었나요? 값이 몇 배씩 차이 나서 먼저 로그로 바꾸고, 항목마다 크기를 맞춘(표준화) 뒤 "
                    "KMeans라는 방법으로 비슷한 것끼리 묶었어요. 탐색용 분류이며 공식 분류나 인증 기준이 아닙니다."
                )

# =====================================================================
# ④ 안내
# =====================================================================
with tab_about:
    st.markdown("#### 사용 순서")
    st.markdown(
        "1. **계산기**에서 대분류 → 구분 → 소분류 순서로 항목을 찾아 사용량과 단위를 넣고 '담기'를 누릅니다.\n"
        "2. 단위는 바꿔서 입력할 수 있어요. (예: kg 대신 t) 앱이 계수 기준 단위로 자동으로 환산해요.\n"
        "3. 결과 숫자와 그래프를 확인하고, 필요하면 CSV로 내려받습니다.\n"
        "4. **데이터 탐색**과 **비슷한 원료 묶기**에서는 데이터 전체의 모습을 살펴봅니다."
    )
    st.markdown("#### 영향 항목 설명")
    for k in KEYS:
        st.markdown(f"- **{k}** ({IMPACTS[k][1]}): {IMPACT_HELP[k]}")
    st.markdown("#### 알아둘 점")
    st.markdown(
        "- 계수는 한국환경산업기술원 환경성적표지 평가계수(2021년 기준)이며, **연습용 계산**입니다.\n"
        "- '해당없음'은 0이 아니라 **값이 없다**는 뜻이라 합계에 넣지 않고, 경고로 알려줘요.\n"
        "- 광화학스모그와 오존층영향은 값이 없는 항목이 너무 많아 뺐어요.\n"
        "- 화학반응공정은 단위가 제각각이라 계산기에서는 제외했고, 데이터 탐색에서만 볼 수 있어요.\n"
        "- 단위가 다른 항목끼리는 비교하지 않아요. (예: kg 기준과 L 기준)\n"
        "- 제품을 쓰는 단계 등은 이 데이터에 없어서 전과정 전체가 아닙니다."
    )
    st.caption("출처: 한국환경산업기술원 환경성적표지 평가계수(2021년 기준), 공공데이터포털")
