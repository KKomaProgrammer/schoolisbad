(() => {
  const CARD_ID = "politicianBlockSettingsCard";
  let settings = [];
  let busy = false;

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

  async function call(method, body) {
    const t = token();
    const res = await fetch("/api/admin/politician-blocks", {
      method,
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${t}`,
        "x-admin-token": t,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "차단 설정 요청 실패");
    return data;
  }

  function addStyle() {
    if (document.querySelector("#politician-block-style")) return;
    const s = document.createElement("style");
    s.id = "politician-block-style";
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
    `;
    document.head.appendChild(s);
  }

  function html() {
    return `
      <article class="admin-card" id="${CARD_ID}">
        <div class="section-head"><h2>정치인 연속 차단 설정</h2><p>감정별 횟수/시간 또는 감정 상관없이 횟수/시간을 지정합니다. 상관없이 설정이 있으면 감정별 설정보다 우선합니다.</p></div>
        <form class="pb-form" id="politicianBlockForm">
          <div class="field"><label>정치인 이름</label><input name="name" placeholder="정치인 차단 메시지 관리에 등록한 이름" required></div>
          <div class="pb-grid">
            <div class="pb-mini"><b>긍정 연속</b><input name="positiveCount" type="number" min="0" max="50" placeholder="횟수"><input name="positiveMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
            <div class="pb-mini"><b>중립 연속</b><input name="neutralCount" type="number" min="0" max="50" placeholder="횟수"><input name="neutralMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
            <div class="pb-mini"><b>부정 연속</b><input name="negativeCount" type="number" min="0" max="50" placeholder="횟수"><input name="negativeMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
            <div class="pb-mini"><b>감정 상관없이</b><input name="anyCount" type="number" min="0" max="50" placeholder="횟수"><input name="anyMinutes" type="number" min="1" max="10080" placeholder="차단 분"></div>
          </div>
          <div class="help">0 또는 빈칸은 사용 안 함입니다. 감정 상관없이 횟수가 1 이상이면 긍정/중립/부정별 횟수는 무시됩니다.</div>
          <div class="actions"><button class="btn" type="submit">차단 설정 저장</button><button class="btn secondary" type="button" data-pb-reset>새로 입력</button></div>
        </form>
        <div class="pb-list" id="politicianBlockList"></div>
      </article>
    `;
  }

  function render() {
    const list = document.querySelector("#politicianBlockList");
    if (!list) return;
    if (!settings.length) {
      list.innerHTML = `<div class="empty">아직 연속 차단 설정이 없습니다.</div>`;
      return;
    }
    list.innerHTML = settings.map(s => `
      <div class="pb-item" data-id="${esc(s.id)}">
        <div class="pb-head"><div class="pb-name">${esc(s.id)}</div><div><button class="btn secondary small" type="button" data-pb-edit="${esc(s.id)}">수정</button> <button class="btn danger small" type="button" data-pb-del="${esc(s.id)}">삭제</button></div></div>
        <div class="pb-msg"><b>긍정</b> ${Number(s.positive?.count || 0)}회 / ${Number(s.positive?.minutes || 0)}분</div>
        <div class="pb-msg"><b>중립</b> ${Number(s.neutral?.count || 0)}회 / ${Number(s.neutral?.minutes || 0)}분</div>
        <div class="pb-msg"><b>부정</b> ${Number(s.negative?.count || 0)}회 / ${Number(s.negative?.minutes || 0)}분</div>
        <div class="pb-msg"><b>상관없이</b> ${Number(s.any?.count || 0)}회 / ${Number(s.any?.minutes || 0)}분 ${Number(s.any?.count || 0) > 0 ? "· 우선 적용" : ""}</div>
      </div>
    `).join("");
  }

  function reset() {
    const f = document.querySelector("#politicianBlockForm");
    if (f) f.reset();
  }

  function fill(s) {
    const f = document.querySelector("#politicianBlockForm");
    if (!f || !s) return;
    f.name.value = s.id || "";
    f.positiveCount.value = s.positive?.count || "";
    f.positiveMinutes.value = s.positive?.minutes || "";
    f.neutralCount.value = s.neutral?.count || "";
    f.neutralMinutes.value = s.neutral?.minutes || "";
    f.negativeCount.value = s.negative?.count || "";
    f.negativeMinutes.value = s.negative?.minutes || "";
    f.anyCount.value = s.any?.count || "";
    f.anyMinutes.value = s.any?.minutes || "";
    f.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function bind() {
    const f = document.querySelector("#politicianBlockForm");
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
          settings = data.settings || [];
          reset();
          render();
        } catch (err) { alert(err.message || "저장하지 못했습니다."); }
      });
    }
  }

  document.addEventListener("click", async e => {
    if (e.target.closest?.("[data-pb-reset]")) { reset(); return; }
    const edit = e.target.closest?.("[data-pb-edit]");
    if (edit) { fill(settings.find(x => x.id === edit.dataset.pbEdit)); return; }
    const del = e.target.closest?.("[data-pb-del]");
    if (!del) return;
    if (!confirm("이 연속 차단 설정을 삭제할까요?")) return;
    try {
      const data = await call("DELETE", {id: del.dataset.pbDel});
      settings = data.settings || [];
      render();
    } catch (err) { alert(err.message || "삭제하지 못했습니다."); }
  }, true);

  async function load() {
    if (busy) return;
    busy = true;
    try {
      const data = await call("GET");
      settings = data.settings || [];
    } catch {}
    busy = false;
    render();
  }

  async function mount() {
    if (!location.pathname.startsWith("/admin")) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    addStyle();
    if (!document.querySelector(`#${CARD_ID}`)) {
      const t = document.createElement("div");
      t.innerHTML = html();
      const after = document.querySelector("#politicianRulesCardStable");
      if (after?.parentNode === layout) layout.insertBefore(t.firstElementChild, after.nextSibling);
      else layout.insertBefore(t.firstElementChild, layout.querySelector("article.admin-card") || null);
      bind();
      await load();
    } else {
      bind();
      render();
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; mount(); });
  }

  schedule();
  new MutationObserver(schedule).observe(document.documentElement, {childList:true,subtree:true});
})();
