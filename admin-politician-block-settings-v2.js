(() => {
  const CARD_ID = "politicianBlockSettingsCardV2";
  let settings = [];
  let busy = false;
  let searchTimer = 0;

  function token() {
    try { return localStorage.getItem("schoolisbad_admin_session") || ""; } catch { return ""; }
  }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function headers() {
    const t = token();
    return { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${t}`, "x-admin-token": t };
  }

  async function call(method, body) {
    const res = await fetch("/api/admin/politician-blocks", { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "차단 설정 요청 실패");
    return data;
  }

  async function searchNames(q) {
    const res = await fetch(`/api/admin/politician-search?q=${encodeURIComponent(q || "")}`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return data.results || [];
  }

  function addStyle() {
    if (document.querySelector("#politician-block-v2-style")) return;
    const s = document.createElement("style");
    s.id = "politician-block-v2-style";
    s.textContent = `
      #${CARD_ID} .pb-form{display:grid;gap:10px}
      #${CARD_ID} .pb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
      #${CARD_ID} .pb-mini{border:2px solid #11100f;background:#fffaf0;padding:10px}
      #${CARD_ID} .pb-mini b{display:block;margin-bottom:6px;color:#7f0d0d}
      #${CARD_ID} .pb-mini input{width:100%}
      #${CARD_ID} .pb-list{display:grid;gap:10px;margin-top:14px}
      #${CARD_ID} .pb-item{border:2px solid #11100f;background:#fffaf0;padding:12px;box-shadow:3px 3px 0 #11100f}
      #${CARD_ID} .pb-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}
      #${CARD_ID} .pb-name{font-weight:950;color:#7f0d0d}
      #${CARD_ID} .pb-msg{font-size:13px;line-height:1.45;margin:4px 0}
      #${CARD_ID} .pb-search-wrap{position:relative}
      #${CARD_ID} .pb-results{position:absolute;z-index:50;left:0;right:0;top:100%;display:grid;gap:4px;background:#fffaf0;border:2px solid #11100f;padding:6px;box-shadow:4px 4px 0 #11100f;max-height:220px;overflow:auto}
      #${CARD_ID} .pb-result{border:1px solid #11100f;background:white;padding:7px 9px;text-align:left;cursor:pointer;font-weight:800}
      #${CARD_ID} .pb-result small{color:#7f0d0d;margin-left:5px}
    `;
    document.head.appendChild(s);
  }

  function html() {
    return `
      <article class="admin-card" id="${CARD_ID}">
        <div class="section-head"><h2>정치인 연속 차단 설정</h2><p>추가 등록 정치인과 기존 txt 정치인을 모두 검색합니다. 이름 일부만 입력해도 나옵니다.</p></div>
        <form class="pb-form" id="politicianBlockFormV2">
          <div class="field pb-search-wrap"><label>정치인 이름 검색</label><input name="name" id="politicianBlockNameSearch" autocomplete="off" placeholder="예: 준석, 트럼, 홍" required><div class="pb-results" id="politicianBlockSearchResults" hidden></div></div>
          <div class="pb-grid">
            <div class="pb-mini"><b>긍정 연속</b><input name="positiveCount" type="number" min="0" max="50" placeholder="횟수"><input name="positiveMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
            <div class="pb-mini"><b>중립 연속</b><input name="neutralCount" type="number" min="0" max="50" placeholder="횟수"><input name="neutralMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
            <div class="pb-mini"><b>부정 연속</b><input name="negativeCount" type="number" min="0" max="50" placeholder="횟수"><input name="negativeMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
            <div class="pb-mini"><b>감정 상관없이</b><input name="anyCount" type="number" min="0" max="50" placeholder="횟수"><input name="anyMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
          </div>
          <div class="help">0 또는 빈칸은 사용 안 함입니다. 이제 우선순위 없이 감정별/상관없이 설정 중 하나라도 조건을 충족하면 차단됩니다.</div>
          <div class="actions"><button class="btn" type="submit">차단 설정 저장</button><button class="btn secondary" type="button" data-pb2-reset>새로 입력</button></div>
        </form>
        <div class="pb-list" id="politicianBlockListV2"></div>
      </article>
    `;
  }

  function render() {
    const list = document.querySelector("#politicianBlockListV2");
    if (!list) return;
    if (!settings.length) { list.innerHTML = `<div class="empty">아직 연속 차단 설정이 없습니다.</div>`; return; }
    list.innerHTML = settings.map(s => `
      <div class="pb-item" data-id="${esc(s.id)}">
        <div class="pb-head"><div class="pb-name">${esc(s.name || s.id)}</div><div><button class="btn secondary small" type="button" data-pb2-edit="${esc(s.id)}">수정</button> <button class="btn danger small" type="button" data-pb2-del="${esc(s.id)}">삭제</button></div></div>
        <div class="pb-msg"><b>긍정</b> ${Number(s.positive?.count || 0)}회 / ${Number(s.positive?.minutes || 0)}분</div>
        <div class="pb-msg"><b>중립</b> ${Number(s.neutral?.count || 0)}회 / ${Number(s.neutral?.minutes || 0)}분</div>
        <div class="pb-msg"><b>부정</b> ${Number(s.negative?.count || 0)}회 / ${Number(s.negative?.minutes || 0)}분</div>
        <div class="pb-msg"><b>상관없이</b> ${Number(s.any?.count || 0)}회 / ${Number(s.any?.minutes || 0)}분</div>
      </div>`).join("");
  }

  function reset() { const f = document.querySelector("#politicianBlockFormV2"); if (f) f.reset(); hideResults(); }
  function hideResults() { const box = document.querySelector("#politicianBlockSearchResults"); if (box) { box.hidden = true; box.innerHTML = ""; } }

  function fill(s) {
    const f = document.querySelector("#politicianBlockFormV2");
    if (!f || !s) return;
    f.name.value = s.name || s.id || "";
    f.positiveCount.value = s.positive?.count || ""; f.positiveMinutes.value = s.positive?.minutes || "";
    f.neutralCount.value = s.neutral?.count || ""; f.neutralMinutes.value = s.neutral?.minutes || "";
    f.negativeCount.value = s.negative?.count || ""; f.negativeMinutes.value = s.negative?.minutes || "";
    f.anyCount.value = s.any?.count || ""; f.anyMinutes.value = s.any?.minutes || "";
    f.scrollIntoView({behavior:"smooth",block:"center"});
  }

  async function updateSearch(q) {
    const box = document.querySelector("#politicianBlockSearchResults");
    if (!box) return;
    if (!q.trim()) { hideResults(); return; }
    const results = await searchNames(q);
    if (!results.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = results.map(r => `<button class="pb-result" type="button" data-pb2-pick="${esc(r.name)}">${esc(r.name)}<small>${r.source === "custom" ? "추가" : "기존"}</small></button>`).join("");
    box.hidden = false;
  }

  function bind() {
    const f = document.querySelector("#politicianBlockFormV2");
    const input = document.querySelector("#politicianBlockNameSearch");
    if (input && !input.dataset.bound) {
      input.dataset.bound = "1";
      input.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => updateSearch(input.value), 180); });
      input.addEventListener("focus", () => { if (input.value.trim()) updateSearch(input.value); });
    }
    if (f && !f.dataset.bound) {
      f.dataset.bound = "1";
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(f);
        try {
          const data = await call("POST", {
            name: fd.get("name"),
            positiveCount: fd.get("positiveCount"), positiveMinutes: fd.get("positiveMinutes"),
            neutralCount: fd.get("neutralCount"), neutralMinutes: fd.get("neutralMinutes"),
            negativeCount: fd.get("negativeCount"), negativeMinutes: fd.get("negativeMinutes"),
            anyCount: fd.get("anyCount"), anyMinutes: fd.get("anyMinutes"),
          });
          settings = data.settings || []; reset(); render();
        } catch (err) { alert(err.message || "저장하지 못했습니다."); }
      });
    }
  }

  document.addEventListener("click", async e => {
    const pick = e.target.closest?.("[data-pb2-pick]");
    if (pick) { const input = document.querySelector("#politicianBlockNameSearch"); if (input) input.value = pick.dataset.pb2Pick; hideResults(); return; }
    if (e.target.closest?.("[data-pb2-reset]")) { reset(); return; }
    const edit = e.target.closest?.("[data-pb2-edit]");
    if (edit) { fill(settings.find(x => x.id === edit.dataset.pb2Edit)); return; }
    const del = e.target.closest?.("[data-pb2-del]");
    if (!del) return;
    if (!confirm("이 연속 차단 설정을 삭제할까요?")) return;
    try { const data = await call("DELETE", {id: del.dataset.pb2Del}); settings = data.settings || []; render(); } catch (err) { alert(err.message || "삭제하지 못했습니다."); }
  }, true);

  async function load() { if (busy) return; busy = true; try { const data = await call("GET"); settings = data.settings || []; } catch {} busy = false; render(); }

  async function mount() {
    if (!location.pathname.startsWith("/admin")) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    addStyle();
    document.querySelector("#politicianBlockSettingsCard")?.remove();
    if (!document.querySelector(`#${CARD_ID}`)) {
      const t = document.createElement("div"); t.innerHTML = html();
      const after = document.querySelector("#politicianRulesCardStable");
      if (after?.parentNode === layout) layout.insertBefore(t.firstElementChild, after.nextSibling); else layout.insertBefore(t.firstElementChild, layout.querySelector("article.admin-card") || null);
      bind(); await load();
    } else { bind(); render(); }
  }

  let queued = false;
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mount(); }); }
  schedule();
  new MutationObserver(schedule).observe(document.documentElement, {childList:true,subtree:true});
})();
