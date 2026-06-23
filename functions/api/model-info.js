import { getSentimentTrainingStatus } from "../lib/sentiment.js";
import { json } from "../lib/common.js";

export async function onRequestGet() {
  return json({ ok: true, training: getSentimentTrainingStatus() });
}
