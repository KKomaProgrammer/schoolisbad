import { json } from "../../lib/common.js";

export async function onRequestPost() {
  return json({ ok: false }, 501);
}
