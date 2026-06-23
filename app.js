const app = document.querySelector("#app");

const STORAGE = {
  owner: "schoolisbad_owner_token",
  blockedUntil: "schoolisbad_blocked_until",
  adminSession: "schoolisbad_admin_session",
};

const categories = ["사교육", "학교", "입시", "체험학습", "주입식", "기타"];
const state = { posts: [], featured: [], blocks: [], editing: null, loading: false, message: "", messageType: "" };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ownerToken() {
  let token = localStorage.getItem(STORAGE.owner);
  if (!token) {
    token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(STORAGE.owner, token);
  }
  return token;
}

function adminSession() {
  return localStorage.getItem(STORAGE.adminSession) || "";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localBlockUntil() {
  const value = localStorage.getItem(STORAGE.blockedUntil);
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time <= Date.now()) {
    localStorage.removeItem(STORAGE.blockedUntil);
    return null;
  }
  return value;
}

function blockText(until) {
  return `등록이 일시 제한되었습니다. ${formatDate(until)} 이후 다시 시도해 주세요.`;
}

function setMessage(text, type = "") {
  state.message = text || "";
  state.messageType = type;
  const box = document.querySelector("#notice");
  if (box) {
    box.textContent = state.message;
    box.className = `notice ${state.message ? "show" : ""} ${state.messageType}`;
  }
}

async function api(path, options = {}) {
  const headers = { "content-type": "application/json; charset=utf-8", ...(options.headers || {}) };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (data.blockedUntil) {
    localStorage.setItem(STORAGE.blockedUntil, data.blockedUntil);
  }
  if (!res.ok) throw Object.assign(new Error(data.error || "요청 실패"), { data, status: res.status });
  return data;
}

function layout(content, active = "home") {
  return `
    <header class="topbar">
      <div class="site-shell nav">
        <a class="logo" href="/"><span class="logo-mark">!</span><span>학교는 바뀌어야 한다</span></a>
        <nav class="nav-links">
          <a class="nav-link ${active === "home" ? "active" : ""}" href="/">문제 제기</a>
          <a class="nav-link ${active === "admin" ? "active" : ""}" href="/admin">관리자</a>
        </nav>
      </div>
    </header>
    ${content}
    <footer class="footer site-shell">비난보다 기록, 침묵보다 변화.</footer>
  `;
}

function homeTemplate() {
  const blockedUntil = localBlockUntil();
  const edit = state.editing;
  const title = edit ? edit.title : "";
  const body = edit ? edit.body : "";
  const category = edit ? edit.category : "사교육";
  const submitText = edit ? "수정 저장" : "문제점 등록";

  return layout(`
    <section class="site-shell hero">
      <div class="hero-card">
        <div class="kicker">대한민국 교육 비판 아카이브</div>
        <h1>아이들을 경쟁표로 만들지 말라.</h1>
        <p class="lead">학교와 사교육이 아이들의 삶을 압박하는 현실을 기록하고 비판합니다. 진도, 등수, 입시, 과열된 사교육보다 먼저 지켜야 할 것은 학생의 안전과 삶입니다.</p>
      </div>
      <div class="hero-side hero-card">
        <div class="point"><strong>사교육 과열</strong><span>가정 형편에 따라 기회가 달라지는 구조를 비판합니다.</span></div>
        <div class="point"><strong>주입식·진도 중심</strong><span>생각보다 속도, 이해보다 암기를 강요하는 수업을 돌아봅니다.</span></div>
        <div class="point"><strong>체험학습 위축</strong><span>안전 책임이 두려워 배움의 장이 줄어드는 문제를 기록합니다.</span></div>
      </div>
    </section>

    <section class="site-shell section">
      <div class="section-head"><h2>우리가 문제 삼는 것</h2><p>핵심만 짧고 선명하게</p></div>
      <div class="grid-4">
        <article class="stat-card"><b>01</b><p>입시 경쟁이 학생의 마음 건강을 갉아먹는 구조</p></article>
        <article class="stat-card"><b>02</b><p>학교보다 학원이 중심이 되는 사교육 의존</p></article>
        <article class="stat-card"><b>03</b><p>질문과 토론보다 정답 암기에 치우친 교육</p></article>
        <article class="stat-card"><b>04</b><p>현장 배움보다 민원과 책임 회피가 앞서는 분위기</p></article>
      </div>
    </section>

    <section class="site-shell section" id="write">
      <div class="section-head"><h2>${edit ? "내 글 수정" : "문제점 등록"}</h2><p>중립·부정으로 판별된 의견만 등록됩니다.</p></div>
      <form class="panel" id="postForm">
        <div class="form-grid">
          <div class="field">
            <label for="title">제목</label>
            <input id="title" name="title" value="${escapeHtml(title)}" maxlength="80" placeholder="예: 진도만 나가는 수업의 문제" required />
          </div>
          <div class="field">
            <label for="category">분류</label>
            <select id="category" name="category">${categories.map((item) => `<option ${item === category ? "selected" : ""}>${item}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field">
          <label for="body">내용</label>
          <textarea id="body" name="body" maxlength="1200" placeholder="문제라고 느낀 점을 구체적으로 적어 주세요." required>${escapeHtml(body)}</textarea>
          <div class="help">IP당 글은 최대 1개입니다. 서버에서 감정 검사를 통과해야 저장됩니다.</div>
        </div>
        <div class="actions">
          <button class="btn" type="submit" ${blockedUntil ? "disabled" : ""}>${submitText}</button>
          ${edit ? `<button class="btn secondary" type="button" data-action="cancel-edit">취소</button>` : ""}
        </div>
        <div id="notice" class="notice ${blockedUntil || state.message ? "show" : ""} ${state.messageType}">${escapeHtml(blockedUntil ? blockText(blockedUntil) : state.message)}</div>
      </form>
    </section>

    <section class="site-shell section">
      <div class="section-head"><h2>관리자 선정 의견</h2><p>최대 4개</p></div>
      <div class="posts-grid">${renderPosts(state.featured, true)}</div>
    </section>

    <section class="site-shell section">
      <div class="section-head"><h2>최근 등록된 문제 제기</h2><p>시간순 정렬</p></div>
      <div class="posts-grid">${renderPosts(state.posts, false)}</div>
    </section>
  `);
}

function renderPosts(posts, featuredOnly) {
  if (!posts.length) return `<div class="empty">아직 등록된 글이 없습니다.</div>`;
  return posts.map((post) => `
    <article class="post-card">
      <div class="post-top">
        <span class="badge">${escapeHtml(post.category || "기타")}</span>
        ${post.featured ? `<span class="badge">선정</span>` : ""}
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.body)}</p>
      <div class="meta">${formatDate(post.createdAt)}${post.updatedAt && post.updatedAt !== post.createdAt ? ` · 수정 ${formatDate(post.updatedAt)}` : ""}</div>
      ${post.canEdit && !featuredOnly ? `
        <div class="post-actions">
          <button class="btn secondary small" data-action="edit" data-id="${post.id}">수정</button>
          <button class="btn danger small" data-action="delete" data-id="${post.id}">삭제</button>
        </div>` : ""}
    </article>
  `).join("");
}

async function loadHome() {
  state.loading = true;
  try {
    const data = await api("/api/posts", { headers: { "x-owner-token": ownerToken() } });
    state.posts = data.posts || [];
    state.featured = data.featured || [];
  } catch (error) {
    state.message = error.message;
    state.messageType = "error";
  } finally {
    state.loading = false;
    app.innerHTML = homeTemplate();
  }
}

async function submitPost(event) {
  event.preventDefault();
  const blockedUntil = localBlockUntil();
  if (blockedUntil) {
    setMessage(blockText(blockedUntil), "error");
    return;
  }

  const form = new FormData(event.currentTarget);
  const payload = {
    title: form.get("title"),
    body: form.get("body"),
    category: form.get("category"),
    ownerToken: ownerToken(),
  };

  try {
    if (state.editing) {
      await api(`/api/posts/${state.editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      state.editing = null;
      state.message = "수정되었습니다.";
    } else {
      await api("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      state.message = "등록되었습니다.";
    }
    state.messageType = "ok";
    await loadHome();
  } catch (error) {
    setMessage(error.data?.blockedUntil ? blockText(error.data.blockedUntil) : error.message, "error");
  }
}

async function deleteOwnPost(id) {
  try {
    await api(`/api/posts/${id}`, { method: "DELETE", body: JSON.stringify({ ownerToken: ownerToken() }) });
    state.message = "삭제되었습니다.";
    state.messageType = "ok";
    await loadHome();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

function adminTemplate() {
  const session = adminSession();
  if (!session) {
    return layout(`
      <section class="site-shell login-box">
        <form class="admin-card" id="adminLoginForm">
          <div class="section-head"><h2>관리자 로그인</h2></div>
          <div class="field"><label>ID</label><input name="id" autocomplete="username" required /></div>
          <div class="field"><label>PW</label><input name="code" type="password" autocomplete="current-password" required /></div>
          <button class="btn" type="submit">로그인</button>
          <div id="notice" class="notice ${state.message ? "show" : ""} ${state.messageType}">${escapeHtml(state.message)}</div>
        </form>
      </section>
    `, "admin");
  }

  return layout(`
    <section class="site-shell admin-layout">
      <div class="section-head"><h2>관리자 페이지</h2><button class="btn secondary" data-action="logout">로그아웃</button></div>
      <div id="notice" class="notice ${state.message ? "show" : ""} ${state.messageType}">${escapeHtml(state.message)}</div>
      <article class="admin-card">
        <div class="section-head"><h2>등록 글 관리</h2><p>선정 글 최대 4개</p></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>시간</th><th>제목</th><th>분류</th><th>선정</th><th>관리</th></tr></thead>
            <tbody>${state.posts.map(adminPostRow).join("") || `<tr><td colspan="5">등록 글 없음</td></tr>`}</tbody>
          </table>
        </div>
      </article>
      <article class="admin-card">
        <div class="section-head"><h2>IP 차단 리스트</h2><p>시간순 정렬</p></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>IP</th><th>사유</th><th>시작</th><th>만료</th><th>관리</th></tr></thead>
            <tbody>${state.blocks.map(blockRow).join("") || `<tr><td colspan="5">차단된 IP 없음</td></tr>`}</tbody>
          </table>
        </div>
      </article>
    </section>
  `, "admin");
}

function adminPostRow(post) {
  return `
    <tr>
      <td>${formatDate(post.createdAt)}</td>
      <td><b>${escapeHtml(post.title)}</b><div class="help">${escapeHtml(post.body).slice(0, 110)}${post.body.length > 110 ? "…" : ""}</div></td>
      <td>${escapeHtml(post.category)}</td>
      <td>${post.featured ? "선정됨" : "-"}</td>
      <td><div class="admin-row-actions">
        <button class="btn small ${post.featured ? "secondary" : "ok"}" data-action="feature" data-id="${post.id}" data-featured="${post.featured ? "false" : "true"}">${post.featured ? "선정 해제" : "선정"}</button>
        <button class="btn danger small" data-action="admin-delete" data-id="${post.id}">삭제</button>
      </div></td>
    </tr>
  `;
}

function blockRow(block) {
  return `
    <tr>
      <td><b>${escapeHtml(block.ip)}</b><div class="help">${escapeHtml(block.maskedIp || "")}</div></td>
      <td>${escapeHtml(block.reason || "")}</td>
      <td>${formatDate(block.blockedAt)}</td>
      <td>${formatDate(block.blockedUntil)}</td>
      <td><button class="btn secondary small" data-action="unblock" data-ip="${escapeHtml(block.ip)}">해제</button></td>
    </tr>
  `;
}

async function loadAdmin() {
  if (!adminSession()) {
    app.innerHTML = adminTemplate();
    return;
  }
  try {
    const headers = { authorization: `Bearer ${adminSession()}`, "x-owner-token": ownerToken() };
    const [postsData, blocksData] = await Promise.all([
      api("/api/posts", { headers }),
      api("/api/admin/blocks", { headers }),
    ]);
    state.posts = postsData.posts || [];
    state.featured = postsData.featured || [];
    state.blocks = blocksData.blocks || [];
  } catch (error) {
    state.message = error.message;
    state.messageType = "error";
    if (error.status === 401) localStorage.removeItem(STORAGE.adminSession);
  }
  app.innerHTML = adminTemplate();
}

async function adminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/enter", {
      method: "POST",
      body: JSON.stringify({ id: form.get("id"), code: form.get("code") }),
    });
    localStorage.setItem(STORAGE.adminSession, data.value);
    state.message = "";
    await loadAdmin();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function adminAction(path, body, method = "POST") {
  return api(path, {
    method,
    headers: { authorization: `Bearer ${adminSession()}` },
    body: JSON.stringify(body || {}),
  });
}

async function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "cancel-edit") {
    state.editing = null;
    await loadHome();
  }
  if (action === "edit") {
    state.editing = state.posts.find((post) => post.id === button.dataset.id) || null;
    app.innerHTML = homeTemplate();
    document.querySelector("#write")?.scrollIntoView({ behavior: "smooth" });
  }
  if (action === "delete") await deleteOwnPost(button.dataset.id);
  if (action === "logout") {
    localStorage.removeItem(STORAGE.adminSession);
    state.message = "";
    await loadAdmin();
  }
  if (action === "feature") {
    try {
      await adminAction("/api/featured", { postId: button.dataset.id, featured: button.dataset.featured === "true" });
      await loadAdmin();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }
  if (action === "admin-delete") {
    try {
      await adminAction(`/api/posts/${button.dataset.id}`, {}, "DELETE");
      await loadAdmin();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }
  if (action === "unblock") {
    try {
      await adminAction("/api/admin/blocks", { ip: button.dataset.ip }, "DELETE");
      await loadAdmin();
    } catch (error) {
      setMessage(error.message, "error");
    }
  }
}

app.addEventListener("submit", (event) => {
  if (event.target.id === "postForm") submitPost(event);
  if (event.target.id === "adminLoginForm") adminLogin(event);
});
app.addEventListener("click", handleClick);

if (location.pathname.startsWith("/admin")) loadAdmin();
else loadHome();
