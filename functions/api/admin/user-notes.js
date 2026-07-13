import { addToIndex, getIndex, getJson, getKV, json, nowIso, putJson, readJson, removeFromIndex, verifyAdmin } from "../../lib/common.js";

const NOTES_INDEX_KEY = "user-notes:index";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

function cleanIp(value) {
  return String(value || "").trim().slice(0, 80);
}

async function loadNotes(kv) {
  const ips = await getIndex(kv, NOTES_INDEX_KEY);
  const notes = [];
  for (const ip of ips) {
    const note = await getJson(kv, `user-note:${ip}`, null);
    if (note && note.ip) notes.push(note);
  }
  return notes.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    return json({ notes: await loadNotes(kv) });
  } catch (error) {
    return json({ error: error.message || "메모를 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const ip = cleanIp(data.ip);
    if (!ip) return json({ error: "메모할 IP가 없습니다." }, 400);

    const text = String(data.note || data.memo || "").trim().slice(0, 1000);
    if (!text) {
      await kv.delete(`user-note:${ip}`);
      await removeFromIndex(kv, NOTES_INDEX_KEY, ip);
      return json({ ok: true, note: null, notes: await loadNotes(kv) });
    }

    const note = {
      ip,
      note: text,
      updatedAt: nowIso(),
    };
    await putJson(kv, `user-note:${ip}`, note);
    await addToIndex(kv, NOTES_INDEX_KEY, ip);
    return json({ ok: true, note, notes: await loadNotes(kv) });
  } catch (error) {
    return json({ error: error.message || "메모를 저장하지 못했습니다." }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const ip = cleanIp(data.ip);
    if (!ip) return json({ error: "삭제할 IP가 없습니다." }, 400);
    await kv.delete(`user-note:${ip}`);
    await removeFromIndex(kv, NOTES_INDEX_KEY, ip);
    return json({ ok: true, notes: await loadNotes(kv) });
  } catch (error) {
    return json({ error: error.message || "메모를 삭제하지 못했습니다." }, 500);
  }
}
