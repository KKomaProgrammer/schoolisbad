const CACHE_MS = 1000 * 60 * 60 * 12;
const MAX_TERMS = 15000;
let cached = null;
let cachedAt = 0;
let pending = null;
let status = { ok: false, source: "not-built", trainedAt: null, rows: 0, terms: 0, error: null };

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalize(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^0-9a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compact(text) {
  return normalize(text).replace(/\s+/g, "");
}

function csvRows(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], nx = text[i + 1];
    if (q) {
      if (c === '"' && nx === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); if (row.some(x => String(x).trim())) rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  row.push(cell);
  if (row.some(x => String(x).trim())) rows.push(row);
  return rows;
}

function csvObjects(text) {
  const rows = csvRows(text);
  const headers = (rows.shift() || []).map(h => String(h || "").replace(/^\uFEFF/, "").trim());
  return rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}

function dataUrl(branch = "master") {
  return ["https://raw.githubusercontent.com", "mrlee23", "KoreanSentimentAnalyzer", branch, "dic", "polarity.csv"].join("/");
}

async function loadCsv() {
  let lastError;
  for (const branch of ["master", "main"]) {
    try {
      const url = dataUrl(branch);
      const res = await fetch(url, { cf: { cacheTtl: 43200, cacheEverything: true } });
      if (!res.ok) throw new Error(`${branch}:${res.status}`);
      return { text: await res.text(), url };
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error("polarity.csv load failed");
}

function ngramText(ngram) {
  return compact(String(ngram || "").split(";").map(p => p.split("/")[0].replaceAll("*", "")).join(""));
}

function train(rows) {
  const terms = new Map();
  for (const r of rows) {
    const term = ngramText(r.ngram);
    if (term.length < 2) continue;
    const pos = num(r.POS), neg = num(r.NEG), prop = num(r["max.prop"]), freq = Math.max(1, num(r.freq));
    const base = pos - neg;
    const maxValue = String(r["max.value"] || "");
    if (Math.abs(base) < 0.12) continue;
    if (maxValue !== "POS" && maxValue !== "NEG" && Math.abs(base) < 0.34) continue;
    const score = base * Math.log1p(freq) * Math.max(0.45, prop);
    const old = terms.get(term) || { term, score: 0, freq: 0 };
    old.score += score;
    old.freq += freq;
    terms.set(term, old);
  }
  return [...terms.values()]
    .filter(x => Math.abs(x.score) >= 0.2 && (x.term.length >= 3 || Math.abs(x.score) >= 0.7))
    .sort((a, b) => Math.abs(b.score) * Math.log1p(b.freq) - Math.abs(a.score) * Math.log1p(a.freq))
    .slice(0, MAX_TERMS)
    .sort((a, b) => b.term.length - a.term.length || Math.abs(b.score) - Math.abs(a.score));
}

async function model() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  if (!pending) pending = (async () => {
    try {
      const loaded = await loadCsv();
      const rows = csvObjects(loaded.text);
      const entries = train(rows);
      cached = { entries, url: loaded.url, rows: rows.length, trainedAt: new Date().toISOString() };
      cachedAt = Date.now();
      status = { ok: true, source: loaded.url, trainedAt: cached.trainedAt, rows: rows.length, terms: entries.length, error: null };
      return cached;
    } catch (e) {
      status = { ok: false, source: "KoreanSentimentAnalyzer/dic/polarity.csv", trainedAt: null, rows: 0, terms: 0, error: e.message || "load failed" };
      throw e;
    } finally { pending = null; }
  })();
  return pending;
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function classify(m, text) {
  const body = compact(text);
  if (!body) return { label: "neutral", score: 0, probability: 0.5, confidenceGap: 0, matchedTerms: [] };
  const used = new Array(body.length).fill(false);
  const hits = [];
  let score = 0, plus = 0, minus = 0;
  for (const e of m.entries) {
    let at = body.indexOf(e.term);
    while (at !== -1) {
      const end = at + e.term.length;
      let overlap = 0;
      for (let i = at; i < end; i++) if (used[i]) overlap++;
      if (overlap / e.term.length <= 0.35) {
        for (let i = at; i < end; i++) used[i] = true;
        const value = e.score * (1 + Math.min(0.35, e.term.length * 0.025));
        score += value;
        if (value > 0) plus += value; else minus += Math.abs(value);
        hits.push(e);
        break;
      }
      at = body.indexOf(e.term, at + 1);
    }
    if (hits.length >= 80) break;
  }
  if (!hits.length) return { label: "neutral", score: 0, probability: 0.5, confidenceGap: 0, matchedTerms: [] };
  const probability = sigmoid(score / Math.sqrt(hits.length + 3));
  const gap = Math.abs(probability - 0.5);
  let label = probability >= 0.5 ? "positive" : "negative";
  if (gap < 0.055 || Math.abs(plus - minus) < 0.28) label = "neutral";
  return { label, score: Number(score.toFixed(4)), probability: Number(probability.toFixed(4)), confidenceGap: Number(gap.toFixed(4)), matchedTerms: hits.slice(0, 12).map(x => [x.term, Number(x.score.toFixed(3))]) };
}

export async function analyzeSentiment(text) {
  try {
    const m = await model();
    return { ...classify(m, text), source: "KoreanSentimentAnalyzer-polarity-dic", model: "polarity-ngram-model", training: status };
  } catch (e) {
    return { label: "neutral", source: "polarity-dic-load-error", score: 0, probability: 0.5, confidenceGap: 0, matchedTerms: [], model: "neutral", training: { ...status, error: e.message || status.error } };
  }
}

export function getSentimentTrainingStatus() { return status; }
