(() => {
  let loaded = false;
  let rules = [];

  function session() {
    try { return localStorage.getItem("schoolisbad_admin_session") || ""; } catch { return ""; }
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function headers() {
    const token = session();
    return {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
      "x-admin-token": token,
    };
  }

  async function api(method, body) {
    const res = await fetch("/api/admin/politicians", {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "정치인 규칙 요청 실패");
    return data;
  }

  function injectStyle() {
    if (document.querySelector("#admin-politicians-style")) return;
    const style = document.createElement("style");
    style.id = "admin-politicians-style";
    style.textContent = `
      .politician-rule-form { display: grid; gap: 10px; }
      .politician-rule-form textarea { min-height: 66px; resize: vertical; }
      .politician-rule-list { display: grid; gap: 10px; margin-top: 14px; }
      .politician-rule-item { border: 2px solid #11100f; background: #fffaf0; padding: 12px; box-shadow: 3px 3px 0 #11100f; }
      .politician-rule-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
      .politician-rule-name { font-weight: 950; color: #7f0d0d; }
      .politician-rule-msg { margin: 4px 0; font-size: 13px; line-height: 1.45; }
      .politician-rule-actions { display:flex; gap:6px; flex-wrap:wrap; }
    `;
    document.head.appendChild(style);
  }

  function formHtml() {
    return `
      <article class="admin-card" id="politicianRulesCard">
        <div class="section-head"><h2>정치인 차단 메시지 관리</h2><p>txt에 없어도 여기서 추가하면 차단됩니다.</p></div>
        <form class="politician-rule-form" id="politicianRuleForm">
          <input type="hidden" name="id" />
          <div class="form-grid">
            <div class="field"><label>정치인 이름</label><input name="name" placeholder="예: 홍길동" required /></div>
            <div class="field"><label>별칭</label><input name="aliases" placeholder="쉼표로 구분, 예: 길동,ㅎㄱㄷ" /></div>
          </div>
          <div class="field"><label>긍정일 때 차단 메시지</label><textarea name="positiveMessage" placeholder="예: {name} 님 칭찬은 정치 뉴스룸으로 보내겠습니다." required></textarea></div>
          <div class="field"><label>중립일 때 차단 메시지</label><textarea name="neutralMessage" placeholder="예: {name} 님 이야기는 교육 게시판에서 잠시 퇴장입니다." required></textarea></div>
          <div class="field"><label>부정일 때 차단 메시지</label><textarea name="negativeMessage" placeholder="예: {name} 님 비판도 정치 주제라 등록되지 않습니다." required></textarea></div>
          <div class="actions">
            <button class="btn" type="submit">저장</button>
            <button class="btn secondary" type="button" id="politicianRuleReset">새로 입력</button>
          </div>
        </form>
        <div class="politician-rule-list" id="politicianRuleList"></div>
      </article>
    `;
  }

  function renderList() {
    const list = document.querySelector("#politicianRuleList");
    if (!list) return;
    if (!rules.length) {
      list.innerHTML = `<div class="empty">아직 관리자 추가 정치인이 없습니다.</div>`;
      return;
    }
    list.innerHTML = rules.map(rule => `
      <div class="politician-rule-item" data-id="${esc(rule.id)}">
        <div class="politician-rule-head">
          <div class="politician-rule-name">${esc(rule.name)}</div>
          <div class="politician-rule-actions">
            <button class="btn secondary small" type="button" data-politician-edit="${esc(rule.id)}">수정</button>
            <button class="btn danger small" type="button" data-politician-delete="${esc(rule.id)}">삭제</button>
          </div>
        </div>
        ${rule.aliases?.length ? `<div class="help">별칭: ${esc(rule.aliases.join(", "))}</div>` : ""}
        <div class="politician-rule-msg"><b>긍정</b> ${esc(rule.messages?.positive || "")}</div>
        <div class="politician-rule-msg"><b>중립</b> ${esc(rule.messages?.neutral || "")}</div>
        <div class="politician-rule-msg"><b>부정</b> ${esc(rule.messages?.negative || "")}</div>
      </div>
    `).join("");
  }

  function resetForm() {
    const form = document.querySelector("#politicianRuleForm");
    if (!form) return;
    form.reset();
    form.id.value = "";
  }

  function fillForm(rule) {
    const form = document.querySelector("#politicianRuleForm");
    if (!form || !rule) return;
    form.id.value = rule.id || "";
    form.name.value = rule.name || "";
    form.aliases.value = Array.isArray(rule.aliases) ? rule.aliases.join(", ") : "";
    form.positiveMessage.value = rule.messages?.positive || "";
    form.neutralMessage.value = rule.messages?.neutral || "";
    form.negativeMessage.value = rule.messages?.negative || "";
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function loadRules() {
    const data = await api("GET");
    rules = data.rules || [];
    renderList();
  }

  function bindEvents() {
    const form = document.querySelector("#politicianRuleForm");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "1";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fd = new FormData(form);
        const payload = {
          id: fd.get("id") || fd.get("name"),
          name: fd.get("name"),
          aliases: String(fd.get("aliases") || "").split(",").map(x => x.trim()).filter(Boolean),
          positiveMessage: fd.get("positiveMessage"),
          neutralMessage: fd.get("neutralMessage"),
          negativeMessage: fd.get("negativeMessage"),
        };
        try {
          const data = await api("POST", payload);
          rules = data.rules || [];
          resetForm();
          renderList();
        } catch (error) {
          alert(error.message || "저장하지 못했습니다.");
        }
      });
    }

    const reset = document.querySelector("#politicianRuleReset");
    if (reset && !reset.dataset.bound) {
      reset.dataset.bound = "1";
      reset.addEventListener("click", resetForm);
    }
  }

  document.addEventListener("click", async (event) => {
    const edit = event.target.closest?.("[data-politician-edit]");
    if (edit) {
      const rule = rules.find(x => x.id === edit.dataset.politicianEdit);
      fillForm(rule);
      return;
    }

    const del = event.target.closest?.("[data-politician-delete]");
    if (!del) return;
    if (!confirm("이 정치인 차단 규칙을 삭제할까요?")) return;
    try {
      const data = await api("DELETE", { id: del.dataset.politicianDelete });
      rules = data.rules || [];
      renderList();
    } catch (error) {
      alert(error.message || "삭제하지 못했습니다.");
    }
  }, true);

  async function mount() {
    if (!location.pathname.startsWith("/admin")) return;
    if (loaded) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    loaded = true;
    injectStyle();
    if (!document.querySelector("#politicianRulesCard")) {
      const temp = document.createElement("div");
      temp.innerHTML = formHtml();
      const firstCard = layout.querySelector("article.admin-card");
      layout.insertBefore(temp.firstElementChild, firstCard || null);
    }
    bindEvents();
    await loadRules().catch(() => renderList());
  }

  function schedule() {
    requestAnimationFrame(() => mount());
  }

  schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
