export const KV_BINDING_NAME = "SCHOOLISBAD_KV";

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function getKV(env) {
  const kv = env[KV_BINDING_NAME];
  if (!kv) {
    throw new Error(`Cloudflare KV binding '${KV_BINDING_NAME}' is not configured.`);
  }
  return kv;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export function maskIp(ip) {
  if (!ip) return "unknown";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
  }
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:****`;
  return ip;
}

export function nowIso() {
  return new Date().toISOString();
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000).toISOString();
}

export function isFuture(iso) {
  return Boolean(iso && new Date(iso).getTime() > Date.now());
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(String(text));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomId(prefix = "p") {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `${prefix}_${[...bytes].map((b) => b.toString(36).padStart(2, "0")).join("")}`;
}

export async function getJson(kv, key, fallback = null) {
  const value = await kv.get(key, "json");
  return value ?? fallback;
}

export async function putJson(kv, key, value, options = {}) {
  await kv.put(key, JSON.stringify(value), options);
}

export async function getIndex(kv, key) {
  const value = await getJson(kv, key, []);
  return Array.isArray(value) ? value : [];
}

export async function setIndex(kv, key, values) {
  await putJson(kv, key, [...new Set(values)]);
}

export async function addToIndex(kv, key, value) {
  const index = await getIndex(kv, key);
  if (!index.includes(value)) index.unshift(value);
  await setIndex(kv, key, index);
  return index;
}

export async function removeFromIndex(kv, key, value) {
  const index = await getIndex(kv, key);
  const next = index.filter((item) => item !== value);
  await setIndex(kv, key, next);
  return next;
}

function pick(env, names) {
  for (const name of names) {
    const value = env?.[name];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function adminConfig(env) {
  return {
    id: pick(env, ["ADMIN_ID", "ADMIN_USER", "ADMIN_USERNAME"]),
    pw: pick(env, ["ADMIN_PW", "ADMIN_PASSWORD", "ADMIN_PASS", "ADMIN_CODE"]),
    secret: pick(env, ["ADMIN_SESSION_SECRET", "SESSION_SECRET", "JWT_SECRET"]),
  };
}

function base64UrlEncode(text) {
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(text) {
  const normalized = text.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function requireAdminConfig(env) {
  const cfg = adminConfig(env);
  const missing = [];
  if (!cfg.id) missing.push("ADMIN_ID");
  if (!cfg.pw) missing.push("ADMIN_PW");
  if (!cfg.secret) missing.push("ADMIN_SESSION_SECRET");
  if (missing.length) return `${missing.join(", ")} 환경 변수를 Cloudflare Pages에 설정해야 합니다.`;
  return null;
}

export async function createAdminToken(env) {
  const cfg = adminConfig(env);
  const payload = {
    role: "admin",
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 60 * 6,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmac(cfg.secret, body);
  return `${body}.${sig}`;
}

export async function adminFormToToken(form, env) {
  const cfg = adminConfig(env);
  const user = String(form.id || form.user || form.username || "").trim();
  const code = String(form.code || form.pw || form.password || form.pass || "").trim();
  if (!cfg.id || !cfg.pw || !cfg.secret) return "";
  if (user !== cfg.id || code !== cfg.pw) return "";
  return await createAdminToken(env);
}

export async function verifyAdmin(request, env) {
  const cfg = adminConfig(env);
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !cfg.secret) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = await hmac(cfg.secret, body);
  if (expected !== sig) return false;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    return payload.role === "admin" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function cleanText(text, max = 1200) {
  return String(text || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s{3,}/g, "  ")
    .trim()
    .slice(0, max);
}

export function sortByNewest(items) {
  return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}
