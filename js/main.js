/* 탭 전환: 처음 열 때 한 번만 화면을 만든다 */
(function () {
  const names = ['report', 'notes'];
  function show(name) {
    if (!names.includes(name)) name = 'report';
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    names.forEach(n => L.$(n).classList.toggle('hidden', n !== name));
    const pane = L.$(name), t = L.tabs[name];
    try { if (!t.built) { t.build(); t.built = true; } }
    catch (e) { pane.innerHTML = '<p class="empty">화면을 만드는 중 오류가 생겼어요: ' + L.esc(e.message) + '</p>'; console.error(e); }
    pane.classList.remove('enter'); void pane.offsetWidth; if (!L.reduce) pane.classList.add('enter');
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); show(b.dataset.tab); }));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  // 읽은 정도 표시줄
  const bar = L.$('progress');
  window.addEventListener('scroll', () => { const h = document.documentElement, p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); bar.style.transform = `scaleX(${p})`; }, { passive: true });
  show(location.hash.slice(1));

  // PDF 저장: 두 탭을 모두 펼치고 애니메이션을 완성된 상태로 맞춘 뒤 인쇄 창을 연다
  const toast = L.$('toast'), title = document.title, reduce0 = L.reduce;
  L.$('pdfBtn').addEventListener('click', () => {
    names.forEach(n => { const t = L.tabs[n]; if (!t.built) { t.build(); t.built = true; } });
    document.body.classList.add('print-all');
    L.tabs.report.beforePrint();
    toast.textContent = '인쇄 창에서 ‘대상: PDF로 저장’을 선택하세요'; toast.hidden = false;
    document.title = 'EPD 데이터 분석_평가계수 398건 점검_김수현';
    setTimeout(() => window.print(), 500);
  });
  window.addEventListener('afterprint', () => { document.body.classList.remove('print-all'); document.title = title; toast.hidden = true; L.reduce = reduce0; });
})();
