(() => {
  let queued = false;
  let postsLoading = false;
  let notesLoading = false;
  let notesLoaded = false;

  const staleBlockKey = "schoolisbad_blocked_until";
  const adminPostsById = new Map();
  const notesByIp = new Map();
  const originalFetch = window.fetch.bind(window);

  function clearStaleBlock() {
    try { localStorage.removeItem(staleBlockKey); } catch (error) {}
  }

  function adminSession() {
    try { return localStorage.getItem("schoolisbad_admin_session") || ""; } catch { return ""; }
  }

  function authHeaders(extra = {}) {
    const session = adminSession();
    return { ...extra, authorization: `Bearer ${session}`, "x-admin-token": session };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cssEscape(value) {
    try { return CSS.escape(String(value)); } catch { return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  }

  function exactIp(post) {
    return String(post?.ip || "").trim();
  }

  function injectStyle() {
    if (document.querySelector("#schoolisbad-ui-patch-style")) return;
    const style = document.createElement("style");
    style.id = "schoolisbad-ui-patch-style";
    style.textContent = `
      .admin-ip-chip { display: inline-block; margin-top: 8px; padding: 4px 7px; border: 2px solid #11100f; background: #fffaf0; color: #7f0d0d; font-size: 12px; font-weight: 950; }
      .admin-user-note { margin-top: 8px; display: grid; gap: 6px; max-width: 420px; border: 2px solid #11100f; background: #fffaf0; padding: 8px; box-shadow: 3px 3px 0 #11100f; }
      .admin-user-note-label { display: inline-block; width: fit-content; padding: 3px 7px; border: 2px solid #11100f; background: #ffbd2e; color: #11100f; font-size: 12px; font-weight: 950; box-shadow: 2px 2px 0 #11100f; }
      .admin-user-note-text { white-space: pre-wrap; word-break: break-word; color: #352a22; font-size: 13px; line-height: 1.55; font-weight: 750; }
      .admin-user-note-form { display: grid; gap: 6px; margin-top: 8px; }
      .admin-user-note-form[hidden] { display: none !important; }
      .admin-user-note-form textarea { min-height: 58px; resize: vertical; font-size: 13px; line-height: 1.45; padding: 8px 9px; }
      .admin-user-note-form .note-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .admin-user-note-toggle { width: fit-content; margin-top: 2px; }
      #adminUserNotesCard { position: relative; overflow: hidden; background: linear-gradient(135deg,#fffaf0,#fff3d9); border: 3px solid #11100f; box-shadow: 7px 7px 0 #11100f; }
      #adminUserNotesCard::before { content: "MEMO"; position: absolute; right: -10px; top: 12px; transform: rotate(14deg); font-weight: 950; font-size: 42px; color: rgba(127,13,13,.08); pointer-events: none; }
      .admin-note-list { display: grid; gap: 10px; margin-top: 12px; position: relative; z-index: 1; }
      .admin-note-item { border: 2px solid #11100f; background: #fffaf0; padding: 10px; box-shadow: 3px 3px 0 #11100f; }
      .admin-note-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
      .admin-note-head b { color: #7f0d0d; }
      .admin-note-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    `;
    document.head.appendChild(style);
  }

  clearStaleBlock();
  document.addEventListener("click", clearStaleBlock, true);
  document.addEventListener("submit", clearStaleBlock, true);

  function upsertPosts(posts, replace = false) {
    if (replace) adminPostsById.clear();
    for (const post of posts || []) {
      if (!post?.id) continue;
      const prev = adminPostsById.get(post.id) || {};
      adminPostsById.set(post.id, {
        ...prev,
        ...post,
        ip: post.ip || prev.ip || "",
        maskedIp: post.maskedIp || prev.maskedIp || "",
      });
    }
  }

  function upsertNotes(notes) {
    notesByIp.clear();
    for (const item of notes || []) if (item?.ip) notesByIp.set(item.ip, item.note || "");
  }

  if (location.pathname.startsWith("/admin")) {
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input && input.url ? input.url : "";
      let nextInit = init;
      if (url.includes("/api/posts")) {
        const headers = new Headers(init.headers || {});
        const session = adminSession();
        if (session && !headers.has("authorization")) headers.set("authorization", `Bearer ${session}`);
        if (session && !headers.has("x-admin-token")) headers.set("x-admin-token", session);
        nextInit = { ...init, headers };
      }
      const response = await originalFetch(input, nextInit);
      if (url.includes("/api/posts") && response.ok) {
        response.clone().json().then((data) => {
          upsertPosts(data.posts || [], false);
          loadAdminPostsIfNeeded(true);
          schedule();
        }).catch(() => {});
      }
      if (!url.includes("/api/admin/blocks")) return response;
      if (response.ok) return response;
      return new Response(JSON.stringify({ blocks: [] }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
    };
  }

  async function loadAdminPostsIfNeeded(force = false) {
    if (!location.pathname.startsWith("/admin")) return;
    if (postsLoading) return;
    if (!force && adminPostsById.size) return;
    const session = adminSession();
    if (!session) return;
    postsLoading = true;
    try {
      const res = await originalFetch("/api/admin/posts", { headers: authHeaders({ "x-owner-token": localStorage.getItem("schoolisbad_owner_token") || "" }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) upsertPosts(data.posts || [], true);
    } catch (error) {
    } finally {
      postsLoading = false;
      schedule();
    }
  }

  async function loadNotes(force = false) {
    if (!location.pathname.startsWith("/admin")) return;
    if (notesLoading) return;
    if (notesLoaded && !force) return;
    const session = adminSession();
    if (!session) return;
    notesLoading = true;
    try {
      const res = await originalFetch("/api/admin/user-notes", { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { upsertNotes(data.notes || []); notesLoaded = true; }
    } catch (error) {
    } finally {
      notesLoading = false;
      schedule();
    }
  }

  async function saveNote(ip, note) {
    const res = await originalFetch("/api/admin/user-notes", {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json; charset=utf-8" }),
      body: JSON.stringify({ ip, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "메모 저장 실패");
    upsertNotes(data.notes || []);
    notesLoaded = true;
    renderNoteSummary();
    schedule();
  }

  document.addEventListener("click", async (event) => {
    const blockButton = event.target.closest?.("[data-ui-action='block-ip']");
    if (!blockButton) return;
    event.preventDefault();
    const ip = blockButton.dataset.ip || "";
    if (!ip) return alert("차단할 IP 정보가 없습니다. 새로고침 후 다시 시도해 주세요.");
    if (!confirm(`${ip} 를 차단할까요?`)) return;
    blockButton.disabled = true;
    blockButton.textContent = "차단 중";
    try {
      const res = await originalFetch("/api/admin/blocks", {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json; charset=utf-8" }),
        body: JSON.stringify({ ip, reason: "관리자 수동 차단" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "차단 실패");
      blockButton.textContent = "차단됨";
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      blockButton.disabled = false;
      blockButton.textContent = "IP 차단";
      alert(error.message || "차단하지 못했습니다.");
    }
  }, true);

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest?.("[data-ui-action='toggle-user-note']");
    if (!toggle) return;
    event.preventDefault();
    const box = toggle.closest(".admin-user-note");
    const form = box?.querySelector(".admin-user-note-form");
    if (!form) return;
    const willOpen = form.hidden;
    form.hidden = !willOpen;
    toggle.textContent = willOpen ? "메모 닫기" : (toggle.dataset.hasNote === "1" ? "메모 수정" : "메모 추가");
    if (willOpen) form.querySelector("textarea")?.focus();
  }, true);

  document.addEventListener("click", async (event) => {
    const save = event.target.closest?.("[data-ui-action='save-user-note']");
    if (!save) return;
    event.preventDefault();
    const ip = save.dataset.ip || "";
    const wrap = save.closest(".admin-user-note-form");
    const textarea = wrap?.querySelector("textarea");
    if (!ip || !textarea) return;
    save.disabled = true;
    save.textContent = "저장 중";
    try {
      await saveNote(ip, textarea.value);
      save.textContent = "저장됨";
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      save.disabled = false;
      save.textContent = "메모 저장";
      alert(error.message || "메모를 저장하지 못했습니다.");
    }
  }, true);

  function noteHtml(ip) {
    const text = notesByIp.get(ip) || "";
    const hasNote = Boolean(String(text).trim());
    return `
      <div class="admin-user-note" data-note-ip="${escapeHtml(ip)}">
        <span class="admin-user-note-label">관리자 메모</span>
        ${hasNote ? `<div class="admin-user-note-text">${escapeHtml(text)}</div>` : `<div class="help">저장된 메모 없음</div>`}
        <button type="button" class="btn secondary small admin-user-note-toggle" data-ui-action="toggle-user-note" data-has-note="${hasNote ? "1" : "0"}">${hasNote ? "메모 수정" : "메모 추가"}</button>
        <div class="admin-user-note-form" hidden>
          <textarea placeholder="이 IP 사용자에 대한 관리자 메모" maxlength="1000">${escapeHtml(text)}</textarea>
          <div class="note-actions">
            <button type="button" class="btn secondary small" data-ui-action="save-user-note" data-ip="${escapeHtml(ip)}">메모 저장</button>
            <button type="button" class="btn secondary small" data-ui-action="save-user-note" data-ip="${escapeHtml(ip)}" onclick="this.closest('.admin-user-note-form').querySelector('textarea').value=''">메모 삭제</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderNoteSummary() {
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    let card = document.querySelector("#adminUserNotesCard");
    if (!card) {
      card = document.createElement("article");
      card.className = "admin-card";
      card.id = "adminUserNotesCard";
      card.innerHTML = `<div class="section-head"><h2>사용자 메모 모음</h2><p>글 작성 IP와 차단 IP에 남긴 관리자 메모</p></div><div class="admin-note-list"></div>`;
      const blockCard = [...layout.querySelectorAll("article.admin-card")].find((item) => item.textContent.includes("IP 차단 리스트"));
      if (blockCard?.nextSibling) layout.insertBefore(card, blockCard.nextSibling); else layout.appendChild(card);
    }
    const list = card.querySelector(".admin-note-list");
    const items = [...notesByIp.entries()].filter(([, text]) => String(text || "").trim());
    if (!items.length) { list.innerHTML = `<div class="empty">저장된 사용자 메모가 없습니다.</div>`; return; }
    list.innerHTML = items.map(([ip, text]) => `
      <div class="admin-note-item">
        <div class="admin-note-head"><b>${escapeHtml(ip)}</b><div class="admin-note-actions"><button type="button" class="btn danger small" data-ui-action="block-ip" data-ip="${escapeHtml(ip)}">IP 차단</button></div></div>
        <div class="admin-user-note-text">${escapeHtml(text)}</div>
      </div>
    `).join("");
  }

  function getPostIdFromRow(row) {
    return row.querySelector("[data-action='feature'][data-id]")?.dataset.id || row.querySelector("[data-action='admin-delete'][data-id]")?.dataset.id || row.querySelector("[data-id]")?.dataset.id || "";
  }

  function enhancePostRows(layout) {
    for (const row of layout.querySelectorAll("tbody tr")) {
      const postId = getPostIdFromRow(row);
      if (!postId) continue;
      const post = adminPostsById.get(postId);
      const actions = row.querySelector(".admin-row-actions");
      const titleCell = row.children[1];
      const ip = exactIp(post);
      if (!ip) {
        if (actions && !actions.querySelector("[data-ui-action='block-ip']") && !actions.querySelector(".admin-ip-missing")) {
          const miss = document.createElement("span");
          miss.className = "help admin-ip-missing";
          miss.textContent = "IP 로딩 중";
          actions.appendChild(miss);
        }
        loadAdminPostsIfNeeded(true);
        continue;
      }
      actions?.querySelector(".admin-ip-missing")?.remove();
      if (titleCell) {
        let chip = titleCell.querySelector(".admin-ip-chip");
        if (!chip) {
          chip = document.createElement("div");
          chip.className = "admin-ip-chip";
          titleCell.appendChild(chip);
        }
        chip.textContent = `IP ${ip}`;
      }
      if (titleCell && !titleCell.querySelector(`[data-note-ip='${cssEscape(ip)}']`)) titleCell.insertAdjacentHTML("beforeend", noteHtml(ip));
      if (actions && !actions.querySelector(`[data-ui-action='block-ip'][data-ip='${cssEscape(ip)}']`)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn danger small";
        btn.dataset.uiAction = "block-ip";
        btn.dataset.ip = ip;
        btn.textContent = "IP 차단";
        actions.appendChild(btn);
      }
    }
  }

  function enhanceBlockRows(layout) {
    const blockCard = [...layout.querySelectorAll("article.admin-card")].find((card) => card.textContent.includes("IP 차단 리스트"));
    if (!blockCard) return;
    for (const row of blockCard.querySelectorAll("tbody tr")) {
      const ip = row.querySelector("td b")?.textContent?.trim() || "";
      if (!ip || ip.includes("차단된 IP 없음")) continue;
      const reasonCell = row.children[1];
      if (reasonCell && !reasonCell.querySelector(`[data-note-ip='${cssEscape(ip)}']`)) reasonCell.insertAdjacentHTML("beforeend", noteHtml(ip));
    }
  }

  function enhanceAdmin() {
    if (!location.pathname.startsWith("/admin")) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;
    const cards = [...layout.querySelectorAll("article.admin-card")];
    const blockCard = cards.find((card) => card.textContent.includes("IP 차단 리스트"));
    const postCard = cards.find((card) => card.textContent.includes("등록 글 관리"));
    if (blockCard && postCard && (postCard.compareDocumentPosition(blockCard) & Node.DOCUMENT_POSITION_FOLLOWING)) layout.insertBefore(blockCard, postCard);
    if (!adminPostsById.size) loadAdminPostsIfNeeded(true);
    loadNotes();
    enhancePostRows(layout);
    enhanceBlockRows(layout);
    renderNoteSummary();
  }

  function apply() { clearStaleBlock(); injectStyle(); enhanceAdmin(); }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }

  schedule();
  setInterval(() => loadAdminPostsIfNeeded(true), 2500);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
