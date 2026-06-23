import { adminFormToToken, json, readJson, requireAdminConfig } from "../lib/common.js";

export async function onRequestPost({ request, env }) {
  const configError = requireAdminConfig(env);
  if (configError) return json({ error: configError }, 500);
  const value = await adminFormToToken(await readJson(request), env);
  if (!value) return json({ error: "not allowed" }, 401);
  return json({ ok: true, value });
}
