/* 탭 전환: 처음 열 때 한 번만 화면을 만든다 (숨겨진 탭에서 차트를 그리면 크기가 0이 되기 때문) */
(function () {
  const names = ['report', 'explore', 'notes'];
  function show(name) {
    if (!names.includes(name)) name = 'report';
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    names.forEach(n => L.$(n).classList.toggle('hidden', n !== name));
    const pane = L.$(name), t = L.tabs[name];
    try { if (!t.built) { t.build(); t.built = true; } else L.resizeAll(pane); }
    catch (e) { pane.innerHTML = '<div class="panel"><p class="empty">화면을 만드는 중 오류가 발생했습니다: ' + L.esc(e.message) + '</p></div>'; console.error(e); }
    pane.classList.remove('enter'); void pane.offsetWidth; if (!L.reduce) pane.classList.add('enter');
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { history.replaceState(null, '', '#' + b.dataset.tab); show(b.dataset.tab); }));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  // 읽은 정도 표시줄
  const bar = L.$('progress');
  window.addEventListener('scroll', () => { const h = document.documentElement, p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); bar.style.transform = `scaleX(${p})`; }, { passive: true });
  show(location.hash.slice(1));
})();
