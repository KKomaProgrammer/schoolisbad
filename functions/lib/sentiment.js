const NEGATIVE_WORDS = [
  "문제", "비판", "규탄", "불안", "우울", "자살", "압박", "강요", "차별", "불공정", "주입식", "경쟁", "고통",
  "스트레스", "사교육", "학원", "취소", "통제", "폭력", "괴롭힘", "번아웃", "무기력", "입시", "줄세우기",
  "비정상", "부담", "과열", "망가", "싫", "힘들", "지옥", "불행", "억압", "불만", "피해", "부정"
];

const POSITIVE_WORDS = [
  "좋다", "좋은", "행복", "만족", "감사", "최고", "훌륭", "긍정", "추천", "재미", "기쁘", "괜찮", "성공", "완벽"
];

function normalizeLabel(label) {
  const raw = String(label || "neutral").toLowerCase().trim();
  if (["negative", "부정", "0", "bad"].includes(raw)) return "negative";
  if (["positive", "긍정", "1", "good"].includes(raw)) return "positive";
  return "neutral";
}

async function analyzeWithExternalSentimentAI(text, env) {
  if (!env.SENTIMENT_AI_URL) return null;
  try {
    const res = await fetch(env.SENTIMENT_AI_URL, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const label = normalizeLabel(data.label || data.sentiment || data.result || data.prediction);
    return { label, source: "SentimentAI", score: Number(data.score ?? 0) };
  } catch {
    return null;
  }
}

function analyzeWithEdgeFallback(text) {
  const compact = text.replace(/\s+/g, " ").toLowerCase();
  let score = 0;
  for (const word of NEGATIVE_WORDS) {
    if (compact.includes(word.toLowerCase())) score -= 1;
  }
  for (const word of POSITIVE_WORDS) {
    if (compact.includes(word.toLowerCase())) score += 1;
  }

  if (score <= -1) return { label: "negative", source: "edge-fallback", score };
  if (score >= 2) return { label: "positive", source: "edge-fallback", score };
  return { label: "neutral", source: "edge-fallback", score };
}

export async function analyzeSentiment(text, env) {
  return (await analyzeWithExternalSentimentAI(text, env)) || analyzeWithEdgeFallback(text);
}
