import {
  addMinutes,
  addToIndex,
  cleanText,
  getClientIp,
  getIndex,
  getJson,
  getKV,
  isFuture,
  json,
  maskIp,
  nowIso,
  putJson,
  randomId,
  readJson,
  removeFromIndex,
  sha256,
  sortByNewest,
  verifyAdmin,
} from "../lib/common.js";
import { analyzeSentiment } from "../lib/sentiment.js";

export const PASS_SENTIMENT_LABELS = ["negative"];
export const MAX_FAILED_SENTIMENT_COUNT = 5;
export const BLOCK_MINUTES = 40;
export const MAX_PUBLIC_POSTS = 100;

const POSTS_INDEX_KEY = "posts:index";
const BLOCKS_INDEX_KEY = "blocks:index";

const POLITICAL_PATTERNS = [
  { key: "party", re: /정당|여당|야당|보수|진보|좌파|우파|국민의힘|민주당|정치세력|당대표/g },
  { key: "election", re: /선거|대선|총선|지방선거|투표|공천|후보|유세/g },
  { key: "office", re: /대통령|국회의원|장관|시장|도지사|정부|국회|청와대|용산/g },
  { key: "conflict", re: /탄핵|특검|검찰|정권|정쟁|정치공방/g },
];

function normalizedText(text) {
  return String(text || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function detectPoliticalTopic(text) {
  const body = normalizedText(text);
  for (const item of POLITICAL_PATTERNS) {
    item.re.lastIndex = 0;
    if (item.re.test(body)) return item.key;
  }
  return "";
}

function politicalMessage(kind) {
  const messages = {
    party: [
      "여긴 정당 응원석이 아니라 교육 비판 게시판이에요. 당 색깔은 잠시 가방에 넣고 와주세요.",
      "정당 배틀은 다른 경기장으로! 여기서는 학교와 사교육 문제만 다룹니다.",
    ],
    election: [
      "투표함은 잠시 닫고, 교실 이야기부터 해주세요. 선거 이야기는 등록되지 않습니다.",
      "선거 유세차가 게시판 앞을 지나갔습니다. 교육 문제로 다시 써주세요.",
    ],
    office: [
      "정치 뉴스룸으로 연결될 뻔했어요. 여긴 학교·사교육 문제 전용 게시판입니다.",
      "정부·국회 이야기는 잠시 내려놓고, 교실과 학원 이야기로 돌아와 주세요.",
    ],
    conflict: [
      "정쟁 드럼 소리가 너무 큽니다. 이 게시판은 교육 문제만 받습니다.",
      "정치 공방은 차단! 학교 수업, 사교육, 입시 문제로 다시 적어주세요.",
    ],
  };
  const list = messages[kind] || ["정치 주제는 이 게시판의 과목이 아닙니다. 교육 문제로 다시 작성해 주세요."];
  return list[Math.floor(Math.random() * list.length)];
}

function friendlyDate(value) {
  try {
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return String(value || "잠시 뒤");
  }
}

function sentimentMessage(title, body, sentiment) {
  const text = `${title} ${body}`;
  const compact = text.replace(/\s+/g, "");
  const matched = Array.isArray(sentiment?.matchedTerms) ? sentiment.matchedTerms.map((x) => String(x?.[0] || "")).join(" ") : "";

  if (/재미없|재밌지않|안재밌|안재미/.test(compact) || /재미없음/.test(matched)) {
    return "재미없다는 마음은 접수됐지만, 교육 문제 비판으로 조금만 더 구체화해 주세요. 게시판 심사위원이 팝콘 들고 기다립니다.";
  }
  if (/학원|사교육|선행/.test(text)) {
    return "학원 이야기는 좋은데, 아직 비판의 칼날이 무뎌요. 사교육 의존 문제가 드러나게 한 번 더 찔러주세요.";
  }
  if (/학교|교실|선생|수업|진도/.test(text)) {
    return "학교 이야기는 맞는데, 지금 문장은 아직 종이비행기 수준이에요. 진도·수업·책임 문제를 더 분명히 써주세요.";
  }
  if (/입시|성적|시험|수능|내신/.test(text)) {
    return "입시 이야기는 감지됐지만 비판 신호가 약합니다. 점수 경쟁의 문제를 더 또렷하게 적어주세요.";
  }
  if (/체험학습|현장학습|수학여행/.test(text)) {
    return "체험학습 이야기는 보였는데, 왜 문제인지가 살짝 숨었습니다. 행정 부담이나 책임 회피를 더 콕 집어주세요.";
  }
  if (sentiment?.label === "positive") {
    return "칭찬 버튼을 누르려다 길을 잃었습니다. 이곳은 교육 문제 비판 게시판이라 부정 의견만 등록됩니다.";
  }
  return "비판 에너지가 아직 충전 중입니다. 학교·사교육·입시 문제를 더 구체적으로 적어주세요.";
}

async function readPost(kv, id) {
  return await getJson(kv, `post:${id}`, null);
}

async function publicPost(post, ownerHash, isAdmin) {
  const item = {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    featured: Boolean(post.featured),
    featuredAt: post.featuredAt || null,
    canEdit: Boolean(isAdmin || (ownerHash && ownerHash === post.ownerHash)),
  };
  if (isAdmin) {
    item.ip = post.ip || "";
    item.maskedIp = post.maskedIp || maskIp(post.ip || "");
  }
  return item;
}

async function listPosts(kv, request, env) {
  const index = await getIndex(kv, POSTS_INDEX_KEY);
  const ownerToken = request.headers.get("x-owner-token") || "";
  const ownerHash = ownerToken ? await sha256(ownerToken) : "";
  const isAdmin = await verifyAdmin(request, env);
  const posts = [];

  for (const id of index.slice(0, MAX_PUBLIC_POSTS * 2)) {
    const post = await readPost(kv, id);
    if (post && !post.deletedAt) posts.push(await publicPost(post, ownerHash, isAdmin));
  }

  const sorted = sortByNewest(posts).slice(0, MAX_PUBLIC_POSTS);
  const featured = sorted
    .filter((post) => post.featured)
    .sort((a, b) => new Date(b.featuredAt || b.createdAt) - new Date(a.featuredAt || a.createdAt))
    .slice(0, 4);

  return { posts: sorted, featured };
}

async function getActiveBlock(kv, ip) {
  const block = await getJson(kv, `block:${ip}`, null);
  if (!block) return null;
  if (isFuture(block.blockedUntil)) return block;
  await kv.delete(`block:${ip}`);
  await removeFromIndex(kv, BLOCKS_INDEX_KEY, ip);
  return null;
}

async function recordFailedSentiment(kv, ip, sentiment) {
  const key = `fail:${ip}`;
  const current = await getJson(kv, key, { count: 0 });
  const next = {
    count: Number(current.count || 0) + 1,
    lastFailedAt: nowIso(),
    lastSentiment: sentiment,
  };

  await putJson(kv, key, next, { expirationTtl: 60 * 60 });

  if (next.count >= MAX_FAILED_SENTIMENT_COUNT) {
    const blockedUntil = addMinutes(new Date(), BLOCK_MINUTES);
    const block = {
      ip,
      maskedIp: maskIp(ip),
      reason: "감정 검사 5회 미통과",
      failCount: next.count,
      blockedAt: nowIso(),
      blockedUntil,
      lastSentiment: sentiment,
    };
    await putJson(kv, `block:${ip}`, block, { expirationTtl: BLOCK_MINUTES * 60 + 3600 });
    await addToIndex(kv, BLOCKS_INDEX_KEY, ip);
    return block;
  }

  return null;
}

export async function onRequestGet({ request, env }) {
  try {
    const kv = getKV(env);
    return json(await listPosts(kv, request, env));
  } catch (error) {
    return json({ error: error.message || "목록을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const kv = getKV(env);
    const ip = getClientIp(request);
    const activeBlock = await getActiveBlock(kv, ip);

    if (activeBlock) {
      return json({
        error: `앗, 아직 쉬는 시간입니다. ${friendlyDate(activeBlock.blockedUntil)} 이후 다시 도전해 주세요.`,
        blocked: true,
        blockedUntil: activeBlock.blockedUntil,
      }, 429);
    }

    const data = await readJson(request);
    const title = cleanText(data.title, 80);
    const body = cleanText(data.body, 1200);
    const category = cleanText(data.category || "기타", 30);
    const ownerToken = cleanText(data.ownerToken, 200);

    if (!ownerToken) return json({ error: "기기 식별 토큰이 없습니다. 페이지를 새로고침해 주세요." }, 400);
    if (title.length < 2) return json({ error: "제목은 2자 이상 입력해 주세요." }, 400);
    if (body.length < 10) return json({ error: "내용은 10자 이상 입력해 주세요." }, 400);

    const politicalKind = detectPoliticalTopic(`${title}\n${body}`);
    if (politicalKind) {
      return json({ error: politicalMessage(politicalKind), blocked: true, blockType: "political" }, 422);
    }

    const existingPostId = await kv.get(`ip-post:${ip}`);
    if (existingPostId) {
      const existing = await readPost(kv, existingPostId);
      if (existing && !existing.deletedAt) {
        return json({ error: "IP당 글은 최대 1개만 등록할 수 있습니다. 기존 글을 수정하거나 삭제해 주세요." }, 409);
      }
      await kv.delete(`ip-post:${ip}`);
    }

    const sentiment = await analyzeSentiment(`${title}\n${body}`, env);
    if (!PASS_SENTIMENT_LABELS.includes(sentiment.label)) {
      const newBlock = await recordFailedSentiment(kv, ip, sentiment);
      if (newBlock) {
        return json({
          error: "비판 신호를 다섯 번 놓쳤습니다. 게시판 심판이 40분 작전타임을 선언했어요.",
          blocked: true,
          blockedUntil: newBlock.blockedUntil,
          sentiment,
        }, 429);
      }
      return json({
        error: sentimentMessage(title, body, sentiment),
        sentiment,
      }, 422);
    }

    const id = randomId("post");
    const ownerHash = await sha256(ownerToken);
    const post = {
      id,
      title,
      body,
      category,
      ownerHash,
      ip,
      maskedIp: maskIp(ip),
      sentiment,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      featured: false,
    };

    await putJson(kv, `post:${id}`, post);
    await addToIndex(kv, POSTS_INDEX_KEY, id);
    await kv.put(`ip-post:${ip}`, id);
    await kv.delete(`fail:${ip}`);

    return json({ ok: true, post: await publicPost(post, ownerHash, false) }, 201);
  } catch (error) {
    return json({ error: error.message || "등록하지 못했습니다." }, 500);
  }
}
