"""Deterministic claims and conservative semantic guardrails for Looply."""
import re

def audited(topic, stats):
    stages = stats["stage_counts"]
    cement = stats["cement_example"]
    a, b = list(cement["values"].values())
    pct = (a-b)/a*100
    messages = {
      "cement": (f"같은 기준 단위에서 고로 슬래그 시멘트의 탄소발자국 평가계수는 1종 포틀랜드 시멘트보다 약 {pct:.1f}% 낮아요.", "이는 제품 전체의 배출량이 아니라 환경영향을 계산할 때 사용하는 계수의 차이예요.", "계수만으로 제품 전체의 환경적 우열이나 차이가 발생한 원인을 단정할 수 없어요."),
      "coverage": (f"전체 {stats['records']}개 항목 중 원료 및 에너지 생산은 {stages['원료 및 에너지 생산']}개, 수송은 {stages['수송']}개예요.", "이 숫자는 데이터가 어느 단계에 많이 포함됐는지 보여줘요.", "항목 수가 적다고 자료가 부족하거나 환경영향이 작다고 단정할 수 없어요. 결측값은 0이 아니에요."),
      "report": (f"이 보고서는 {stats['records']}개 환경영향 평가계수를 바탕으로 만들어졌어요.", "그래프는 자료의 구성과 값의 분포를 이해하는 데 도움이 돼요.", "서로 다른 단위의 계수를 그대로 비교하거나 개별 계수를 제품 전체 LCA로 해석하면 안 돼요."),
      "calc": ("환경영향 계산은 선택한 항목의 계수에 입력한 양을 곱하는 방식이에요.", "같은 영향범주와 올바른 기준 단위를 사용해야 계산값을 읽을 수 있어요.", "계산 결과는 입력 조건에 따른 추정값이지 제품 전체의 확정된 환경영향이 아니에요."),
      "explore": ("데이터 인사이트는 평가계수의 분포와 항목 간 관계를 살펴보는 화면이에요.", "그래프의 점과 막대는 선택한 데이터 범위에서 나타난 패턴을 보여줘요.", "상관관계는 원인을 증명하지 않으며, 단위가 다른 항목은 직접 비교하지 마세요."),
      "cluster": ("군집 분석은 수치 패턴이 비슷한 항목을 탐색적으로 묶어요.", "비슷한 모양의 데이터를 찾아볼 수 있지만 공식 환경성 등급을 매기는 기능은 아니에요.", "군집 번호는 우열이나 친환경 순위가 아니며 설정과 데이터에 따라 달라질 수 있어요.")
    }
    finding, meaning, caution = messages[topic]
    return {"finding": finding, "meaning": meaning, "caution": caution}

FORBIDDEN = (
    r"더 많은 환경 영향", r"더 적은 환경 영향", r"환경에 덜 해로운",
    r"더 친환경적", r"환경에 더 좋은", r"환경 영향이 더 크",
    r"환경 영향이 더 작", r"데이터가 부족", r"자료가 부족",
    r"충분한 데이터", r"재활용.*때문", r"슬래그.*때문",
    r"제조.*때문", r"배출량이.*%.*(낮|높|적|많)"
)

def safe_explanation(value):
    if not isinstance(value, str) or not 0 < len(value) <= 350:
        return False
    if re.search(r"\d", value):
        return False
    return not any(re.search(pattern, value, re.I) for pattern in FORBIDDEN)
