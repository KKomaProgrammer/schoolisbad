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

const TOKEN_WEIGHTS = new Map(Object.entries({
  "위기": -3.2,
  "불안": -2.8,
  "우울": -2.8,
  "고통": -2.7,
  "괴롭힘": -2.6,
  "폭력": -2.5,
  "학폭": -2.5,
  "압박": -2.4,
  "강요": -2.3,
  "통제": -2.2,
  "억압": -2.2,
  "차별": -2.1,
  "불공정": -2.1,
  "피해": -2.0,
  "입시지옥": -2.0,
  "주입식": -2.0,
  "사교육": -1.9,
  "학원": -1.8,
  "입시": -1.8,
  "경쟁": -1.7,
  "줄세우기": -1.7,
  "성적": -1.5,
  "등수": -1.5,
  "진도": -1.5,
  "암기": -1.4,
  "체험학습": -1.3,
  "취소": -1.3,
  "민원": -1.2,
  "책임회피": -1.2,
  "과열": -1.2,
  "부담": -1.2,
  "불행": -1.2,
  "무기력": -1.1,
  "번아웃": -1.1,
  "문제": -1.0,
  "비판": -1.0,
  "규탄": -1.0,
  "바꿔야": -0.8,
  "개선": -0.6,
  "침묵": -0.6,
  "기록": -0.3,
  "좋다": 2.0,
  "좋은": 1.8,
  "행복": 2.1,
  "만족": 1.9,
  "감사": 1.8,
  "최고": 2.2,
  "훌륭": 2.0,
  "재미": 1.5,
  "추천": 1.6,
  "완벽": 2.3,
  "괜찮": 1.2,
  "성공": 1.4,
}));

const NEGATION_HINTS = ["아니다", "아니", "없다", "없음", "못", "않", "그만", "폐지", "반대"];
const MAX_LEN = 48;

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
    if (word.length >= 3) {
      for (let size = 2; size <= Math.min(5, word.length); size++) {
        for (let i = 0; i <= word.length - size; i++) tokens.push(word.slice(i, i + size));
      }
    }
  }

  return [...new Set(tokens)];
}

function padSequence(tokens, maxLen = MAX_LEN) {
  const sequence = tokens.slice(0, maxLen);
  while (sequence.length < maxLen) sequence.unshift("<PAD>");
  return sequence;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function hasNegationNear(text, token) {
  const index = text.indexOf(token);
  if (index < 0) return false;
  const windowText = text.slice(Math.max(0, index - 10), Math.min(text.length, index + token.length + 10));
  return NEGATION_HINTS.some((hint) => windowText.includes(hint));
}

function sequenceScore(text) {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const sequence = padSequence(tokens);
  let raw = 0;
  let hits = 0;

  for (const token of sequence) {
    if (token === "<PAD>") continue;
    let weight = TOKEN_WEIGHTS.get(token) || 0;
    if (weight > 0 && hasNegationNear(normalized, token)) weight *= -0.75;
    if (weight !== 0) {
      raw += weight;
      hits += 1;
    }
  }

  const densityPenalty = Math.max(0, tokens.length - hits) * 0.015;
  return raw - densityPenalty;
}

function toLabel(probability, rawScore) {
  if (probability >= 0.64 && rawScore > 0.8) return "positive";
  if (probability <= 0.43 && rawScore < -0.45) return "negative";
  return "neutral";
}

export function normalizeTrainingLabel(label) {
  const mapped = SENTIMENT_AI_LABEL_MAP[String(label || "").toLowerCase()];
  if (mapped === 1) return "positive";
  if (mapped === 0) return "negative";
  return "neutral";
}

export async function analyzeSentiment(text) {
  const rawScore = sequenceScore(text);
  const probability = sigmoid(rawScore / 3);
  const label = toLabel(probability, rawScore);

  return {
    label,
    source: "sentimentai-js-port",
    score: Number(rawScore.toFixed(4)),
    probability: Number(probability.toFixed(4)),
    model: "Tokenizer+padSequence+sigmoid-compatible edge port",
  };
}
