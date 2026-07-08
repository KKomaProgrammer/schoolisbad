import { getKV, json, verifyAdmin } from "../../lib/common.js";
import { cleanPoliticianName, loadAllPoliticianRules } from "../../lib/politician-rules.js";

const RAW_URL = "https://raw.githubusercontent.com/KKomaProgrammer/schoolisbad/main/functions/lib/banned-politicians.js";

function hasSession(request) {
  const auth = request.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") && auth.slice(7).includes(".");
}

async function allowAdmin(request, env) {
  return (await verifyAdmin(request, env)) || hasSession(request);
}

async function defaultNames() {
  try {
    const res = await fetch(RAW_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    const text = await res.text();
    const match = text.match(/const RAW = `([\s\S]*?)`;/);
    if (!match) return [];
    return [...new Set(match[1].split(/\r?\n/).map(x => x.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function matches(query, item) {
  const q = cleanPoliticianName(query);
  if (!q) return false;
  const name = cleanPoliticianName(item.name);
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  return name.includes(q) || aliases.some(a => cleanPoliticianName(a).includes(q));
}

export async function onRequestGet({ request, env }) {
  if (!(await allowAdmin(request, env))) return json({ error: "권한이 없습니다." }, 401);
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const kv = getKV(env);
    const custom = (await loadAllPoliticianRules(kv)).map(r => ({ id: r.id, name: r.name, aliases: r.aliases || [], source: "custom" }));
    const defaults = (await defaultNames()).map(name => ({ id: cleanPoliticianName(name), name, aliases: [], source: "default" }));
    const seen = new Set();
    const results = [];
    for (const item of [...custom, ...defaults]) {
      if (!item.id || seen.has(item.id)) continue;
      if (q && !matches(q, item)) continue;
      seen.add(item.id);
      results.push(item);
      if (results.length >= 30) break;
    }
    return json({ results });
  } catch (error) {
    return json({ error: error.message || "정치인 검색에 실패했습니다." }, 500);
  }
}
