(() => {
  const CARD_ID = "siteSettingsCard";
  let settings = { maxPostsPerIp: 1 };
  let busy = false;

  function token() {
    try { return localStorage.getItem("schoolisbad_admin_session") || ""; } catch { return ""; }
  }

  async function call(method, body) {
    const t = token();
    const res = await fetch("/api/admin/site-settings", {
      method,
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${t}`,
        "x-admin-token": t,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "설정 요청 실패");
    return data;
  }

  function addStyle() {
    if (document.querySelector("#site-settings-style")) return;
    const s = document.createElement("style");
    s.id = "site-settings-style";
    s.textContent = `
      #${CARD_ID}{position:relative;overflow:hidden;background:linear-gradient(135deg,#fffaf0,#ffffff);border:3px solid #11100f;box-shadow:7px 7px 0 #11100f}
      #${CARD_ID}::before{content:"IP LIMIT";position:absolute;right:-28px;top:18px;transform:rotate(18deg);font-weight:950;font-size:34px;color:rgba(127,13,13,.08);letter-spacing:-.05em;pointer-events:none}
      #${CARD_ID} .settings-chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}
      #${CARD_ID} .settings-chip{border:2px solid #11100f;background:#ffbd2e;padding:7px 10px;font-weight:950;box-shadow:3px 3px 0 #11100f}
      #${CARD_ID} .settings-form{display:grid;gap:12px;position:relative;z-index:1}
      #${CARD_ID} input{font-size:18px;font-weight:900;text-align:center}
      #${CARD_ID} .poster-note{border:2px solid #11100f;background:#fffaf0;padding:10px;line-height:1.55;font-weight:750}
    `;
    document.head.appendChild(s);
  }

  function html() {
    return `
      <article class="admin-card" id="${CARD_ID}">
        <div class="section-head">
          <h2>IP당 글 등록 제한</h2>
          <p>같은 IP에서 등록 가능한 글 개수를 조절합니다.</p>
        </div>
        <div class="settings-chips">
          <span class="settings-chip">중복 도배 방지</span>
          <span class="settings-chip">IP 기준</span>
          <span class="settings-chip">1~50개</span>
        </div>
        <form class="settings-form" id="siteSettingsForm">
          <div class="field">
            <label>IP당 최대 등록 글 개수</label>
            <input name="maxPostsPerIp" type="number" min="1" max="50" required>
          </div>
          <div class="poster-note">예: 1이면 같은 IP에서 1개만 등록 가능, 3이면 같은 IP에서 3개까지 등록 가능합니다. 삭제된 글은 개수에서 제외됩니다.</div>
          <div class="actions"><button class="btn" type="submit">설정 저장</button></div>
        </form>
      </article>
    `;
  }

  function render() {
    const form = document.querySelector("#siteSettingsForm");
    if (!form) return;
    form.maxPostsPerIp.value = settings.maxPostsPerIp || 1;
  }

  function bind() {
    const form = document.querySelector("#siteSettingsForm");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const data = await call("POST", { maxPostsPerIp: fd.get("maxPostsPerIp") });
        settings = data.settings || settings;
        render();
        alert("저장되었습니다.");
      } catch (err) {
        alert(err.message || "설정을 저장하지 못했습니다.");
      }
    });
  }

  async function load() {
    if (busy) return;
    busy = true;
    try {
      const data = await call("GET");
      settings = data.settings || settings;
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
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
