import { addMinutes, addToIndex, getIndex, getJson, getKV, isFuture, json, maskIp, nowIso, putJson, readJson, removeFromIndex, sortByNewest, verifyAdmin } from "../../lib/common.js";

const BLOCKS_INDEX_KEY = "blocks:index";
const DEFAULT_MANUAL_BLOCK_MINUTES = 60 * 24;

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

export async function onRequestPost({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const ip = String(data.ip || "").trim();
    if (!ip) return json({ error: "차단할 IP가 없습니다." }, 400);

    const minutes = Math.max(10, Math.min(60 * 24 * 7, Number(data.minutes || DEFAULT_MANUAL_BLOCK_MINUTES)));
    const block = {
      ip,
      maskedIp: maskIp(ip),
      reason: String(data.reason || "관리자 수동 차단").slice(0, 80),
      blockedAt: nowIso(),
      blockedUntil: addMinutes(new Date(), minutes),
      manual: true,
    };

    await putJson(kv, `block:${ip}`, block, { expirationTtl: minutes * 60 + 3600 });
    await addToIndex(kv, BLOCKS_INDEX_KEY, ip);
    await kv.delete(`fail:${ip}`);

    return json({ ok: true, block, blocks: await loadBlocks(kv) });
  } catch (error) {
    return json({ error: error.message || "차단하지 못했습니다." }, 500);
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
