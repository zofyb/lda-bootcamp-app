// LIVEdream Academy · Lark-Bot
// Liest Nachrichten, die in die eigene Lark-Gruppe weitergeleitet werden, und legt daraus
// einen Kampagnen-Entwurf im App-Kalender an. Die Leitung gibt ihn in der App frei.
//
// Geheimnisse (Supabase > Edge Functions > Secrets):
//   LARK_APP_ID, LARK_APP_SECRET, LARK_VERIFICATION_TOKEN   (Pflicht)
//   LARK_ENCRYPT_KEY   (nur falls in Lark ein "Encrypt Key" gesetzt ist)
//   LARK_BASE          (optional, Standard https://open.larksuite.com; für Feishu https://open.feishu.cn)
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase selbst bereit.
// Wichtig: In den Einstellungen der Funktion "Verify JWT" AUSschalten (Lark schickt kein Supabase-Login).

const env = (k: string) => Deno.env.get(k) ?? "";
const LARK = (env("LARK_BASE") || "https://open.larksuite.com").replace(/\/$/, "");
const SB = env("SUPABASE_URL");
const SBKEY = env("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = "unterlagen";

// ---------- Lark: Entschlüsseln, Token, API ----------
async function decrypt(enc: string, key: string) {
  const raw = Uint8Array.from(atob(enc), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const ck = await crypto.subtle.importKey("raw", k, { name: "AES-CBC" }, false, ["decrypt"]);
  const out = await crypto.subtle.decrypt({ name: "AES-CBC", iv: raw.slice(0, 16) }, ck, raw.slice(16));
  return JSON.parse(new TextDecoder().decode(out));
}

let tok = { v: "", until: 0 };
async function token() {
  if (tok.v && Date.now() < tok.until) return tok.v;
  const r = await fetch(`${LARK}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: env("LARK_APP_ID"), app_secret: env("LARK_APP_SECRET") }),
  });
  const j = await r.json();
  if (!j.tenant_access_token) throw new Error("Lark-Token fehlt: " + (j.msg || r.status));
  tok = { v: j.tenant_access_token, until: Date.now() + (Math.max(60, (j.expire || 7200) - 300)) * 1000 };
  return tok.v;
}
async function lark(path: string, init: RequestInit = {}) {
  const r = await fetch(`${LARK}/open-apis${path}`, {
    ...init, headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
  return r;
}
async function reply(chatId: string, text: string) {
  try {
    await lark(`/im/v1/messages?receive_id_type=chat_id`, {
      method: "POST", body: JSON.stringify({ receive_id: chatId, msg_type: "text", content: JSON.stringify({ text }) }),
    });
  } catch (_) { /* Antwort ist nur ein Hinweis, darf nicht scheitern */ }
}

// ---------- Inhalt einer Nachricht lesen ----------
type Msg = { message_id: string; msg_type?: string; message_type?: string; content?: string; body?: { content: string } };
type Got = { text: string[]; images: { msg: string; key: string }[]; trace: string[]; raw?: string };

function readOne(m: Msg, got: Got) {
  const type = m.msg_type || m.message_type || "";
  let c: any = {};
  try { c = JSON.parse(m.content ?? m.body?.content ?? "{}"); } catch (_) { c = {}; }
  if (type === "text") got.text.push(String(c.text || "").replace(/@_user_\d+\s?/g, ""));
  else if (type === "image" && c.image_key) got.images.push({ msg: m.message_id, key: c.image_key });
  else if (type === "post") {
    const p = c.content ? c : (Object.values(c)[0] as any) || {};
    const lines: string[] = [];
    if (p.title) lines.push(p.title);
    for (const row of p.content || []) {
      let l = "";
      for (const el of row || []) {
        if (el.tag === "text" || el.tag === "md") l += el.text || "";
        else if (el.tag === "a") l += el.href && el.text && el.text !== el.href ? `${el.text} ${el.href}` : (el.href || el.text || "");
        else if (el.tag === "img" && el.image_key) got.images.push({ msg: m.message_id, key: el.image_key });
        else if (el.tag === "emotion") l += "";
      }
      lines.push(l);
    }
    got.text.push(lines.join("\n"));
  } else if (type === "interactive") {
    got.raw = String(m.content ?? m.body?.content ?? "").slice(0, 400);
    // Karten-Nachricht: alle Texte und Links einsammeln
    const seen = new Set<string>(), out: string[] = [];
    const walk = (v: any, k = "") => {
      if (typeof v === "string") {
        const s = v.trim();
        if (s && (["content", "text", "title", "url", "href", "default_url"].includes(k)) && !seen.has(s)) { seen.add(s); out.push(s); }
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
      else if (v && typeof v === "object") {
        if (v.img_key && typeof v.img_key === "string") got.images.push({ msg: m.message_id, key: v.img_key });
        if (v.image_key && typeof v.image_key === "string") got.images.push({ msg: m.message_id, key: v.image_key });
        for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
      }
    };
    walk(c);
    got.text.push(out.join("\n"));
  } else got.trace.push(`(nicht lesbar: ${type})`);
}

async function readMessage(ev: any): Promise<Got> {
  const got: Got = { text: [], images: [], trace: [] };
  const seen = new Set<string>();
  // Weitergeleitete Nachrichten (auch mehrfach weitergeleitet): Unter-Nachrichten über die API holen
  const walk = async (m: Msg, depth: number) => {
    const type = m.msg_type || m.message_type || "?";
    if (type !== "merge_forward") { got.trace.push(type); return readOne(m, got); }
    if (depth > 3 || seen.has(m.message_id)) return;
    seen.add(m.message_id);
    const r = await lark(`/im/v1/messages/${m.message_id}?card_msg_content_type=raw_card_content`);
    const j = await r.json().catch(() => ({}));
    if (j.code) { got.trace.push(`Fehler ${j.code} ${String(j.msg || "").slice(0, 60)}`); return; }
    const items = (j?.data?.items || []).filter((it: any) => it.message_id !== m.message_id);
    got.trace.push(`weitergeleitet (${items.length})`);
    for (const it of items) await walk(it, depth + 1);
  };
  await walk(ev.message, 0);
  got.text = got.text.map((t) => t.trim()).filter(Boolean);
  return got;
}

// ---------- Titel, Daten, Link erkennen (wie "Erkennen" in der App) ----------
const MONTH: Record<string, number> = { jan: 0, januar: 0, january: 0, feb: 1, februar: 1, february: 1, "mär": 2, maerz: 2, "märz": 2, mar: 2, march: 2, apr: 3, april: 3, mai: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, okt: 9, oct: 9, oktober: 9, october: 9, nov: 10, november: 10, dez: 11, dec: 11, dezember: 11, december: 11 };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function berlinToday() {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d);
}
function parse(text: string) {
  const t = String(text || ""), out: any = { body: t.trim().slice(0, 8000) };
  const link = t.match(/https?:\/\/[^\s)\]>]+/); if (link) out.link = link[0];
  const lines = t.split(/\n/).map((l) => l.replace(/[*#_`【】\[\]]/g, "").replace(/^[^\p{L}\p{N}]+/u, "").trim())
    .filter((l) => l && !/^https?:/.test(l) && !/^merged and forwarded/i.test(l));
  out.title = (lines[0] || "Kampagne aus Lark").replace(/\s*[:：]\s*$/, "").slice(0, 120);
  const now = berlinToday(), ds: Date[] = [];
  const add = (y: number, m: number, d: number) => {
    if (m < 0 || m > 11 || d < 1 || d > 31) return;
    const yy = y ? (y < 100 ? 2000 + y : y) : now.getFullYear();
    let dt = new Date(yy, m, d);
    if (!y && dt < new Date(now.getFullYear(), now.getMonth() - 2, 1)) dt = new Date(yy + 1, m, d);
    ds.push(dt);
  };
  const rx = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?|(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]{3,9})\.?(?:\s+(\d{4}))?|([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?|(\d{4})\/(\d{1,2})\/(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  let mm: RegExpExecArray | null;
  while ((mm = rx.exec(t))) {
    if (mm[1]) add(+mm[1], +mm[2] - 1, +mm[3]);
    else if (mm[4]) add(mm[6] ? +mm[6] : 0, +mm[5] - 1, +mm[4]);
    else if (mm[7]) { const k = MONTH[mm[8].toLowerCase()]; if (k !== undefined) add(mm[9] ? +mm[9] : 0, k, +mm[7]); }
    else if (mm[10]) { const k = MONTH[mm[10].toLowerCase()]; if (k !== undefined) add(mm[12] ? +mm[12] : 0, k, +mm[11]); }
    else if (mm[13]) add(+mm[13], +mm[14] - 1, +mm[15]);
    else if (mm[16]) add(+mm[18], +mm[17] - 1, +mm[16]);
  }
  out.dated = ds.length > 0;
  if (ds.length) { ds.sort((a, b) => +a - +b); out.starts = iso(ds[0]); out.ends = iso(ds[ds.length - 1]); }
  else { out.starts = out.ends = iso(now); }
  out.kind = /livedream|agentur intern|unsere eigene/i.test(t) ? "livedream" : "tiktok";
  return out;
}

// ---------- Supabase ----------
async function db(path: string, init: RequestInit = {}) {
  return fetch(`${SB}/rest/v1/${path}`, {
    ...init, headers: { apikey: SBKEY, authorization: `Bearer ${SBKEY}`, "content-type": "application/json", ...(init.headers || {}) },
  });
}
async function saveImage(img: { msg: string; key: string }, name: string) {
  const r = await lark(`/im/v1/messages/${img.msg}/resources/${img.key}?type=image`);
  if (!r.ok) { imgErr = `Bild ${r.status} ${(await r.text()).slice(0, 80)}`; return null; }
  const type = r.headers.get("content-type") || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "jpg";
  const path = `kalender-lark-${name}.${ext}`;
  const up = await fetch(`${SB}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST", headers: { apikey: SBKEY, authorization: `Bearer ${SBKEY}`, "content-type": type, "x-upsert": "true" }, body: await r.arrayBuffer(),
  });
  if (!up.ok) { imgErr = `Bild-Upload ${up.status} ${(await up.text()).slice(0, 80)}`; return null; }
  return path;
}
let imgErr = "";
const safe = (s: string) => s.replace(/[^\w-]+/g, "_").slice(-60);

async function handle(ev: any) {
  const m = ev.message, chat = m.chat_id;
  if (ev.sender?.sender_type === "app") return; // eigene Antworten ignorieren
  const got = await readMessage(ev);

  // Nur ein Bild: an den jüngsten Lark-Entwurf ohne Bild (letzte 15 Minuten) hängen
  if (!got.text.length) {
    if (!got.images.length) return reply(chat, `⚠️ Kein Text gefunden. Gelesen: ${got.trace.join(", ") || "nichts"}`);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const r = await db(`calendar?select=id,title&source=eq.lark&status=eq.draft&image=is.null&created_at=gte.${since}&order=created_at.desc&limit=1`);
    const last = (await r.json())?.[0];
    if (!last) return reply(chat, "Bild erhalten, aber kein passender Entwurf gefunden. Bitte zuerst den Kampagnen-Text weiterleiten.");
    const p = await saveImage(got.images[0], safe(m.message_id));
    if (p) { await db(`calendar?id=eq.${last.id}`, { method: "PATCH", body: JSON.stringify({ image: p }) }); await reply(chat, `🖼️ Bild zu „${last.title}“ hinzugefügt.`); }
    return;
  }

  const p = parse(got.text.join("\n\n"));
  const row: any = { audience: "all", kind: p.kind, title: p.title, starts: p.starts, ends: p.ends, body: p.body, link: p.link || null,
    status: "draft", source: "lark", lark_msg_id: m.message_id, created_by: "Lark-Bot" };
  imgErr = "";
  if (got.images.length) row.image = await saveImage(got.images[0], safe(m.message_id));
  if (imgErr) got.trace.push(imgErr.includes("234043") ? "Bild aus Karte nicht ladbar, Bild bitte einzeln hinterherschicken" : imgErr);
  const r = await db(`calendar?on_conflict=lark_msg_id`, {
    method: "POST", headers: { prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(row),
  });
  if (!r.ok) { console.error("Speichern fehlgeschlagen", r.status, await r.text()); return reply(chat, "⚠️ Konnte den Entwurf nicht speichern. Ist update-12-lark.sql in Supabase ausgeführt?"); }
  const saved = await r.json();
  if (!saved?.length) return; // schon verarbeitet (Lark schickt manchmal doppelt)
  const d = (s: string) => s.split("-").reverse().join(".");
  await reply(chat, `✅ Entwurf angelegt: „${p.title}“ · ${p.starts === p.ends ? d(p.starts) : `${d(p.starts)} bis ${d(p.ends)}`}` +
    (p.dated ? "" : " (kein Datum erkannt, bitte prüfen)") + (row.image ? " · mit Bild" : "") + "\nIn der App unter Kalender > Neu aus Lark prüfen und freigeben." +
    `\n(Gelesen: ${got.trace.join(", ")})` + (!p.dated && got.raw ? `\nRohdaten: ${got.raw}` : ""));
}

// ---------- Eingang ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    // Selbsttest im Browser: .../lark-bot?check zeigt, welche Geheimnisse gesetzt sind (ohne Werte)
    const t = env("LARK_VERIFICATION_TOKEN").trim();
    return Response.json({ bot: "LIVEdream Lark-Bot läuft", LARK_APP_ID: !!env("LARK_APP_ID"), LARK_APP_SECRET: !!env("LARK_APP_SECRET"),
      LARK_VERIFICATION_TOKEN: t ? `gesetzt, ${t.length} Zeichen` : "FEHLT", LARK_ENCRYPT_KEY: !!env("LARK_ENCRYPT_KEY"),
      service_key: !!SBKEY });
  }
  let body: any;
  try { body = await req.json(); } catch (_) { return Response.json({ error: "bad json" }, { status: 400 }); }
  try { if (body.encrypt) body = await decrypt(body.encrypt, env("LARK_ENCRYPT_KEY").trim()); }
  catch (_) { console.error("Entschlüsseln fehlgeschlagen: LARK_ENCRYPT_KEY prüfen"); return Response.json({ error: "decrypt failed" }, { status: 400 }); }

  // Adress-Prüfung von Lark: nur die Challenge zurückgeben (harmlos, enthält keine Daten)
  if (body.type === "url_verification") return Response.json({ challenge: body.challenge });

  const want = env("LARK_VERIFICATION_TOKEN").trim(), tokenIn = String(body.token ?? body.header?.token ?? "").trim();
  if (!want || tokenIn !== want) {
    console.error(`Token passt nicht: Lark schickt ${tokenIn.length} Zeichen (${tokenIn.slice(0, 3)}…), Supabase hat ${want.length} (${want.slice(0, 3)}…)`);
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (body.header?.event_type === "im.message.receive_v1" && body.event?.message) {
    const job = handle(body.event).catch((e) => console.error("Lark-Bot Fehler", e));
    // Lark will innerhalb von 3 Sekunden eine Antwort, die Arbeit läuft danach weiter
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(job); else await job;
  }
  return Response.json({ ok: true });
});
