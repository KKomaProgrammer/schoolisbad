(() => {
  let queued = false;
  const staleBlockKey = "schoolisbad_blocked_until";
  const adminPostsById = new Map();
  const originalFetch = window.fetch.bind(window);

  function clearStaleBlock() {
    try { localStorage.removeItem(staleBlockKey); } catch (error) {}
  }

  function adminSession() {
    try { return localStorage.getItem("schoolisbad_admin_session") || ""; } catch { return ""; }
  }

  function injectStyle() {
    if (document.querySelector("#schoolisbad-ui-patch-style")) return;
    const style = document.createElement("style");
    style.id = "schoolisbad-ui-patch-style";
    style.textContent = `
      .featured-comments { margin-top: 22px; display: grid; gap: 12px; position: relative; z-index: 1; }
      .featured-comments-title { font-weight: 950; color: #7f0d0d; letter-spacing: -.04em; }
      .featured-comment { position: relative; background: #fffaf0; border: 3px solid #11100f; padding: 14px 16px; box-shadow: 5px 5px 0 #ffbd2e; color: #16110d; }
      .featured-comment::before { content: ""; position: absolute; left: 22px; bottom: -13px; width: 18px; height: 18px; background: #fffaf0; border-right: 3px solid #11100f; border-bottom: 3px solid #11100f; transform: rotate(45deg); }
      .featured-comment b { display: block; margin-bottom: 6px; font-size: 16px; }
      .featured-comment span { display: block; color: #40352d; line-height: 1.55; font-weight: 700; }
      .write-jump-wrap { margin-top: 18px; display: flex; justify-content: center; }
      .write-jump { border: 3px solid #11100f; background: #ffbd2e; color: #11100f; box-shadow: 5px 5px 0 #11100f; padding: 12px 20px; font-weight: 950; cursor: pointer; }
      .admin-ip-chip { display: inline-block; margin-top: 8px; padding: 4px 7px; border: 2px solid #11100f; background: #fffaf0; color: #7f0d0d; font-size: 12px; font-weight: 950; }
    `;
    document.head.appendChild(style);
  }

  clearStaleBlock();
  document.addEventListener("click", clearStaleBlock, true);
  document.addEventListener("submit", clearStaleBlock, true);
  setInterval(clearStaleBlock, 1500);

  if (location.pathname.startsWith("/admin")) {
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input && input.url ? input.url : "";
      const response = await originalFetch(input, init);

      if (url.includes("/api/posts") && response.ok) {
        response.clone().json().then((data) => {
          adminPostsById.clear();
          for (const post of data.posts || []) adminPostsById.set(post.id, post);
          schedule();
        }).catch(() => {});
      }

      if (!url.includes("/api/admin/blocks")) return response;
      if (response.ok) return response;

      return new Response(JSON.stringify({ blocks: [] }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    };
  }

  document.addEventListener("click", async (event) => {
    const scrollButton = event.target.closest?.("[data-scroll-write]");
    if (scrollButton) {
      event.preventDefault();
      document.querySelector("#write")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const blockButton = event.target.closest?.("[data-ui-action='block-ip']");
    if (!blockButton) return;

    event.preventDefault();
    const ip = blockButton.dataset.ip || "";
    if (!ip) return;

    blockButton.disabled = true;
    blockButton.textContent = "차단 중";

    try {
      const session = adminSession();
      const res = await originalFetch("/api/admin/blocks", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `Bearer ${session}`,
          "x-admin-token": session,
        },
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

  function replaceText() {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);

    for (const node of list) {
      const original = node.nodeValue || "";
      let text = original;
      text = text.replaceAll("증언", "의견");
      text = text.replaceAll("시간순 정렬", "");
      text = text.replaceAll("중립·부정으로 판별된 비판적 기록만 저장됩니다.", "부정 의견만 저장됩니다.");
      text = text.replaceAll("문장이 중립 또는 부정으로 판별될 때만 등록됩니다.", "부정 의견만 등록됩니다.");
      text = text.replaceAll("감정 검사는 프론트가 아니라 서버에서 수행됩니다.", "");
      text = text.replaceAll("아직 등록된 기록이 없습니다.", "아직 등록된 의견이 없습니다.");
      text = text.replaceAll("최근 기록", "최근 의견");
      text = text.replaceAll("기록만", "의견만");
      if (text !== original) node.nodeValue = text;
    }
  }

  function rewriteIndictment() {
    const section = document.querySelector(".indictment");
    const grid = section?.querySelector(".grid-4");
    if (!grid || grid.dataset.rewritten === "1") return;
    grid.dataset.rewritten = "1";
    grid.innerHTML = `
      <article class="stat-card"><b>01</b><p>학교는 진도를 끝내는 곳이 아니라 이해를 책임지는 곳이어야 한다.</p></article>
      <article class="stat-card"><b>02</b><p>학원 선행을 전제로 굴러가는 교실은 이미 공교육의 책임을 사교육에 넘긴 것이다.</p></article>
      <article class="stat-card"><b>03</b><p>“다 이해했지?”라는 말 뒤에 숨은 침묵은 이해가 아니라 포기일 수 있다.</p></article>
      <article class="stat-card"><b>04</b><p>성적 부진을 학생 탓으로만 돌리는 순간 학교는 가르침의 책임을 놓친다.</p></article>
      <article class="stat-card"><b>05</b><p>부유함이 곧 성적이 되는 구조는 교육이 아니라 출발선 거래다.</p></article>
      <article class="stat-card"><b>06</b><p>수포자와 포기자를 양산하는 진도 중심 수업을 더 이상 정상으로 부를 수 없다.</p></article>
    `;
  }

  function addFeaturedComments() {
    if (location.pathname.startsWith("/admin")) return;
    const manifesto = document.querySelector(".manifesto");
    const sourceCards = [...document.querySelectorAll("#voices .post-card")].slice(0, 4);
    if (!manifesto || !sourceCards.length) return;

    let box = manifesto.querySelector(".featured-comments");
    if (!box) {
      box = document.createElement("div");
      box.className = "featured-comments";
      manifesto.appendChild(box);
    }

    const html = [`<div class="featured-comments-title">관리자 선정 댓글</div>`].concat(sourceCards.map((card) => {
      const title = card.querySelector("h3")?.textContent?.trim() || "선정 의견";
      const body = card.querySelector("p")?.textContent?.trim() || "";
      return `<div class="featured-comment"><b>${escapeHtml(title)}</b><span>${escapeHtml(body.slice(0, 95))}${body.length > 95 ? "…" : ""}</span></div>`;
    })).join("");

    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function addWriteJump() {
    if (location.pathname.startsWith("/admin")) return;
    const sections = [...document.querySelectorAll(".site-shell.section")];
    const recent = sections.reverse().find((section) => section.querySelector(".posts-grid"));
    if (!recent || recent.querySelector(".write-jump-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "write-jump-wrap";
    wrap.innerHTML = `<button class="write-jump" data-scroll-write="1">글 올리기</button>`;
    recent.appendChild(wrap);
  }

  function enhanceAdmin() {
    if (!location.pathname.startsWith("/admin")) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;

    const cards = [...layout.querySelectorAll("article.admin-card")];
    const blockCard = cards.find((card) => card.textContent.includes("IP 차단 리스트"));
    const postCard = cards.find((card) => card.textContent.includes("등록 글 관리"));
    if (blockCard && postCard && blockCard.previousElementSibling !== postCard.previousElementSibling) {
      layout.insertBefore(blockCard, postCard);
    }

    for (const row of layout.querySelectorAll("tbody tr")) {
      const idButton = row.querySelector("[data-id]");
      const postId = idButton?.dataset?.id;
      if (!postId) continue;
      const post = adminPostsById.get(postId);
      if (!post?.ip) continue;

      const titleCell = row.children[1];
      if (titleCell && !titleCell.querySelector(".admin-ip-chip")) {
        const chip = document.createElement("div");
        chip.className = "admin-ip-chip";
        chip.textContent = `IP ${post.maskedIp || post.ip}`;
        titleCell.appendChild(chip);
      }

      const actions = row.querySelector(".admin-row-actions");
      if (actions && !actions.querySelector("[data-ui-action='block-ip']")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn danger small";
        btn.dataset.uiAction = "block-ip";
        btn.dataset.ip = post.ip;
        btn.textContent = "IP 차단";
        actions.appendChild(btn);
      }
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function apply() {
    clearStaleBlock();
    injectStyle();
    replaceText();
    rewriteIndictment();
    addFeaturedComments();
    addWriteJump();
    enhanceAdmin();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      queued = false;
      apply();
    }));
  }

  schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
