import { getIndex, getJson, getKV, isFuture, json, readJson, removeFromIndex, sortByNewest, verifyAdmin } from "../../lib/common.js";

const BLOCKS_INDEX_KEY = "blocks:index";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

async function loadBlocks(kv) {
  const ips = await getIndex(kv, BLOCKS_INDEX_KEY);
  const blocks = [];
  for (const ip of ips) {
    const block = await getJson(kv, `block:${ip}`, null);
    if (!block) continue;
    if (!isFuture(block.blockedUntil)) {
      await kv.delete(`block:${ip}`);
      await removeFromIndex(kv, BLOCKS_INDEX_KEY, ip);
      continue;
    }
    blocks.push(block);
  }
  return sortByNewest(blocks.map((b) => ({ ...b, createdAt: b.blockedAt })));
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    return json({ blocks: await loadBlocks(kv) });
  } catch (error) {
    return json({ error: error.message || "차단 목록을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const ip = String(data.ip || "").trim();
    if (!ip) return json({ error: "해제할 IP가 없습니다." }, 400);
    await kv.delete(`block:${ip}`);
    await kv.delete(`fail:${ip}`);
    await removeFromIndex(kv, BLOCKS_INDEX_KEY, ip);
    return json({ ok: true, blocks: await loadBlocks(kv) });
  } catch (error) {
    return json({ error: error.message || "차단을 해제하지 못했습니다." }, 500);
  }
}
