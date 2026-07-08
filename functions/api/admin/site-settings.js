import { getKV, json, readJson, verifyAdmin } from "../../lib/common.js";

const KEY = "site:settings";
const DEFAULTS = { maxPostsPerIp: 1 };

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

function cleanSettings(data) {
  const raw = Number(data.maxPostsPerIp ?? data.maxPosts ?? DEFAULTS.maxPostsPerIp);
  const maxPostsPerIp = Number.isFinite(raw) ? Math.max(1, Math.min(50, Math.floor(raw))) : DEFAULTS.maxPostsPerIp;
  return { maxPostsPerIp, updatedAt: new Date().toISOString() };
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const saved = await kv.get(KEY, "json").catch(() => null);
    return json({ settings: { ...DEFAULTS, ...(saved || {}) } });
  } catch (error) {
    return json({ error: error.message || "설정을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const settings = cleanSettings(await readJson(request));
    await kv.put(KEY, JSON.stringify(settings));
    return json({ ok: true, settings });
  } catch (error) {
    return json({ error: error.message || "설정을 저장하지 못했습니다." }, 500);
  }
}
