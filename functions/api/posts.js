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

async function readPost(kv, id) {
  return await getJson(kv, `post:${id}`, null);
}

async function publicPost(post, ownerHash, isAdmin) {
  return {
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
        error: "잠시 등록이 제한되었습니다.",
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
          error: "감정 검사에 5회 이상 통과하지 못해 40분 동안 등록이 제한되었습니다.",
          blocked: true,
          blockedUntil: newBlock.blockedUntil,
          sentiment,
        }, 429);
      }
      return json({
        error: "부정 의견만 등록할 수 있습니다.",
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
