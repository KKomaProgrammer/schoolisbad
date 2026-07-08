(() => {
  const BLOCK_KEY = "schoolisbad_blocked_until";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatKoreanDate(value) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return String(value || "");
    const hour = d.getHours();
    const ampm = hour < 12 ? "오전" : "오후";
    const h12 = hour % 12 || 12;
    return `${d.getFullYear()}년. ${d.getMonth() + 1}월. ${d.getDate()}일. ${ampm} ${h12}:${pad(d.getMinutes())}`;
  }

  function minutesUntil(value) {
    const diff = new Date(value).getTime() - Date.now();
    if (!Number.isFinite(diff)) return 1;
    return Math.max(1, Math.ceil(diff / 60000));
  }

  function blockTextWithMinutes(until, fixedMinutes) {
    const minutes = Number.isFinite(Number(fixedMinutes)) && Number(fixedMinutes) > 0
      ? Math.ceil(Number(fixedMinutes))
      : minutesUntil(until);
    return `등록이 <b>${minutes}분</b>동안 제한됩니다. ${formatKoreanDate(until)} 이후 다시 시도해 주세요.`;
  }

  try {
    window.blockText = blockTextWithMinutes;
  } catch (error) {}

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

  function currentFallbackText(text) {
    if (!text.includes("등록이 일시 제한되었습니다")) return text;
    try {
      const until = localStorage.getItem(BLOCK_KEY);
      if (until) return blockTextWithMinutes(until);
    } catch (error) {}
    return text;
  }

  function apply() {
    for (const box of document.querySelectorAll("#notice, .notice")) {
      const raw = box.textContent || "";
      const text = currentFallbackText(raw);
      if (!text.includes("<b>") && text === raw) continue;
      if (box.dataset.htmlPatched === text) continue;
      box.dataset.htmlPatched = text;
      box.innerHTML = safe(text);
    }
  }

  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
