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
        assert await pg.evaluate("document.querySelectorAll('#waffle i.miss').length") == 19, "첫 화면: 빠지는 원료 19칸"
        # 스크롤 단계 5(겹치는 곳): 연두 점 19개, 초록 점 14개
        await pg.evaluate("(()=>{const e=document.querySelector('.step[data-step=\"4\"]');const r=e.getBoundingClientRect();window.scrollBy(0,r.top+r.height/2-innerHeight/2)})()"); await pg.wait_for_timeout(800)
        n = await pg.evaluate("[document.querySelectorAll('#sdots circle.miss').length, document.querySelectorAll('#sdots circle.got').length]")
        assert n == [19, 14], n
        await pg.evaluate("document.getElementById('c4').scrollIntoView()"); await pg.wait_for_timeout(400)
        await pg.fill("#thSlider", "50"); await pg.dispatch_event("#thSlider", "input"); await pg.wait_for_timeout(600)
        assert await pg.inner_text("#thN") == "21"
        for t in ["notes", "report"]:
            await pg.click(f'[data-tab="{t}"]'); await pg.wait_for_timeout(500)
        assert not errs, errs
        print("ok: 첫 화면 와플, 스크롤 단계, 기준 슬라이더, 탭 전환, 오류 없음"); await b.close()
asyncio.run(main())
