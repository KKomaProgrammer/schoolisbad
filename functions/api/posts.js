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
import { detectBannedPolitician } from "../lib/banned-politicians.js";
import { cleanPoliticianName, detectCustomPolitician, loadPoliticianRules, messageForPoliticianRule } from "../lib/politician-rules.js";

export const PASS_SENTIMENT_LABELS = ["negative"];
export const MAX_FAILED_SENTIMENT_COUNT = 5;
export const BLOCK_MINUTES = 40;
export const MAX_PUBLIC_POSTS = 100;

const POSTS_INDEX_KEY = "posts:index";
const BLOCKS_INDEX_KEY = "blocks:index";
const SITE_SETTINGS_KEY = "site:settings";
const DEFAULT_MAX_POSTS_PER_IP = 1;

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

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function politicalMessage(kind) {
  const messages = {
    party: ["정당 응원봉이 흔들렸습니다. 이 게시판은 학교·사교육 문제 전용이라 당 색깔은 잠시 사물함에 넣어주세요.", "정당 배틀은 다른 경기장으로! 여기서는 학원 선행과 학교 진도 문제만 경기합니다."],
    election: ["선거 유세차가 교문 앞에서 유턴했습니다. 후보 이야기 말고 교실 이야기를 적어주세요.", "투표함은 잠시 닫겠습니다. 이 글은 선거 과목으로 분류되어 등록되지 않았습니다."],
    office: ["정부·국회 단어가 교실 창문으로 들어왔습니다. 여긴 교육 문제 게시판이라 정치 뉴스는 조용히 퇴장합니다.", "정치 뉴스룸으로 순간이동하려다 붙잡혔습니다. 학교·학원·입시 문제로 다시 작성해 주세요."],
    conflict: ["정쟁 드럼 소리가 너무 큽니다. 이 게시판은 교육 문제만 받습니다.", "정치 공방은 파울! 학교 수업, 사교육, 입시 문제로 다시 플레이해 주세요."],
  };
  return pick(messages[kind] || ["정치 주제는 오늘 결석 처리됐습니다. 교육 문제로 다시 작성해 주세요."]);
}

function defaultPoliticianMessage(hit, label) {
  const name = String(hit?.name || "정치인");
  const type = hit?.type === "initial" ? "초성 소환술" : "정치인 이름 소환";
  const messages = {
    positive: [`${name} 님 칭찬이 감지됐습니다. 박수는 정치 뉴스룸으로, 여기는 교육 비판 게시판으로 보내주세요.`, `${type}로 ${name} 님을 응원하려다 걸렸습니다. 학교·사교육 문제로 다시 작성해 주세요.`],
    neutral: [`${name} 님 이야기가 중립 포장지에 싸여 들어왔습니다. 정치인은 잠시 퇴장, 교육 문제만 입장 가능합니다.`, `${type}이 감지됐습니다. 이 게시판은 국회 방청석이 아니라 학교·사교육 비판 게시판입니다.`],
    negative: [`${name} 님 비판도 정치 주제라 등록되지 않습니다. 교육 문제 비판만 플레이 온입니다.`, `게시판 심판이 휘슬을 불었습니다. ${name} 님 소환은 파울, 학교·학원·입시 문제로 다시 써주세요.`],
  };
  const key = label === "positive" || label === "negative" ? label : "neutral";
  return pick(messages[key]);
}

function friendlyDate(value) {
  try {
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return String(value || "잠시 뒤");
  }
}

function remainingMinutes(until) {
  const ms = new Date(until).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 60000));
}

function blockLimitMessage(minutes, until) {
  return `등록이 <b>${minutes}분</b>동안 제한됩니다. ${friendlyDate(until)} 이후 다시 시도해 주세요.`;
}

function topicOf(text) {
  if (/학원|사교육|선행/.test(text)) return "academy";
  if (/학교|교실|선생|교사|수업|진도/.test(text)) return "school";
  if (/입시|성적|시험|수능|내신/.test(text)) return "exam";
  if (/체험학습|현장학습|수학여행/.test(text)) return "field";
  if (/수학|수포자/.test(text)) return "math";
  return "general";
}

function positiveMessage(title, body) {
  const text = `${title} ${body}`;
  const topic = topicOf(text);
  const messages = {
    academy: ["학원 칭찬이 너무 반짝입니다. 이곳은 사교육 광고판이 아니라 사교육 의존 문제를 비판하는 게시판이에요.", "학원이 주인공이 되었습니다. 학원 덕분에 좋았다는 말보다, 왜 학교가 학원에 기대게 됐는지를 적어주세요."],
    school: ["학교가 너무 모범생처럼 칭찬받고 있습니다. 이 게시판은 학교의 진도 중심 수업과 책임 회피를 비판하는 곳이에요.", "교실 칭찬 종이비행기가 날아왔습니다. 하지만 여기서는 ‘다 이해했지?’ 뒤의 침묵 같은 문제를 적어주세요."],
    exam: ["입시와 성적을 긍정하는 분위기가 감지됐습니다. 이곳은 점수 경쟁의 문제를 말하는 게시판입니다.", "시험 점수 응원가는 잠시 정지! 성적 중심 구조가 왜 문제인지로 다시 작성해 주세요."],
    field: ["체험학습이 좋아요로 끝났습니다. 여기서는 체험학습이 왜 위축되는지, 어떤 구조가 문제인지가 필요합니다.", "현장학습 소풍 모드가 켜졌습니다. 행정 부담과 책임 회피 문제까지 데려와 주세요."],
    math: ["수학이 괜찮다는 분위기가 감지됐습니다. 수포자가 생기는 구조 비판으로 방향을 틀어주세요.", "수학 칭찬은 통과하지 못했습니다. 진도와 선행 때문에 포기자가 생기는 문제를 적어주세요."],
    general: ["칭찬 버튼을 누르려다 길을 잃었습니다. 이곳은 교육 문제 비판 게시판이라 긍정 글은 등록되지 않습니다.", "분위기가 너무 훈훈합니다. 여기는 박수보다 문제 제기가 필요한 게시판입니다."],
  };
  return pick(messages[topic] || messages.general);
}

function neutralMessage(title, body, sentiment) {
  const text = `${title} ${body}`;
  const topic = topicOf(text);
  const matched = Array.isArray(sentiment?.matchedTerms) ? sentiment.matchedTerms.map((x) => String(x?.[0] || "")).join(" ") : "";
  if (/재미없|재밌지않|안재밌|안재미/.test(text.replace(/\s+/g, "")) || /재미없음/.test(matched)) return "재미없다는 신호는 잡혔지만 비판 문장이 아직 짧습니다. 왜 재미없고, 그게 학교·사교육 구조와 어떻게 연결되는지 더 적어주세요.";
  const messages = {
    academy: ["학원 이야기는 보였지만 아직 설명문 모드입니다. 사교육 의존이 왜 문제인지 더 날카롭게 적어주세요.", "학원 키워드는 입장했지만 비판은 지각했습니다. 선행학습 의존 문제를 더 분명히 써주세요."],
    school: ["학교 이야기는 맞는데 아직 회의록처럼 중립적입니다. 진도, 수업, 책임 문제를 비판 문장으로 바꿔주세요.", "교실은 등장했지만 문제 제기가 약합니다. ‘다 이해했지?’ 뒤의 침묵을 더 세게 적어주세요."],
    exam: ["입시 키워드는 감지됐지만 비판 신호가 약합니다. 성적 경쟁의 부작용을 더 또렷하게 적어주세요.", "시험 이야기가 너무 얌전합니다. 점수 중심 구조가 왜 학생을 밀어내는지 적어주세요."],
    field: ["체험학습 이야기는 보였지만 아직 현장감이 부족합니다. 위축되는 이유와 책임 회피 문제를 콕 집어주세요.", "소풍 안내문처럼 보입니다. 체험학습이 왜 막히는지 비판을 더해 주세요."],
    math: ["수학 이야기는 보였지만 아직 칠판이 조용합니다. 수포자가 생기는 구조를 비판해 주세요.", "수학 키워드는 잡혔지만 문제 제기가 약합니다. 진도와 선행의 압박을 더 분명히 써주세요."],
    general: ["중립 기어가 들어갔습니다. 이 게시판은 문제 제기가 필요하니 교육의 어떤 점이 잘못됐는지 더 분명히 적어주세요.", "글이 너무 무표정합니다. 학교·사교육·입시 문제 중 무엇을 비판하는지 선명하게 적어주세요."],
  };
  return pick(messages[topic] || messages.general);
}

function sentimentMessage(title, body, sentiment) {
  if (sentiment?.label === "positive") return positiveMessage(title, body);
  if (sentiment?.label === "neutral") return neutralMessage(title, body, sentiment);
  return neutralMessage(title, body, sentiment);
}

async function readPost(kv, id) { return await getJson(kv, `post:${id}`, null); }

function shortDevice(ownerHash) {
  return ownerHash ? ownerHash.slice(0, 12) : "";
}

function identityKey(ownerHash, ip) {
  return ownerHash ? `device:${ownerHash}` : `ip:${ip}`;
}

async function ownerHashFromToken(ownerToken) {
  return ownerToken ? await sha256(ownerToken) : "";
}

async function publicPost(post, ownerHash, isAdmin) {
  const item = { id: post.id, title: post.title, body: post.body, category: post.category, createdAt: post.createdAt, updatedAt: post.updatedAt, featured: Boolean(post.featured), featuredAt: post.featuredAt || null, canEdit: Boolean(isAdmin || (ownerHash && ownerHash === post.ownerHash)) };
  if (isAdmin) {
    item.ip = post.ip || "";
    item.maskedIp = post.maskedIp || maskIp(post.ip || "");
    item.ownerHash = post.ownerHash || "";
    item.deviceId = shortDevice(post.ownerHash || "");
  }
  return item;
}

async function listPosts(kv, request, env) {
  const index = await getIndex(kv, POSTS_INDEX_KEY);
  const ownerToken = request.headers.get("x-owner-token") || "";
  const ownerHash = await ownerHashFromToken(ownerToken);
  const isAdmin = await verifyAdmin(request, env);
  const posts = [];
  for (const id of index.slice(0, MAX_PUBLIC_POSTS * 2)) {
    const post = await readPost(kv, id);
    if (post && !post.deletedAt) posts.push(await publicPost(post, ownerHash, isAdmin));
  }
  const sorted = sortByNewest(posts).slice(0, MAX_PUBLIC_POSTS);
  const featured = sorted.filter((post) => post.featured).sort((a, b) => new Date(b.featuredAt || b.createdAt) - new Date(a.createdAt || a.createdAt)).slice(0, 4);
  return { posts: sorted, featured };
}

async function getBlockByKey(kv, key) {
  if (!key) return null;
  const block = await getJson(kv, `block:${key}`, null);
  if (!block) return null;
  if (isFuture(block.blockedUntil)) return { ...block, blockKey: key };
  await kv.delete(`block:${key}`);
  await removeFromIndex(kv, BLOCKS_INDEX_KEY, key);
  return null;
}

async function getActiveBlock(kv, identity, ip) {
  return (await getBlockByKey(kv, identity)) || (await getBlockByKey(kv, ip));
}

async function maxPostsPerIp(kv) {
  const settings = await getJson(kv, SITE_SETTINGS_KEY, null);
  const n = Number(settings?.maxPostsPerIp ?? DEFAULT_MAX_POSTS_PER_IP);
  return Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : DEFAULT_MAX_POSTS_PER_IP;
}

async function countPostsByIdentity(kv, ownerHash, ip) {
  const index = await getIndex(kv, POSTS_INDEX_KEY);
  let count = 0;
  for (const id of index) {
    const post = await readPost(kv, id);
    if (!post || post.deletedAt) continue;
    if (ownerHash ? post.ownerHash === ownerHash : post.ip === ip) count++;
  }
  return count;
}

async function recordFailedSentiment(kv, identity, ip, ownerHash, sentiment) {
  const key = `fail:${identity}`;
  const current = await getJson(kv, key, { count: 0 });
  const next = { count: Number(current.count || 0) + 1, lastFailedAt: nowIso(), lastSentiment: sentiment, ip, ownerHash };
  await putJson(kv, key, next, { expirationTtl: 60 * 60 });
  if (next.count >= MAX_FAILED_SENTIMENT_COUNT) {
    const blockedUntil = addMinutes(new Date(), BLOCK_MINUTES);
    const block = { blockKey: identity, identityType: ownerHash ? "device" : "ip", ip, maskedIp: maskIp(ip), ownerHash, deviceId: shortDevice(ownerHash), reason: "감정 검사 5회 미통과", failCount: next.count, blockedAt: nowIso(), blockedUntil, blockMinutes: BLOCK_MINUTES, lastSentiment: sentiment };
    await putJson(kv, `block:${identity}`, block, { expirationTtl: BLOCK_MINUTES * 60 + 3600 });
    await addToIndex(kv, BLOCKS_INDEX_KEY, identity);
    return block;
  }
  return null;
}

function normalizeRuleId(hit) { return hit?.rule?.id || cleanPoliticianName(hit?.name || ""); }
function normalizeRuleName(hit) { return hit?.rule?.name || hit?.name || "정치인"; }

function blockConfigs(setting, label) {
  if (!setting || setting.enabled === false) return [];
  const configs = [];
  if (Number(setting.any?.count || 0) > 0) configs.push({ scope: "any", count: Number(setting.any.count), minutes: Number(setting.any.minutes || 40) });
  const item = setting[label];
  if (Number(item?.count || 0) > 0) configs.push({ scope: label, count: Number(item.count), minutes: Number(item.minutes || 40) });
  return configs;
}

async function applyPoliticianBlockSetting(kv, identity, ip, ownerHash, hit, label, sentiment) {
  const ruleId = normalizeRuleId(hit);
  if (!ruleId) return null;
  const setting = await getJson(kv, `politician-block:${ruleId}`, null);
  const configs = blockConfigs(setting, label);
  if (!configs.length) return null;
  const results = [];
  for (const config of configs) {
    const key = `politician-count:${identity}:${ruleId}:${config.scope}`;
    const current = await getJson(kv, key, { count: 0 });
    const next = { count: Number(current.count || 0) + 1, label, updatedAt: nowIso(), target: hit.name, ip, ownerHash };
    await putJson(kv, key, next, { expirationTtl: 60 * 60 });
    results.push({ config, count: next.count, key });
  }
  const reached = results.find(r => r.count >= r.config.count);
  if (!reached) return { blocked: false, count: Math.max(...results.map(r => r.count)), configs };
  const minutes = Math.max(1, Math.min(10080, Number(reached.config.minutes || 40)));
  const blockedUntil = addMinutes(new Date(), minutes);
  const block = { blockKey: identity, identityType: ownerHash ? "device" : "ip", ip, maskedIp: maskIp(ip), ownerHash, deviceId: shortDevice(ownerHash), reason: `정치인 규칙 ${normalizeRuleName(hit)} ${reached.config.scope} ${reached.count}회`, failCount: reached.count, blockedAt: nowIso(), blockedUntil, blockMinutes: minutes, politicianRuleId: ruleId, politicianName: hit.name, politicianScope: reached.config.scope, lastSentiment: sentiment };
  await putJson(kv, `block:${identity}`, block, { expirationTtl: minutes * 60 + 3600 });
  await addToIndex(kv, BLOCKS_INDEX_KEY, identity);
  for (const r of results) await kv.delete(r.key);
  return { blocked: true, count: reached.count, config: reached.config, block };
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
    const data = await readJson(request);
    const title = cleanText(data.title, 80);
    const body = cleanText(data.body, 1200);
    const category = cleanText(data.category || "기타", 30);
    const ownerToken = cleanText(data.ownerToken, 200);
    const ownerHash = await ownerHashFromToken(ownerToken);
    const identity = identityKey(ownerHash, ip);

    const activeBlock = await getActiveBlock(kv, identity, ip);
    if (activeBlock) return json({ error: blockLimitMessage(activeBlock.blockMinutes || remainingMinutes(activeBlock.blockedUntil), activeBlock.blockedUntil), blocked: true, blockedUntil: activeBlock.blockedUntil }, 429);

    const fullText = `${title}\n${body}`;
    if (!ownerToken) return json({ error: "기기 식별 토큰이 없습니다. 페이지를 새로고침해 주세요." }, 400);
    if (title.length < 2) return json({ error: "제목은 2자 이상 입력해 주세요." }, 400);
    if (body.length < 10) return json({ error: "내용은 10자 이상 입력해 주세요." }, 400);

    const customRules = await loadPoliticianRules(kv);
    const customHit = detectCustomPolitician(fullText, customRules);
    const politicianHit = customHit || detectBannedPolitician(fullText);
    if (politicianHit) {
      const sentiment = await analyzeSentiment(fullText, env);
      const label = sentiment?.label === "positive" || sentiment?.label === "negative" ? sentiment.label : "neutral";
      const message = customHit ? messageForPoliticianRule(customHit, label) : defaultPoliticianMessage(politicianHit, label);
      const blockResult = await applyPoliticianBlockSetting(kv, identity, ip, ownerHash, politicianHit, label, sentiment);
      if (blockResult?.blocked) return json({ error: blockLimitMessage(blockResult.config.minutes, blockResult.block.blockedUntil), blocked: true, blockType: "politician", target: politicianHit.name, sentiment, sentimentLabel: label, blockedUntil: blockResult.block.blockedUntil, consecutiveCount: blockResult.count }, 429);
      return json({ error: message, blocked: true, blockType: "politician", target: politicianHit.name, sentiment, sentimentLabel: label, editableRule: Boolean(customHit), consecutiveCount: blockResult?.count || 0, blockThreshold: blockResult?.configs?.map(c => c.count).join(",") || 0 }, 422);
    }

    const politicalKind = detectPoliticalTopic(fullText);
    if (politicalKind) return json({ error: politicalMessage(politicalKind), blocked: true, blockType: "political", politicalKind }, 422);

    const maxByIp = await maxPostsPerIp(kv);
    const identityPostCount = await countPostsByIdentity(kv, ownerHash, ip);
    if (identityPostCount >= maxByIp) {
      return json({ error: `같은 기기에서는 글을 최대 ${maxByIp}개까지 등록할 수 있습니다. 기존 글을 수정하거나 삭제해 주세요.`, maxPostsPerIp: maxByIp, identityPostCount, deviceId: shortDevice(ownerHash), ip }, 409);
    }

    const sentiment = await analyzeSentiment(fullText, env);
    if (!PASS_SENTIMENT_LABELS.includes(sentiment.label)) {
      const newBlock = await recordFailedSentiment(kv, identity, ip, ownerHash, sentiment);
      if (newBlock) return json({ error: blockLimitMessage(BLOCK_MINUTES, newBlock.blockedUntil), blocked: true, blockedUntil: newBlock.blockedUntil, sentiment }, 429);
      return json({ error: sentimentMessage(title, body, sentiment), sentiment, blockType: sentiment.label === "positive" ? "positive" : "neutral" }, 422);
    }

    const id = randomId("post");
    const post = { id, title, body, category, ownerHash, deviceId: shortDevice(ownerHash), ip, maskedIp: maskIp(ip), sentiment, createdAt: nowIso(), updatedAt: nowIso(), featured: false };
    await putJson(kv, `post:${id}`, post);
    await addToIndex(kv, POSTS_INDEX_KEY, id);
    await kv.put(`device-post:${identity}`, id);
    await kv.delete(`fail:${identity}`);
    return json({ ok: true, post: await publicPost(post, ownerHash, false) }, 201);
  } catch (error) {
    return json({ error: error.message || "등록하지 못했습니다." }, 500);
  }
}
