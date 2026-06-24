import { adminFormToToken, json, readJson, requireAdminConfig } from "../lib/common.js";

export async function onRequestGet() {
  return json({ ok: true, route: "admin-login" });
}

export async function onRequestPost({ request, env }) {
  const configError = requireAdminConfig(env);
  if (configError) return json({ error: configError }, 500);
  const value = await adminFormToToken(await readJson(request), env);
  if (!value) return json({ error: "관리자 ID 또는 PW가 일치하지 않습니다." }, 401);
  return json({ ok: true, value });
}
