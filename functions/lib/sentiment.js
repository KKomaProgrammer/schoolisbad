const DATA_CSV_URL = "https://github.com/github-jademon/SentimentAI/raw/refs/heads/main/data.csv";
const CACHE_MS = 1000 * 60 * 60 * 12;
const MAX_LEN = 80;
const MIN_CONFIDENCE_GAP = 0.08;

const SENTIMENT_AI_LABEL_MAP = {
  happiness: 1,
  angry: 0,
  anger: 0,
  disgust: 0,
  fear: 0,
  neutral: 0.5,
  sadness: 0,
  sad: 0,
  surprise: 0.5,
  "0": 0,
  "1": 1,
};

let cachedModel = null;
let cachedAt = 0;
let buildPromise = null;
let lastStatus = {
  ok: false,
  source: "not-built",
  trainedAt: null,
  docs: 0,
  vocab: 0,
  error: null,
};

function normalizeText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^0-9a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenize(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const words = normalized.split(" ").filter(Boolean);
  const tokens = [];

  for (const word of words) {
    tokens.push(word);
    if (word.length >= 2) {
      for (let size = 2; size <= Math.min(5, word.length); size++) {
        for (let i = 0; i <= word.length - size; i++) tokens.push(word.slice(i, i + size));
      }
    }
  }

  return [...new Set(tokens)].slice(0, MAX_LEN);
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function normalizeTrainingValue(label) {
  const raw = String(label || "").trim().toLowerCase();
  return SENTIMENT_AI_LABEL_MAP[raw];
}

function findIndex(headers, names, fallback) {
  const normalized = headers.map((header) => String(header || "").replace(/^\uFEFF/, "").trim());
  for (const name of names) {
    const index = normalized.findIndex((header) => header === name || header.toLowerCase() === name.toLowerCase());
    if (index >= 0) return index;
  }
  return fallback;
}

async function fetchCsv() {
  const res = await fetch(DATA_CSV_URL, {
    headers: { "user-agent": "schoolisbad-cloudflare-pages" },
    cf: { cacheTtl: 60 * 60 * 12, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`data.csv fetch failed: ${res.status}`);
  return await res.text();
}

function createEmptyCounter() {
  return { positive: new Map(), negative: new Map() };
}

function trainFromCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("data.csv rows not found");

  const headers = rows[0];
  const textIndex = findIndex(headers, ["발화문", "text", "sentence", "utterance"], 0);
  const labelIndex = findIndex(headers, ["상황", "label", "sentiment", "emotion"], 1);
  const counts = createEmptyCounter();
  const docCounts = { positive: 0, negative: 0 };
  const tokenTotals = { positive: 0, negative: 0 };
  const vocab = new Set();
  const seen = new Set();
  let skippedNeutral = 0;
  let skippedDuplicate = 0;

  for (const row of rows.slice(1)) {
    const text = String(row[textIndex] || "").trim();
    const mapped = normalizeTrainingValue(row[labelIndex]);
    if (!text || mapped === undefined) continue;
    if (mapped === 0.5) {
      skippedNeutral += 1;
      continue;
    }
    const normalized = normalizeText(text);
    if (seen.has(normalized)) {
      skippedDuplicate += 1;
      continue;
    }
    seen.add(normalized);

    const label = mapped === 1 ? "positive" : "negative";
    const tokens = tokenize(text);
    if (!tokens.length) continue;

    docCounts[label] += 1;
    tokenTotals[label] += tokens.length;
    for (const token of tokens) {
      vocab.add(token);
      counts[label].set(token, (counts[label].get(token) || 0) + 1);
    }
  }

  if (!docCounts.positive || !docCounts.negative) throw new Error("not enough positive/negative training data");

  return {
    counts,
    docCounts,
    tokenTotals,
    vocab,
    docs: docCounts.positive + docCounts.negative,
    skippedNeutral,
    skippedDuplicate,
    trainedAt: new Date().toISOString(),
  };
}

async function getModel() {
  if (cachedModel && Date.now() - cachedAt < CACHE_MS) return cachedModel;
  if (!buildPromise) {
    buildPromise = (async () => {
      try {
        const csvText = await fetchCsv();
        const model = trainFromCsv(csvText);
        cachedModel = model;
        cachedAt = Date.now();
        lastStatus = {
          ok: true,
          source: DATA_CSV_URL,
          trainedAt: model.trainedAt,
          docs: model.docs,
          positiveDocs: model.docCounts.positive,
          negativeDocs: model.docCounts.negative,
          skippedNeutral: model.skippedNeutral,
          skippedDuplicate: model.skippedDuplicate,
          vocab: model.vocab.size,
          error: null,
        };
        return model;
      } catch (error) {
        lastStatus = {
          ok: false,
          source: DATA_CSV_URL,
          trainedAt: null,
          docs: 0,
          vocab: 0,
          error: error.message || "training failed",
        };
        throw error;
      } finally {
        buildPromise = null;
      }
    })();
  }
  return await buildPromise;
}

function logScore(model, tokens, label) {
  const other = label === "positive" ? "negative" : "positive";
  const vocabSize = Math.max(1, model.vocab.size);
  const totalDocs = model.docCounts.positive + model.docCounts.negative;
  let score = Math.log((model.docCounts[label] + 1) / (totalDocs + 2));
  const denominator = model.tokenTotals[label] + vocabSize;

  for (const token of tokens) {
    const count = model.counts[label].get(token) || 0;
    const otherCount = model.counts[other].get(token) || 0;
    const tokenWeight = otherCount === 0 && count > 0 ? 1.35 : 1;
    score += Math.log((count + 1) / denominator) * tokenWeight;
  }

  return score;
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function classifyWithModel(model, text) {
  const tokens = tokenize(text);
  if (!tokens.length) {
    return { label: "neutral", score: 0, probability: 0.5, confidenceGap: 0, matchedTokens: 0 };
  }

  const positiveScore = logScore(model, tokens, "positive");
  const negativeScore = logScore(model, tokens, "negative");
  const probability = sigmoid((positiveScore - negativeScore) / Math.max(1, tokens.length));
  const confidenceGap = Math.abs(probability - 0.5);
  let label = probability >= 0.5 ? "positive" : "negative";

  if (confidenceGap < MIN_CONFIDENCE_GAP) label = "neutral";

  return {
    label,
    score: Number((positiveScore - negativeScore).toFixed(4)),
    probability: Number(probability.toFixed(4)),
    confidenceGap: Number(confidenceGap.toFixed(4)),
    matchedTokens: tokens.filter((token) => model.vocab.has(token)).length,
  };
}

function fallback(text, error) {
  const tokens = tokenize(text);
  const issueTerms = ["학교", "사교육", "학원", "입시", "성적", "경쟁", "주입식", "진도", "체험학습", "압박", "불안", "문제", "비판", "규탄"];
  const hits = tokens.filter((token) => issueTerms.includes(token)).length;
  return {
    label: hits ? "negative" : "neutral",
    source: "fallback-after-training-error",
    score: -hits,
    probability: hits ? 0.2 : 0.5,
    confidenceGap: hits ? 0.3 : 0,
    matchedTokens: hits,
    model: "fallback",
    training: { ...lastStatus, error: error?.message || lastStatus.error },
  };
}

export async function analyzeSentiment(text) {
  try {
    const model = await getModel();
    const result = classifyWithModel(model, text);
    return {
      ...result,
      source: "sentimentai-data-csv-trained",
      model: "SentimentAI data.csv + tokenizer + padded-token Naive Bayes edge trainer",
      training: lastStatus,
    };
  } catch (error) {
    return fallback(text, error);
  }
}

export function getSentimentTrainingStatus() {
  return lastStatus;
}
