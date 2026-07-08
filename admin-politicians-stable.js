(() => {
  let rules = [];
  let busy = false;
  let renderedKey = "";

  const CARD_ID = "politicianRulesCardStable";

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

  function rulesKey() {
    return JSON.stringify(rules.map(r => [r.id, r.name, r.aliases, r.messages]));
  }

  async function call(method, body) {
    const t = token();
    const res = await fetch("/api/admin/politicians", {
      method,
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${t}`,
        "x-admin-token": t,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "요청 실패");
    return data;
  }

  function addStyle() {
    if (document.querySelector("#politician-stable-style")) return;
    const s = document.createElement("style");
    s.id = "politician-stable-style";
    s.textContent = `
      #${CARD_ID} textarea{min-height:62px;resize:vertical}
      #${CARD_ID} .pr-form{display:grid;gap:10px}
      #${CARD_ID} .pr-list{display:grid;gap:10px;margin-top:14px}
      #${CARD_ID} .pr-item{border:2px solid #11100f;background:#fffaf0;padding:12px;box-shadow:3px 3px 0 #11100f}
      #${CARD_ID} .pr-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}
      #${CARD_ID} .pr-name{font-weight:950;color:#7f0d0d}
      #${CARD_ID} .pr-msg{font-size:13px;line-height:1.45;margin:4px 0}
      #${CARD_ID} .pr-actions{display:flex;gap:6px;flex-wrap:wrap}
    `;
    document.head.appendChild(s);
  }

  function cardHtml() {
    return `
      <article class="admin-card" id="${CARD_ID}">
        <div class="section-head"><h2>정치인 차단 메시지 관리</h2><p>txt에 없어도 여기서 추가하면 차단됩니다.</p></div>
        <form class="pr-form" id="politicianStableForm">
          <input type="hidden" name="id">
          <div class="form-grid">
            <div class="field"><label>정치인 이름</label><input name="name" placeholder="예: 홍길동" required></div>
            <div class="field"><label>별칭</label><input name="aliases" placeholder="쉼표로 구분, 예: 길동,ㅎㄱㄷ"></div>
          </div>
          <div class="field"><label>긍정일 때 차단 메시지</label><textarea name="positiveMessage" placeholder="{name} 님 칭찬은 정치 뉴스룸으로 보냅니다." required></textarea></div>
          <div class="field"><label>중립일 때 차단 메시지</label><textarea name="neutralMessage" placeholder="{name} 님 이야기는 교육 게시판에서 잠시 퇴장입니다." required></textarea></div>
          <div class="field"><label>부정일 때 차단 메시지</label><textarea name="negativeMessage" placeholder="{name} 님 비판도 정치 주제라 등록되지 않습니다." required></textarea></div>
          <div class="actions"><button class="btn" type="submit">저장</button><button class="btn secondary" type="button" data-pr-reset>새로 입력</button></div>
        </form>
        <div class="pr-list" id="politicianStableList"></div>
      </article>
    `;
  }

  function render(force = false) {
    const list = document.querySelector("#politicianStableList");
    if (!list) return;
    const key = rulesKey();
    if (!force && renderedKey === key && list.dataset.rendered === "1") return;
    renderedKey = key;
    list.dataset.rendered = "1";
    if (!rules.length) {
      list.innerHTML = `<div class="empty">아직 관리자 추가 정치인이 없습니다.</div>`;
      return;
    }
    list.innerHTML = rules.map(r => `
      <div class="pr-item" data-id="${esc(r.id)}">
        <div class="pr-head"><div class="pr-name">${esc(r.name)}</div><div class="pr-actions"><button class="btn secondary small" type="button" data-pr-edit="${esc(r.id)}">수정</button><button class="btn danger small" type="button" data-pr-del="${esc(r.id)}">삭제</button></div></div>
        ${r.aliases?.length ? `<div class="help">별칭: ${esc(r.aliases.join(", "))}</div>` : ""}
        <div class="pr-msg"><b>긍정</b> ${esc(r.messages?.positive || "")}</div>
        <div class="pr-msg"><b>중립</b> ${esc(r.messages?.neutral || "")}</div>
        <div class="pr-msg"><b>부정</b> ${esc(r.messages?.negative || "")}</div>
      </div>
    `).join("");
  }

  function bind() {
    const form = document.querySelector("#politicianStableForm");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
          const data = await call("POST", {
            id: fd.get("id") || fd.get("name"),
            name: fd.get("name"),
            aliases: String(fd.get("aliases") || "").split(",").map(x => x.trim()).filter(Boolean),
            positiveMessage: fd.get("positiveMessage"),
            neutralMessage: fd.get("neutralMessage"),
            negativeMessage: fd.get("negativeMessage"),
          });
          rules = data.rules || [];
          renderedKey = "";
          form.reset();
          form.id.value = "";
          render(true);
        } catch (err) { alert(err.message || "저장하지 못했습니다."); }
      });
    }
  }

  document.addEventListener("click", async e => {
    const reset = e.target.closest?.("[data-pr-reset]");
    if (reset) {
      const form = document.querySelector("#politicianStableForm");
      if (form) { form.reset(); form.id.value = ""; }
      return;
    }

    const edit = e.target.closest?.("[data-pr-edit]");
    if (edit) {
      const r = rules.find(x => x.id === edit.dataset.prEdit);
      const f = document.querySelector("#politicianStableForm");
      if (r && f) {
        f.id.value = r.id || "";
        f.name.value = r.name || "";
        f.aliases.value = Array.isArray(r.aliases) ? r.aliases.join(", ") : "";
        f.positiveMessage.value = r.messages?.positive || "";
        f.neutralMessage.value = r.messages?.neutral || "";
        f.negativeMessage.value = r.messages?.negative || "";
        f.scrollIntoView({behavior:"smooth",block:"center"});
      }
      return;
    }

    const del = e.target.closest?.("[data-pr-del]");
    if (!del) return;
    if (!confirm("이 정치인 차단 규칙을 삭제할까요?")) return;
    try {
      const data = await call("DELETE", {id: del.dataset.prDel});
      rules = data.rules || [];
      renderedKey = "";
      render(true);
    } catch (err) { alert(err.message || "삭제하지 못했습니다."); }
  }, true);

  async function load() {
    if (busy) return;
    busy = true;
    try {
      const data = await call("GET");
      rules = data.rules || [];
      renderedKey = "";
    } catch {}
    busy = false;
    render(true);
  }

  async function mount() {
    if (!location.pathname.startsWith("/admin")) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    addStyle();
    if (!document.querySelector(`#${CARD_ID}`)) {
      const t = document.createElement("div");
      t.innerHTML = cardHtml();
      layout.insertBefore(t.firstElementChild, layout.querySelector("article.admin-card") || null);
      bind();
      await load();
      return;
    }
    bind();
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
