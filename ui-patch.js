(() => {
  const once = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));

  function replaceText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);

    for (const node of list) {
      let text = node.nodeValue;
      text = text.replaceAll("증언", "의견");
      text = text.replaceAll("시간순 정렬", "");
      text = text.replaceAll("중립·부정으로 판별된 비판적 기록만 저장됩니다.", "부정 의견만 저장됩니다.");
      text = text.replaceAll("문장이 중립 또는 부정으로 판별될 때만 등록됩니다.", "부정 의견만 등록됩니다.");
      text = text.replaceAll("감정 검사는 프론트가 아니라 서버에서 수행됩니다.", "");
      text = text.replaceAll("아직 등록된 기록이 없습니다.", "아직 등록된 의견이 없습니다.");
      text = text.replaceAll("최근 기록", "최근 의견");
      text = text.replaceAll("기록만", "의견만");
      node.nodeValue = text;
    }
  }

  function rewriteIndictment() {
    const section = document.querySelector(".indictment");
    const grid = section?.querySelector(".grid-4");
    if (!grid || grid.dataset.rewritten === "1") return;
    grid.dataset.rewritten = "1";
    grid.innerHTML = `
      <article class="stat-card"><b>01</b><p>입시 경쟁을 이유로 학생의 불안과 고통을 개인 책임으로 돌리는 학교 문화를 규탄한다.</p></article>
      <article class="stat-card"><b>02</b><p>공교육의 빈틈을 사교육 비용으로 메우게 만들고, 가정 형편에 따라 출발선을 갈라놓는 구조를 규탄한다.</p></article>
      <article class="stat-card"><b>03</b><p>이해보다 속도, 사고보다 암기, 성장보다 진도를 우선하며 학생을 질문 없는 수험 기계로 만드는 수업을 규탄한다.</p></article>
      <article class="stat-card"><b>04</b><p>현장 배움과 체험학습을 행정 부담과 책임 회피 뒤로 밀어내는 분위기를 규탄한다.</p></article>
      <article class="stat-card"><b>05</b><p>학생의 마음 건강보다 성적표와 순위를 앞세우는 태도를 규탄한다.</p></article>
      <article class="stat-card"><b>06</b><p>학교가 보호의 공간이 아니라 경쟁 적응을 요구하는 공간으로 변해 가는 현실을 규탄한다.</p></article>
    `;
  }

  function apply() {
    replaceText();
    rewriteIndictment();
  }

  once(apply);
  new MutationObserver(() => once(apply)).observe(document.documentElement, { childList: true, subtree: true });
})();
