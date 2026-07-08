(() => {
  let queued = false;

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function style() {
    if (document.querySelector("#landing-patch-style")) return;
    const s = document.createElement("style");
    s.id = "landing-patch-style";
    s.textContent = `
      .edu-featured-comments { margin-bottom: 14px; display: grid; gap: 12px; }
      .edu-featured-title { font-weight: 950; color: #ffbd2e; }
      .edu-featured-comment { position: relative; background: #fffaf0; color: #16110d; border: 3px solid #11100f; padding: 14px 16px; box-shadow: 5px 5px 0 #ffbd2e; }
      .edu-featured-comment::after { content: ""; position: absolute; left: 22px; bottom: -13px; width: 18px; height: 18px; background: #fffaf0; border-right: 3px solid #11100f; border-bottom: 3px solid #11100f; transform: rotate(45deg); }
      .edu-featured-comment b { display: block; margin-bottom: 6px; }
      .edu-featured-comment span { display: block; color: #40352d; line-height: 1.55; font-weight: 700; }
      .edu-write-jump-wrap { margin-top: 18px; display: flex; justify-content: center; }
      .edu-write-jump { border: 3px solid #11100f; background: #ffbd2e; color: #11100f; box-shadow: 5px 5px 0 #11100f; padding: 12px 20px; font-weight: 950; cursor: pointer; }
    `;
    document.head.appendChild(s);
  }

  function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
  }

  function rewriteHero() {
    setText(document.querySelector(".manifesto h1"), "진도는 학원에서, 복습은 학교에서");
    setText(
      document.querySelector(".manifesto .lead"),
      "교실의 조용함은 모두가 이해했다는 뜻이 아니다. 이미 학원에서 배웠거나, 모른다고 말해도 수업이 멈추지 않는다는 사실을 배운 결과일 수 있다. 학교가 이해를 책임지지 않고 진도만 끝내는 순간, 교육은 공교육이 아니라 사교육 복습 시스템으로 변한다."
    );
  }

  function moveFeatured() {
    const host = document.querySelector(".hero-side") || document.querySelector(".manifesto");
    const voices = document.querySelector("#voices");
    const cards = [...document.querySelectorAll("#voices .post-card")].slice(0, 4);
    if (voices) voices.style.display = cards.length ? "none" : "";
    if (!host || !cards.length) return;

    let box = host.querySelector(".edu-featured-comments");
    if (!box) {
      box = document.createElement("div");
      box.className = "edu-featured-comments";
      host.insertBefore(box, host.firstChild);
    }

    const html = [`<div class="edu-featured-title">관리자 선정 댓글</div>`]
      .concat(cards.map((card) => {
        const title = card.querySelector("h3")?.textContent?.trim() || "선정 의견";
        const body = card.querySelector("p")?.textContent?.trim() || "";
        return `<div class="edu-featured-comment"><b>${esc(title)}</b><span>${esc(body.slice(0, 95))}${body.length > 95 ? "…" : ""}</span></div>`;
      }))
      .join("");

    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function addWriteJump() {
    const sections = [...document.querySelectorAll(".site-shell.section")];
    const recent = sections.reverse().find((section) => section.id !== "voices" && section.querySelector(".posts-grid"));
    if (!recent || recent.querySelector(".edu-write-jump-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "edu-write-jump-wrap";
    const button = document.createElement("button");
    button.className = "edu-write-jump";
    button.type = "button";
    button.textContent = "글 올리기";
    button.addEventListener("click", () => {
      document.querySelector("#write")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(button);
    recent.appendChild(wrap);
  }

  function apply() {
    if (location.pathname.startsWith("/admin")) return;
    style();
    rewriteHero();
    moveFeatured();
    addWriteJump();
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
