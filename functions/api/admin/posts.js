import { getIndex, getJson, getKV, json, maskIp, sortByNewest, verifyAdmin } from "../../lib/common.js";

const POSTS_INDEX_KEY = "posts:index";
const MAX_PUBLIC_POSTS = 100;

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

async function readPost(kv, id) {
  return await getJson(kv, `post:${id}`, null);
}

function adminPost(post) {
  return {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    featured: Boolean(post.featured),
    featuredAt: post.featuredAt || null,
    canEdit: true,
    ip: post.ip || "",
    maskedIp: post.maskedIp || maskIp(post.ip || ""),
    ownerHash: post.ownerHash || "",
  };
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const index = await getIndex(kv, POSTS_INDEX_KEY);
    const posts = [];
    for (const id of index.slice(0, MAX_PUBLIC_POSTS * 2)) {
      const post = await readPost(kv, id);
      if (post && !post.deletedAt) posts.push(adminPost(post));
    }
    const sorted = sortByNewest(posts).slice(0, MAX_PUBLIC_POSTS);
    const featured = sorted
      .filter((post) => post.featured)
      .sort((a, b) => new Date(b.featuredAt || b.createdAt) - new Date(a.featuredAt || a.createdAt))
      .slice(0, 4);
    return json({ posts: sorted, featured });
  } catch (error) {
    return json({ error: error.message || "관리자 글 목록을 불러오지 못했습니다." }, 500);
  }
}
