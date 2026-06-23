import { analyzeSentiment, getSentimentTrainingStatus } from "../lib/sentiment.js";
import { json } from "../lib/common.js";

export async function onRequestGet() {
  const current = getSentimentTrainingStatus();
  if (!current.ok) await analyzeSentiment("sample");
  return json({ ok: true, training: getSentimentTrainingStatus() });
}
