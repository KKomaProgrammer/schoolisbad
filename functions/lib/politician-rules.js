export const POLITICIAN_RULES_INDEX_KEY = "politicians:index";

const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

export function cleanPoliticianName(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "")
    .trim();
}

function visibleName(text) {
  return String(text || "").normalize("NFKC").trim().slice(0, 40);
}

function choOf(ch) {
  const code = ch.charCodeAt(0) - 44032;
  if (code >= 0 && code <= 11171) return CHO[Math.floor(code / 588)];
  return ch;
}

function initialsOfName(text) {
  return cleanPoliticianName(text).split("").map(choOf).join("");
}

function fuzzyIncludes(body, target, maxGap) {
  if (!target) return false;
  if (body.includes(target)) return true;
  for (let start = 0; start < body.length; start++) {
    if (body[start] !== target[0]) continue;
    let pos = start;
    let ok = true;
    for (let i = 1; i < target.length; i++) {
      let found = -1;
      const limit = Math.min(body.length - 1, pos + maxGap + 1);
      for (let j = pos + 1; j <= limit; j++) {
        if (body[j] === target[i]) { found = j; break; }
      }
      if (found === -1) { ok = false; break; }
      pos = found;
    }
    if (ok) return true;
  }
  return false;
}

function consonantOnlyTokens(text) {
  return String(text || "").normalize("NFKC").match(/[ㄱ-ㅎ]+/g) || [];
}

function isKoreanName(name) {
  return /^[가-힣]+$/.test(name);
}

function hasStrictInitialMatch(text, name) {
  const cho = initialsOfName(name);
  if (!cho || cho.length < 3) return false;
  for (const token of consonantOnlyTokens(text)) {
    if (token.length < cho.length) continue;
    if (fuzzyIncludes(token, cho, 1)) return true;
  }
  return false;
}

async function readIndex(kv) {
  try {
    const value = await kv.get(POLITICIAN_RULES_INDEX_KEY, "json");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function writeIndex(kv, ids) {
  const cleanIds = [...new Set(ids.map(String).filter(Boolean))];
  await kv.put(POLITICIAN_RULES_INDEX_KEY, JSON.stringify(cleanIds));
}

export async function loadPoliticianRules(kv) {
  const ids = await readIndex(kv);
  const rules = [];
  for (const id of ids) {
    const rule = await kv.get(`politician:${id}`, "json").catch(() => null);
    if (rule && rule.name && rule.enabled !== false) rules.push(rule);
  }
  return rules;
}

export async function loadAllPoliticianRules(kv) {
  const ids = await readIndex(kv);
  const rules = [];
  for (const id of ids) {
    const rule = await kv.get(`politician:${id}`, "json").catch(() => null);
    if (rule && rule.name) rules.push(rule);
  }
  return rules;
}

export async function savePoliticianRule(kv, data) {
  const name = visibleName(data.name);
  const id = cleanPoliticianName(data.id || data.name);
  if (!name || !id) throw new Error("정치인 이름이 없습니다.");

  const existing = await kv.get(`politician:${id}`, "json").catch(() => null);
  const now = new Date().toISOString();
  const rule = {
    id,
    name,
    aliases: Array.isArray(data.aliases) ? data.aliases.map(visibleName).filter(Boolean).slice(0, 10) : [],
    enabled: data.enabled !== false,
    messages: {
      positive: String(data.positiveMessage || data.messages?.positive || `${name} 님 칭찬은 정치 뉴스룸으로 보내겠습니다. 여긴 교육 비판 게시판입니다.`).slice(0, 220),
      neutral: String(data.neutralMessage || data.messages?.neutral || `${name} 님 이야기는 잠시 국회 가방에 넣어주세요. 학교·사교육 문제로 다시 작성해 주세요.`).slice(0, 220),
      negative: String(data.negativeMessage || data.messages?.negative || `${name} 님 비판도 정치 주제라 등록되지 않습니다. 교육 문제 비판만 입장 가능합니다.`).slice(0, 220),
    },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await kv.put(`politician:${id}`, JSON.stringify(rule));
  const ids = await readIndex(kv);
  if (!ids.includes(id)) ids.unshift(id);
  await writeIndex(kv, ids);
  return rule;
}

export async function deletePoliticianRule(kv, idOrName) {
  const id = cleanPoliticianName(idOrName);
  if (!id) throw new Error("삭제할 정치인 이름이 없습니다.");
  await kv.delete(`politician:${id}`);
  const ids = await readIndex(kv);
  await writeIndex(kv, ids.filter(x => x !== id));
  return id;
}

export function detectCustomPolitician(text, rules) {
  const body = cleanPoliticianName(text);
  for (const rule of rules || []) {
    const names = [rule.name, ...(Array.isArray(rule.aliases) ? rule.aliases : [])];
    for (const rawName of names) {
      const name = cleanPoliticianName(rawName);
      if (!name) continue;
      const maxGap = name.length <= 2 ? 1 : 2;
      if (fuzzyIncludes(body, name, maxGap)) {
        return { name: rawName, type: "name", rule };
      }
      if (isKoreanName(name) && name.length >= 3 && hasStrictInitialMatch(text, name)) {
        return { name: rawName, type: "initial", rule };
      }
    }
  }
  return null;
}

export function messageForPoliticianRule(hit, sentimentLabel) {
  const rule = hit?.rule;
  const label = sentimentLabel === "positive" || sentimentLabel === "negative" ? sentimentLabel : "neutral";
  const fallback = {
    positive: `${hit?.name || "정치인"} 님 칭찬은 정치 뉴스룸으로 보내겠습니다. 여긴 교육 비판 게시판입니다.`,
    neutral: `${hit?.name || "정치인"} 님 이야기는 잠시 국회 가방에 넣어주세요. 학교·사교육 문제로 다시 작성해 주세요.`,
    negative: `${hit?.name || "정치인"} 님 비판도 정치 주제라 등록되지 않습니다. 교육 문제 비판만 입장 가능합니다.`,
  };
  const template = rule?.messages?.[label] || fallback[label];
  return String(template)
    .replaceAll("{name}", hit?.name || rule?.name || "정치인")
    .replaceAll("{sentiment}", label)
    .replaceAll("{type}", hit?.type || "name");
}
