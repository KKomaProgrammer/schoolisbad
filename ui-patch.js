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
      .admin-ip-chip { display: inline-block; margin-top: 8px; padding: 4px 7px; border: 2px solid #11100f; background: #fffaf0; color: #7f0d0d; font-size: 12px; font-weight: 950; }
    `;
    document.head.appendChild(style);
  }

  clearStaleBlock();
  document.addEventListener("click", clearStaleBlock, true);
  document.addEventListener("submit", clearStaleBlock, true);

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

  function enhanceAdmin() {
    if (!location.pathname.startsWith("/admin")) return;
    const layout = document.querySelector(".admin-layout");
    if (!layout) return;

    const cards = [...layout.querySelectorAll("article.admin-card")];
    const blockCard = cards.find((card) => card.textContent.includes("IP 차단 리스트"));
    const postCard = cards.find((card) => card.textContent.includes("등록 글 관리"));
    if (blockCard && postCard && (postCard.compareDocumentPosition(blockCard) & Node.DOCUMENT_POSITION_FOLLOWING)) {
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

  function apply() {
    clearStaleBlock();
    injectStyle();
    enhanceAdmin();
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
