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

  if (data.blockedUntil) localStorage.setItem(STORAGE.blockedUntil, data.blockedUntil);
  if (!res.ok) throw Object.assign(new Error(data.error || "요청 실패"), { data, status: res.status });
  return data;
}

function layout(content, active = "home") {
  return `
    <header class="topbar">
      <div class="site-shell nav">
        <a class="logo" href="/"><span class="logo-mark">!</span><span>교육을 의심하라</span></a>
        <nav class="nav-links">
          <a class="nav-link ${active === "home" ? "active" : ""}" href="/#write">기록하기</a>
          <a class="nav-link" href="/#voices">증언 보기</a>
        </nav>
      </div>
    </header>
    ${content}
    <footer class="footer site-shell">순응하지 않는 기록이 교육을 바꾼다.</footer>
  `;
}

function homeTemplate() {
  const blockedUntil = localBlockUntil();
  const edit = state.editing;
  const title = edit ? edit.title : "";
  const body = edit ? edit.body : "";
  const category = edit ? edit.category : "사교육";
  const submitText = edit ? "수정 저장" : "증언 등록";

  return layout(`
    <section class="site-shell hero protest-hero">
      <div class="hero-card manifesto">
        <div class="kicker">EDUCATION IS NOT A RANKING MACHINE</div>
        <h1>아이들의 삶을 성적표로 압축하지 말라.</h1>
        <p class="lead">우리는 학교와 사교육이 만든 과열 경쟁, 침묵을 강요하는 교실, 진도만 밀어붙이는 수업, 체험학습을 위축시키는 책임 회피를 기록한다. 이것은 푸념이 아니라 구조에 대한 고발이다.</p>
        <div class="slogan-row">
          <span>주입식 교육 중단</span>
          <span>사교육 과열 해체</span>
          <span>학생 안전 우선</span>
        </div>
      </div>
      <div class="hero-side hero-card protest-board">
        <div class="point"><strong>성적은 인간의 가격표가 아니다</strong><span>학생을 등수와 점수로만 평가하는 문화는 배움이 아니라 분류다.</span></div>
        <div class="point"><strong>교실은 암기 공장이 아니다</strong><span>질문, 토론, 실패할 권리가 사라진 수업은 교육의 이름을 빌린 통제다.</span></div>
        <div class="point"><strong>사교육은 선택이 아니라 압박이 되었다</strong><span>불안을 팔아 경쟁을 키우는 구조를 더 이상 정상으로 부를 수 없다.</span></div>
      </div>
    </section>

    <section class="site-shell section indictment">
      <div class="section-head"><h2>우리가 규탄하는 구조</h2><p>서명보다 기록, 동원보다 증언</p></div>
      <div class="grid-4">
        <article class="stat-card"><b>01</b><p>입시 경쟁을 이유로 학생의 불안과 고통을 방치하는 학교 문화</p></article>
        <article class="stat-card"><b>02</b><p>공교육의 빈틈을 사교육 비용으로 메우게 만드는 불평등 구조</p></article>
        <article class="stat-card"><b>03</b><p>이해보다 속도, 사고보다 암기, 성장보다 진도를 우선하는 수업</p></article>
        <article class="stat-card"><b>04</b><p>현장 배움보다 민원과 책임 회피가 앞서 체험학습이 위축되는 현실</p></article>
      </div>
    </section>

    <section class="site-shell section" id="write">
      <div class="section-head"><h2>${edit ? "내 증언 수정" : "문제 구조 기록"}</h2><p>중립·부정으로 판별된 비판적 기록만 저장됩니다.</p></div>
      <form class="panel protest-form" id="postForm">
        <div class="form-grid">
          <div class="field">
            <label for="title">제목</label>
            <input id="title" name="title" value="${escapeHtml(title)}" maxlength="80" placeholder="예: 진도만 남고 배움은 사라진 교실" required />
          </div>
          <div class="field">
            <label for="category">분류</label>
            <select id="category" name="category">${categories.map((item) => `<option ${item === category ? "selected" : ""}>${item}</option>`).join("")}</select>
          </div>
        </div>
        <div class="field">
          <label for="body">내용</label>
          <textarea id="body" name="body" maxlength="1200" placeholder="불편했던 구조, 강요된 경쟁, 사교육 압박, 주입식 수업, 체험학습 위축 등을 구체적으로 기록해 주세요." required>${escapeHtml(body)}</textarea>
          <div class="help">IP당 글은 최대 1개입니다. 감정 검사는 프론트가 아니라 서버에서 수행됩니다.</div>
        </div>
        <div class="actions">
          <button class="btn" type="submit" ${blockedUntil ? "disabled" : ""}>${submitText}</button>
          ${edit ? `<button class="btn secondary" type="button" data-action="cancel-edit">취소</button>` : ""}
        </div>
        <div id="notice" class="notice ${blockedUntil || state.message ? "show" : ""} ${state.messageType}">${escapeHtml(blockedUntil ? blockText(blockedUntil) : state.message)}</div>
      </form>
    </section>

    <section class="site-shell section" id="voices">
      <div class="section-head"><h2>관리자 선정 증언</h2><p>최대 4개</p></div>
      <div class="posts-grid">${renderPosts(state.featured, true)}</div>
    </section>

    <section class="site-shell section">
      <div class="section-head"><h2>최근 기록</h2><p>시간순 정렬</p></div>
      <div class="posts-grid">${renderPosts(state.posts, false)}</div>
    </section>
  `);
}

function renderPosts(posts, featuredOnly) {
  if (!posts.length) return `<div class="empty">아직 등록된 기록이 없습니다.</div>`;
  return posts.map((post) => `
    <article class="post-card">
      <div class="post-top">
        <span class="badge">${escapeHtml(post.category || "기타")}</span>
        ${post.featured ? `<span class="badge badge-dark">선정 증언</span>` : ""}
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
  const formEl = event.target;
  const blockedUntil = localBlockUntil();

  if (blockedUntil) {
    setMessage(blockText(blockedUntil), "error");
    return;
  }

  if (!(formEl instanceof HTMLFormElement)) {
    setMessage("폼을 찾지 못했습니다. 페이지를 새로고침해 주세요.", "error");
    return;
  }

  const form = new FormData(formEl);
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
  const session = adminSession();

  if (!session) {
    app.innerHTML = adminTemplate();
    return;
  }

  const headers = {
    authorization: `Bearer ${session}`,
    "x-owner-token": ownerToken(),
  };

  state.posts = [];
  state.featured = [];
  state.blocks = [];

  try {
    const postsData = await api("/api/posts", { headers });
    state.posts = postsData.posts || [];
    state.featured = postsData.featured || [];
  } catch (error) {
    state.message = `글 목록을 불러오지 못했습니다: ${error.message}`;
    state.messageType = "error";

    if (error.status === 401) {
      localStorage.removeItem(STORAGE.adminSession);
      app.innerHTML = adminTemplate();
      return;
    }
  }

  try {
    const blocksData = await api("/api/admin/blocks", { headers });
    state.blocks = blocksData.blocks || [];
  } catch (error) {
    state.message = `로그인은 되었지만 IP 차단 목록을 불러오지 못했습니다: ${error.message}`;
    state.messageType = "error";
  }

  app.innerHTML = adminTemplate();
}

async function adminLogin(event) {
  event.preventDefault();

  const formEl = event.target;

  if (!(formEl instanceof HTMLFormElement)) {
    setMessage("폼을 찾지 못했습니다. 페이지를 새로고침해 주세요.", "error");
    return;
  }

  const form = new FormData(formEl);

  try {
    const data = await api("/api/enter", {
      method: "POST",
      body: JSON.stringify({
        id: form.get("id"),
        code: form.get("code"),
      }),
    });

    const token = data.value || data.token || data.session;

    if (!data.ok || !token) {
      throw new Error("로그인 토큰을 받지 못했습니다.");
    }

    localStorage.setItem(STORAGE.adminSession, token);
    state.message = "";
    state.messageType = "";

    app.innerHTML = adminTemplate();

    await loadAdmin();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

async function adminAction(path, body, method = "POST") {
  const session = adminSession();

  return api(path, {
    method,
    headers: {
      authorization: `Bearer ${session}`,
    },
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

  if (action === "delete") {
    await deleteOwnPost(button.dataset.id);
  }

  if (action === "logout") {
    localStorage.removeItem(STORAGE.adminSession);
    state.message = "";
    await loadAdmin();
  }

  if (action === "feature") {
    try {
      await adminAction("/api/featured", {
        postId: button.dataset.id,
        featured: button.dataset.featured === "true",
      });
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

document.addEventListener("submit", (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement)) return;

  if (form.id === "postForm") {
    submitPost(event);
    return;
  }

  if (form.id === "adminLoginForm") {
    adminLogin(event);
    return;
  }
}, true);

document.addEventListener("click", (event) => {
  const loginButton = event.target.closest?.("#adminLoginForm button[type='submit'], #adminLoginForm button:not([type])");

  if (loginButton) {
    const form = loginButton.closest("form");

    if (form?.id === "adminLoginForm") {
      event.preventDefault();

      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }

      return;
    }
  }

  handleClick(event);
}, true);

if (location.pathname.startsWith("/admin")) loadAdmin();
else loadHome();
