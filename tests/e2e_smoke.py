"""브라우저 스모크 테스트 (Playwright). 실행: python tests/e2e_smoke.py
Plotly는 기록용 스텁으로 바꿔, 차트 모양이 아니라 화면 동작과 데이터 흐름을 검증한다."""
import asyncio, os
from playwright.async_api import async_playwright
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUB = """window.Plotly={newPlot:(e)=>{e.classList.add('js-plotly-plot');e.innerHTML='<div>[차트]</div>'},purge(e){e.classList.remove('js-plotly-plot')},Plots:{resize(){}}};"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"]); pg = await b.new_page(viewport={"width": 1440, "height": 900}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/plotly*.js", lambda r: r.fulfill(body=STUB, content_type="application/javascript"))
        await pg.goto("file://" + BASE + "/index.html"); await pg.wait_for_timeout(1500)
        assert await pg.evaluate("document.querySelectorAll('.hero-cmp tr.same').length") == 5, "첫 화면: 납·염소 같은 값 5개"
        assert await pg.evaluate("document.querySelectorAll('.flag').length") == 6, "다시 확인할 값 6건"
        assert await pg.evaluate("document.querySelectorAll('.exbars').length") == 2, "계산 예시 2개"
        # 스크롤 단계 5(겹치는 곳): 연두 점 19개, 초록 점 14개
        await pg.evaluate("(()=>{const e=document.querySelector('.step[data-step=\"4\"]');const r=e.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-innerHeight/2)})()"); await pg.wait_for_timeout(800)
        n = await pg.evaluate("[document.querySelectorAll('#sdots circle.miss').length, document.querySelectorAll('#sdots circle.got').length]")
        assert n == [19, 14], n
        await pg.evaluate("document.getElementById('cview').scrollIntoView()"); await pg.wait_for_timeout(300)
        await pg.click('[data-cv="carbon"]'); await pg.wait_for_timeout(800)
        assert await pg.inner_text("#cvN") == "2", "탄소발자국 칸만: 2건"
        await pg.click('[data-cv="all"]'); await pg.wait_for_timeout(800)
        assert await pg.inner_text("#cvN") == "6", "모든 범주: 6건"
        await pg.fill("#wireG", "1"); await pg.dispatch_event("#wireG", "input"); await pg.wait_for_timeout(200)
        assert "98.9%" == await pg.inner_text("#ex1St"), await pg.inner_text("#ex1St")
        for t in ["notes", "report"]:
            await pg.click(f'[data-tab="{t}"]'); await pg.wait_for_timeout(500)
        assert not errs, errs
        print("ok: 첫 화면 비교표, 다시 확인할 값 6건, 계산 예시, 전선 무게 막대, 범주 보기 전환, 스크롤 단계, 탭 전환, 오류 없음"); await b.close()
asyncio.run(main())
