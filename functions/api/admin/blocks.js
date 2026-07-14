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
  const keys = await getIndex(kv, BLOCKS_INDEX_KEY);
  const blocks = [];
  for (const key of keys) {
    const block = await getJson(kv, `block:${key}`, null);
    if (!block) continue;
    if (!isFuture(block.blockedUntil)) {
      await kv.delete(`block:${key}`);
      await removeFromIndex(kv, BLOCKS_INDEX_KEY, key);
      continue;
    }
    blocks.push({ ...block, blockKey: block.blockKey || key });
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
      blockKey: ip,
      identityType: "ip",
      ip,
      maskedIp: maskIp(ip),
      reason: String(data.reason || "관리자 수동 차단").slice(0, 80),
      blockedAt: nowIso(),
      blockedUntil: addMinutes(new Date(), minutes),
      blockMinutes: minutes,
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
    const requested = String(data.blockKey || data.key || data.ip || "").trim();
    if (!requested) return json({ error: "해제할 IP 또는 기기 키가 없습니다." }, 400);

    let deleted = false;
    if (await getJson(kv, `block:${requested}`, null)) {
      await kv.delete(`block:${requested}`);
      await kv.delete(`fail:${requested}`);
      await removeFromIndex(kv, BLOCKS_INDEX_KEY, requested);
      deleted = true;
    }

    if (!deleted) {
      const keys = await getIndex(kv, BLOCKS_INDEX_KEY);
      for (const key of keys) {
        const block = await getJson(kv, `block:${key}`, null);
        if (block && (block.ip === requested || block.blockKey === requested)) {
          await kv.delete(`block:${key}`);
          await kv.delete(`fail:${key}`);
          await removeFromIndex(kv, BLOCKS_INDEX_KEY, key);
          deleted = true;
        }
      }
    }

    return json({ ok: true, deleted, blocks: await loadBlocks(kv) });
  } catch (error) {
    return json({ error: error.message || "차단을 해제하지 못했습니다." }, 500);
  }
}
