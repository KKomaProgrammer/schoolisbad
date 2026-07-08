(() => {
  if (location.pathname.startsWith("/admin")) return;

  function html() {
    return `
      <div class="scroll-progress" aria-hidden="true"></div>
      <header class="site-header" aria-label="상단 메뉴">
        <a class="brand" href="#top" aria-label="처음으로 이동"><span class="brand-mark">!</span><span>교육을 다시 학교로</span></a>
        <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">메뉴</button>
        <nav id="site-nav" class="site-nav" aria-label="주요 메뉴">
          <a href="#problem">문제</a>
          <a href="#evidence">근거</a>
          <a href="#demands">요구</a>
          <a href="#write">의견</a>
          <a href="#sources">출처</a>
        </nav>
      </header>
      <main id="top" class="ref-design">
        <section class="hero section-pad">
          <div class="hero-copy reveal is-visible">
            <p class="eyebrow">대한민국 교육 비판 프로젝트</p>
            <h1><span>진도는 학원에서,</span><span>복습은 학교에서</span></h1>
            <p class="hero-lead">선생님의 “다 이해했지? 넘어간다”라는 말에 교실은 조용하다. 그러나 그 침묵은 이해의 증거가 아니다. 이미 학원에서 배운 학생은 버티고, 배우지 못한 학생은 조용히 뒤처진다.</p>
            <div class="hero-actions" aria-label="페이지 이동 버튼">
              <a class="button primary" href="#problem">문제 보기</a>
              <a class="button ghost" href="#demands">우리가 요구하는 것</a>
              <a class="button ghost" href="#write">의견 등록</a>
            </div>
          </div>
          <div class="poster-stack reveal is-visible" aria-label="핵심 구호">
            <div class="poster poster-main"><span>NO MORE</span><strong>진도 폭주</strong></div>
            <div class="poster poster-sub left">이해 없는 진도는 교육이 아니다</div>
            <div class="poster poster-sub right">사교육 없이는 굴러가지 않는 학교</div>
          </div>
        </section>

        <section class="chant-bar" aria-label="구호">
          <span>묻지 않는 수업</span><span>책임 없는 학교</span><span>불안을 파는 사교육</span><span>학생 탓으로 끝나는 실패</span>
        </section>

        <section class="section-pad intro-section">
          <div class="intro-card reveal">
            <p class="label">문제 제기</p>
            <blockquote>“다 이해했지?”라는 질문은 확인이 아니라 정해진 순서가 되어 버렸다.</blockquote>
            <p>학교가 학생의 이해를 확인하고 회복시키는 곳이 아니라, 이미 학원에서 배운 내용을 빠르게 지나가는 곳이 된다면 공교육은 더 이상 출발선이 아니다. 그것은 사교육을 받은 학생만 통과할 수 있는 검문소가 된다.</p>
          </div>
        </section>

        <section id="problem" class="section-pad problem-section">
          <div class="section-heading reveal">
            <p class="eyebrow">핵심 비판</p>
            <h2>교실은 평화로워 보이지만, 그 안에서는 격차가 조용히 커진다.</h2>
          </div>
          <div class="problem-grid">
            <article class="problem-card reveal"><span class="number">01</span><h3>진도표가 학생보다 앞선다</h3><p>수업은 정해진 페이지와 시험 범위에 맞춰 달린다. 이해하지 못한 학생은 멈춰 세워지지 않고, 조용히 뒤로 밀려난다. 문제는 학생의 속도가 느린 것이 아니라, 학교가 이해의 속도를 기다리지 않는다는 점이다.</p></article>
            <article class="problem-card reveal"><span class="number">02</span><h3>학교가 학원 선행학습을 전제로 움직인다</h3><p>일부 수업과 평가는 학생이 이미 알고 왔다고 가정한다. 이때 학교는 가르치는 기관이 아니라 확인하는 기관이 된다. 학원을 다닌 학생은 복습하고, 다니지 못한 학생은 처음부터 따라잡기 어려운 구조에 놓인다.</p></article>
            <article class="problem-card reveal"><span class="number">03</span><h3>실패의 책임이 학생에게만 돌아간다</h3><p>성적이 떨어지면 “노력이 부족했다”는 말이 먼저 나온다. 그러나 모든 학생이 같은 출발선에 서 있지 않은데, 결과만 개인 책임으로 돌리는 것은 교육의 책임 회피다.</p></article>
          </div>
        </section>

        <section id="evidence" class="section-pad evidence-section">
          <div class="section-heading reveal">
            <p class="eyebrow">숫자로 드러나는 현실</p>
            <h2>사교육은 보조가 아니라, 학교 수업을 버티게 하는 기둥이 되어가고 있다.</h2>
            <p>아래 수치는 2025년 말 전국 초·중·고 수학교육 인식 설문조사를 보도한 교육플러스 기사와 EBS 인터뷰 내용을 바탕으로 정리했다.</p>
          </div>
          <div class="stat-grid" aria-label="교육 문제 통계">
            <article class="ref-stat-card reveal"><strong><span class="counter" data-count="40.0">0</span>%</strong><span>고2 수포자 비율</span><p>고등학교 2학년 10명 중 4명이 스스로 수학을 포기했다고 응답했다.</p></article>
            <article class="ref-stat-card reveal"><strong><span class="counter" data-count="64.7">0</span>%</strong><span>수학 사교육 수강</span><p>조사 대상 학생의 절반을 훌쩍 넘는 비율이 수학 사교육을 받고 있었다.</p></article>
            <article class="ref-stat-card reveal"><strong><span class="counter" data-count="85.9">0</span>%</strong><span>사교육생 선행학습 경험</span><p>수학 사교육을 받는 학생 대부분이 학교 진도보다 앞서 배우는 구조에 놓여 있었다.</p></article>
            <article class="ref-stat-card reveal"><strong><span class="counter" data-count="60.2">0</span>%</strong><span>교사도 사교육 필요성 인정</span><p>학교 수학 수업 이해를 위해 사교육이 필요하다는 교사 응답이 과반을 넘었다.</p></article>
          </div>
        </section>

        <section class="section-pad chain-section">
          <div class="section-heading reveal"><p class="eyebrow">악순환</p><h2>한 번 밀리면, 다시 올라오기 어려운 구조</h2></div>
          <ol class="chain-list reveal">
            <li><span>01</span><strong>상대평가와 경쟁</strong><p>점수 차이를 만들기 위해 문제는 어려워지고, 불안은 커진다.</p></li>
            <li><span>02</span><strong>선행학습 압박</strong><p>남보다 먼저 배워야 한다는 압박이 사교육 의존을 키운다.</p></li>
            <li><span>03</span><strong>학교의 진도 중심 수업</strong><p>학교는 기초를 세우기보다 정해진 범위를 끝내는 데 집중한다.</p></li>
            <li><span>04</span><strong>이해 격차 확대</strong><p>학원에 의존할 수 없는 학생은 수업 안에서 점점 보이지 않게 된다.</p></li>
            <li><span>05</span><strong>실패의 개인화</strong><p>구조의 문제는 사라지고, 학생의 노력 부족이라는 말만 남는다.</p></li>
          </ol>
        </section>

        <section class="section-pad quote-section">
          <div class="quote-wall reveal">
            <p class="label">현장의 말</p><h2>“학원에서 배운 걸 테스트하는 기관”</h2>
            <p>EBS 인터뷰에서 정승제는 일부 학군지·자사고의 과도한 시험과 빠른 진도를 비판하며, 학교가 학원에서 배운 내용을 확인하는 곳처럼 변질됐다고 지적했다.</p>
            <p>윤혜정 역시 선행학습 없이 입학한 학생이 모든 책임을 자기 몫처럼 떠안는 구조를 보며 미안함을 느꼈다고 말했다. 이 말들은 한 학생의 불평이 아니라, 공교육이 스스로 던져야 할 질문이다.</p>
          </div>
        </section>

        <section id="demands" class="section-pad demands-section">
          <div class="section-heading reveal"><p class="eyebrow">요구</p><h2>학교는 다시 “처음 배우는 곳”이 되어야 한다.</h2></div>
          <div class="demand-grid">
            <article class="demand-card reveal"><h3>1. 진도보다 이해</h3><p>수업은 끝낸 페이지 수가 아니라, 학생이 실제로 이해한 정도로 평가되어야 한다.</p></article>
            <article class="demand-card reveal"><h3>2. 선행 전제 수업 금지</h3><p>학교 수업과 시험은 학원 선행학습을 받은 학생에게만 유리하게 설계되어서는 안 된다.</p></article>
            <article class="demand-card reveal"><h3>3. 학습 결손 회복 시스템</h3><p>뒤처진 학생을 방치하지 않고, 기초부터 다시 연결하는 보충·소그룹 수업이 필요하다.</p></article>
            <article class="demand-card reveal"><h3>4. 실패를 학생 탓으로 끝내지 않기</h3><p>성적 하락은 개인의 의지 문제만이 아니다. 교육과정, 평가, 수업 방식의 책임을 함께 물어야 한다.</p></article>
          </div>
        </section>

        <section class="section-pad closing-section">
          <div class="closing-card reveal"><p class="eyebrow">결론</p><h2>부유함이 곧 성적이 되는 나라,<br>이 비극을 지금 즉시 멈춰야 합니다</h2><p>진도는 학원이 나가고, 학교는 복습도 제대로 책임지지 못하는 현실은 공교육의 실패를 보여준다. 학원이 없으면 수업이 흔들리고, 학생의 실패가 개인 탓으로만 남는다면 대한민국 교육의 미래는 어두워진다.</p><p>학교는 모든 학생이 처음 배워도 따라갈 수 있는 곳이어야 한다. 교육은 속도 경쟁이 아니라 이해를 회복하는 과정이어야 한다.</p></div>
        </section>

        <section id="sources" class="section-pad source-section">
          <div class="section-heading reveal"><p class="eyebrow">출처</p><h2>확인한 자료</h2></div>
          <div class="source-list reveal">
            <a href="https://www.edpl.co.kr/news/articleView.html?idxno=19369" target="_blank" rel="noopener noreferrer">교육플러스, “‘수포자’ 4년 만에 10% 폭증… 고2 10명 중 4명 수학 포기”, 2026.01.27</a>
            <a href="https://www.sisain.co.kr/news/articleView.html?idxno=21473" target="_blank" rel="noopener noreferrer">시사IN, “‘실험실 쥐’ 세대의 탄생”, 2014.10.21</a>
            <a href="https://about.ebs.co.kr/board/bbs?boardId=31&boardTypeId=1&cmd=view&no=7&option=&pageNo=21&postId=30004512320&searchCondition=title&searchKeyword=" target="_blank" rel="noopener noreferrer">EBS, “정승제, 윤혜정, 봉태규가 목격한 우리 아이들의 마음”, 2025.10.06</a>
          </div>
        </section>
      </main>
    `;
  }

  function mount() {
    const app = document.querySelector("#app");
    if (!app || document.querySelector(".ref-design")) return;
    const write = document.querySelector("#write");
    if (!write) return;
    document.body.classList.add("reference-main");
    const host = document.createElement("div");
    host.innerHTML = html();
    document.body.insertBefore(host, app);
  }

  function updateProgress() {
    const bar = document.querySelector(".scroll-progress");
    if (!bar) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const pct = max > 0 ? (scrollY / max) * 100 : 0;
    bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function bindMenu() {
    const btn = document.querySelector(".menu-button");
    const nav = document.querySelector("#site-nav");
    if (!btn || !nav || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  function reveal() {
    const els = document.querySelectorAll(".ref-design .reveal");
    const vh = innerHeight || 800;
    els.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh * .88) el.classList.add("is-visible");
    });
  }

  function counters() {
    document.querySelectorAll(".counter").forEach(el => {
      if (el.dataset.done === "1") return;
      const rect = el.getBoundingClientRect();
      if (rect.top > innerHeight * .9) return;
      el.dataset.done = "1";
      const target = Number(el.dataset.count || 0);
      const start = performance.now();
      const step = now => {
        const p = Math.min(1, (now - start) / 900);
        const value = target * (1 - Math.pow(1 - p, 3));
        el.textContent = target % 1 ? value.toFixed(1) : Math.round(value);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function apply() {
    mount();
    bindMenu();
    updateProgress();
    reveal();
    counters();
  }

  addEventListener("scroll", apply, { passive: true });
  addEventListener("resize", apply);
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true });
})();
