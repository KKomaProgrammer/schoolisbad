import { getKV, json, readJson, verifyAdmin } from "../../lib/common.js";
import { cleanPoliticianName } from "../../lib/politician-rules.js";

const INDEX_KEY = "politician-blocks:index";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

function n(value, fallback = 0, max = 10080) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(max, Math.floor(num)));
}

function option(data, key) {
  return {
    count: n(data?.[`${key}Count`] ?? data?.[key]?.count, 0, 50),
    minutes: Math.max(1, n(data?.[`${key}Minutes`] ?? data?.[key]?.minutes, 40, 10080)),
  };
}

function normalize(data) {
  const id = cleanPoliticianName(data.id || data.name);
  const name = String(data.name || data.id || "").normalize("NFKC").trim().slice(0, 40) || id;
  if (!id) throw new Error("정치인 이름이 없습니다.");
  return {
    id,
    name,
    enabled: data.enabled !== false,
    any: option(data, "any"),
    positive: option(data, "positive"),
    neutral: option(data, "neutral"),
    negative: option(data, "negative"),
    updatedAt: new Date().toISOString(),
  };
}

async function readIndex(kv) {
  const ids = await kv.get(INDEX_KEY, "json").catch(() => []);
  return Array.isArray(ids) ? ids : [];
}

async function writeIndex(kv, ids) {
  await kv.put(INDEX_KEY, JSON.stringify([...new Set(ids.map(String).filter(Boolean))]));
}

async function readAll(kv) {
  const ids = await readIndex(kv);
  const result = [];
  for (const id of ids) {
    const setting = await kv.get(`politician-block:${id}`, "json").catch(() => null);
    if (setting) result.push(setting);
  }
  return result;
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    return json({ settings: await readAll(kv) });
  } catch (error) {
    return json({ error: error.message || "차단 설정을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = normalize(await readJson(request));
    await kv.put(`politician-block:${data.id}`, JSON.stringify(data));
    const ids = await readIndex(kv);
    if (!ids.includes(data.id)) ids.unshift(data.id);
    await writeIndex(kv, ids);
    return json({ ok: true, setting: data, settings: await readAll(kv) });
  } catch (error) {
    return json({ error: error.message || "차단 설정을 저장하지 못했습니다." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const id = cleanPoliticianName(data.id || data.name);
    if (!id) return json({ error: "삭제할 정치인 이름이 없습니다." }, 400);
    await kv.delete(`politician-block:${id}`);
    await writeIndex(kv, (await readIndex(kv)).filter(x => x !== id));
    return json({ ok: true, settings: await readAll(kv) });
  } catch (error) {
    return json({ error: error.message || "차단 설정을 삭제하지 못했습니다." }, 500);
  }
}
