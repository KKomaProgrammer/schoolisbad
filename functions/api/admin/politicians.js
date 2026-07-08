import { getKV, json, readJson, verifyAdmin } from "../../lib/common.js";
import { deletePoliticianRule, loadAllPoliticianRules, savePoliticianRule } from "../../lib/politician-rules.js";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    return json({ rules: await loadAllPoliticianRules(kv) });
  } catch (error) {
    return json({ error: error.message || "정치인 규칙을 불러오지 못했습니다." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    const rule = await savePoliticianRule(kv, data);
    return json({ ok: true, rule, rules: await loadAllPoliticianRules(kv) });
  } catch (error) {
    return json({ error: error.message || "정치인 규칙을 저장하지 못했습니다." }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  return onRequestPost({ request, env });
}

export async function onRequestDelete({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const kv = getKV(env);
    const data = await readJson(request);
    await deletePoliticianRule(kv, data.id || data.name);
    return json({ ok: true, rules: await loadAllPoliticianRules(kv) });
  } catch (error) {
    return json({ error: error.message || "정치인 규칙을 삭제하지 못했습니다." }, 500);
  }
}
