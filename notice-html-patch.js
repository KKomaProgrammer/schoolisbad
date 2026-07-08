(() => {
  function safe(html) {
    return String(html || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<b>", "__B__")
      .replaceAll("</b>", "__EB__")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("__B__", "<b>")
      .replaceAll("__EB__", "</b>");
  }

  function apply() {
    for (const box of document.querySelectorAll("#notice, .notice")) {
      const text = box.textContent || "";
      if (!text.includes("<b>") || box.dataset.htmlPatched === text) continue;
      box.dataset.htmlPatched = text;
      box.innerHTML = safe(text);
    }
  }

  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
