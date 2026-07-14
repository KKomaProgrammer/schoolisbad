import { addToIndex, getIndex, getJson, getKV, json, nowIso, putJson, readJson, removeFromIndex, verifyAdmin } from "../../lib/common.js";

const NOTES_INDEX_KEY = "user-notes:index";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

function clean(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function shortDevice(ownerHash) {
  return clean(ownerHash, 80).slice(0, 12);
}

function noteKey(data) {
  const raw = clean(data.key || data.noteKey || data.deviceKey, 180);
  if (raw) return raw;
  const ownerHash = clean(data.ownerHash, 160);
  if (ownerHash) return `device:${ownerHash}`;
  const ip = clean(data.ip, 80);
  return ip ? `ip:${ip}` : "";
}

function normalizeNote(key, data, text) {
  const ownerHash = clean(data.ownerHash, 160);
  const ip = clean(data.ip, 80);
  return {
    key,
    noteKey: key,
    identityType: key.startsWith("device:") ? "device" : "ip",
    ip,
    ownerHash,
    deviceId: clean(data.deviceId, 80) || shortDevice(ownerHash),
    note: text,
    updatedAt: nowIso(),
  };
}

async function loadNotes(kv) {
  const keys = await getIndex(kv, NOTES_INDEX_KEY);
  const notes = [];
  for (const key of keys) {
    const note = await getJson(kv, `user-note:${key}`, null);
    if (!note) continue;
    const normalizedKey = note.key || note.noteKey || (note.ownerHash ? `device:${note.ownerHash}` : note.ip ? `ip:${note.ip}` : key);
    notes.push({ ...note, key: normalizedKey, noteKey: normalizedKey, deviceId: note.deviceId || shortDevice(note.ownerHash || "") });
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
    const key = noteKey(data);
    if (!key) return json({ error: "메모할 IP 또는 기기 해시가 없습니다." }, 400);

    const text = String(data.note || data.memo || "").trim().slice(0, 1000);
    if (!text) {
      await kv.delete(`user-note:${key}`);
      await removeFromIndex(kv, NOTES_INDEX_KEY, key);
      return json({ ok: true, note: null, notes: await loadNotes(kv) });
    }

    const note = normalizeNote(key, data, text);
    await putJson(kv, `user-note:${key}`, note);
    await addToIndex(kv, NOTES_INDEX_KEY, key);
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
    const key = noteKey(data);
    if (!key) return json({ error: "삭제할 IP 또는 기기 해시가 없습니다." }, 400);
    await kv.delete(`user-note:${key}`);
    await removeFromIndex(kv, NOTES_INDEX_KEY, key);
    return json({ ok: true, notes: await loadNotes(kv) });
  } catch (error) {
    return json({ error: error.message || "메모를 삭제하지 못했습니다." }, 500);
  }
}
