import { getIndex, getJson, getKV, json, nowIso, putJson, readJson, sortByNewest, verifyAdmin } from "../lib/common.js";

const POSTS_INDEX_KEY = "posts:index";
const MAX_FEATURED = 4;

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

async function loadPosts(kv) {
  const ids = await getIndex(kv, POSTS_INDEX_KEY);
  const posts = [];
  for (const id of ids) {
    const post = await getJson(kv, `post:${id}`, null);
    if (post && !post.deletedAt) posts.push(post);
  }
  return sortByNewest(posts);
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

export async function onRequestPost({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const postId = String(data.postId || "");
    const useFeatured = Boolean(data.featured);
    const post = await getJson(kv, `post:${postId}`, null);
    if (!post || post.deletedAt) return json({ error: "글을 찾을 수 없습니다." }, 404);

    const posts = await loadPosts(kv);
    const picked = posts.filter((item) => item.featured && item.id !== postId);
    if (useFeatured && picked.length >= MAX_FEATURED) {
      return json({ error: "선정 글은 최대 4개입니다. 기존 글을 먼저 해제해 주세요." }, 409);
    }

    const next = {
      ...post,
      featured: useFeatured,
      featuredAt: useFeatured ? nowIso() : null,
      updatedAt: nowIso(),
    };
    await putJson(kv, `post:${postId}`, next);

    const after = await loadPosts(kv);
    return json({
      ok: true,
      post: publicPost(next),
      featured: after.filter((item) => item.featured).map(publicPost).slice(0, MAX_FEATURED),
    });
  } catch (error) {
    return json({ error: error.message || "처리하지 못했습니다." }, 500);
  }
}
