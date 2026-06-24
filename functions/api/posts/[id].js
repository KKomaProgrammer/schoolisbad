import {
  cleanText,
  getJson,
  getKV,
  json,
  nowIso,
  putJson,
  readJson,
  removeFromIndex,
  sha256,
  verifyAdmin,
} from "../../lib/common.js";
import { analyzeSentiment } from "../../lib/sentiment.js";

export const PASS_SENTIMENT_LABELS = ["negative"];
const POSTS_INDEX_KEY = "posts:index";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function canModify(request, env, post, body) {
  if ((await verifyAdmin(request, env)) || hasSession(request)) return true;
  const ownerToken = cleanText(body.ownerToken, 200);
  if (!ownerToken) return false;
  return (await sha256(ownerToken)) === post.ownerHash;
}

function publicPost(post) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    featured: Boolean(post.featured),
    featuredAt: post.featuredAt || null,
  };
}

export async function onRequestPut({ request, env, params }) {
  try {
    const kv = getKV(env);
    const id = params.id;
    const post = await getJson(kv, `post:${id}`, null);
    if (!post || post.deletedAt) return json({ error: "글을 찾을 수 없습니다." }, 404);

    const data = await readJson(request);
    if (!(await canModify(request, env, post, data))) {
      return json({ error: "수정 권한이 없습니다." }, 403);
    }

    const title = cleanText(data.title, 80);
    const body = cleanText(data.body, 1200);
    const category = cleanText(data.category || post.category || "기타", 30);

    if (title.length < 2) return json({ error: "제목은 2자 이상 입력해 주세요." }, 400);
    if (body.length < 10) return json({ error: "내용은 10자 이상 입력해 주세요." }, 400);

    const sentiment = await analyzeSentiment(`${title}\n${body}`, env);
    if (!PASS_SENTIMENT_LABELS.includes(sentiment.label)) {
      return json({ error: "부정 의견만 저장됩니다.", sentiment }, 422);
    }

    const next = { ...post, title, body, category, sentiment, updatedAt: nowIso() };
    await putJson(kv, `post:${id}`, next);
    return json({ ok: true, post: publicPost(next) });
  } catch (error) {
    return json({ error: error.message || "수정하지 못했습니다." }, 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const kv = getKV(env);
    const id = params.id;
    const post = await getJson(kv, `post:${id}`, null);
    if (!post || post.deletedAt) return json({ error: "글을 찾을 수 없습니다." }, 404);

    const data = await readJson(request);
    if (!(await canModify(request, env, post, data))) {
      return json({ error: "삭제 권한이 없습니다." }, 403);
    }

    const next = { ...post, deletedAt: nowIso(), updatedAt: nowIso() };
    await putJson(kv, `post:${id}`, next);
    await removeFromIndex(kv, POSTS_INDEX_KEY, id);
    if (post.ip) await kv.delete(`ip-post:${post.ip}`);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || "삭제하지 못했습니다." }, 500);
  }
}
