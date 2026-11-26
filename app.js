/* LIVEdream Creator Bootcamp – App (ohne Build-Schritt, läuft als statische Seite) */
(() => {
"use strict";
const CFG = window.BOOTCAMP_CONFIG || {};
const MAX_FILE = 50 * 1024 * 1024;
const DAY = 864e5;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const view = $("#view"), who = $("#who"), tabsEl = $("#tabs");

let sb = null;
const S = { session:null, me:null, real:null, viewAs:"", areas:[], members:[], subs:[], progress:[], activity:[], settings:{},
  needsUpdate:false, tab:null, openArea:null, creator:null, pending:{}, editMember:null, editArea:1, confirmDelete:null,
  busy:false, quiz:{}, ringShown:false, localProg:{}, justUnlocked:null };

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,3400); }
function fail(e){ console.error(e); toast("Fehler: " + (e?.message || e)); }

/* ---------- Hilfen ---------- */
const lc = s => String(s||"").trim().toLowerCase();
const list = x => Array.isArray(x) ? x : [];
const member = email => S.members.find(m => m.email === email);
const label = m => m ? (m.handle ? "@" + m.handle.replace(/^@/,"") : m.name) : "";
const firstName = m => String(m?.name || m?.handle || "").trim().split(/\s+/)[0] || "du";
const subOf = (email, n) => S.subs.find(s => s.creator_email === email && s.area === n);
const total = email => S.subs.filter(s => s.creator_email === email).reduce((a,s)=>a+(s.points||0),0);
const creators = () => S.members.filter(m => m.role === "creator");
const myCreators = () => S.me.role === "lead" ? creators() : creators().filter(c => c.manager_email === S.me.email);
const maxPts = () => S.areas.length * 2;
const readOnly = () => !!(S.viewAs && S.me.role === "creator");
const pad = n => String(n).padStart(2,"0");
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const WD = ["So.","Mo.","Di.","Mi.","Do.","Fr.","Sa."];
const fmtD = d => `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth()+1}.`;
const fmtAgo = ts => { const h=Math.round((Date.now()-new Date(ts))/36e5); return h<1?"gerade eben":h<24?`vor ${h} Std.`:`vor ${Math.round(h/24)} Tg.`; };

/* ---------- Wochen & Freischaltung ---------- */
function startDate(){ const v=S.settings.start; if(!v||!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null; const [y,m,d]=v.split("-").map(Number); return new Date(y,m-1,d,0,0,0); }
function weekOpens(w){ const s=startDate(); if(!s) return null; const d=new Date(s); d.setDate(d.getDate()+(w-1)*7); return d; }
function weekEnds(w){ const o=weekOpens(w); if(!o) return null; const d=new Date(o); d.setDate(d.getDate()+6); return d; }
const weeks = () => [...new Set(S.areas.map(a=>a.week))].sort((a,b)=>a-b);

function areaState(email, a){
  const s = subOf(email, a.n);
  if (s && s.points != null) return "done";
  if (s) return "wait";
  if (S.me.preview) return "open";
  const o = weekOpens(a.week);
  if (o && Date.now() < o.getTime()) return "time";
  const prev = S.areas.filter(x => x.n < a.n).pop();
  if (prev && !subOf(email, prev.n)) return "lock";
  return "open";
}
const quizOf = a => list(a?.quiz).filter(x => x && x.q && list(x.a).length >= 2);
function progOf(email, n){ return S.progress.find(p => p.creator_email===email && p.area===n) || {}; }
function stepsDone(email, a){
  if (subOf(email, a.n)) return [true, true, true];
  const p = progOf(email, a.n), L = S.localProg;
  const v = !a.video_url || !!p.video_at || !!L[`video_at-${email}-${a.n}`];
  const q = !quizOf(a).length || !!p.quiz_at || !!L[`quiz_at-${email}-${a.n}`];
  const h = !a.handout_path || !!p.handout_at || !!L[`handout_at-${email}-${a.n}`];
  return [v, v && q, v && q && h];
}

/* ---------- Streak & Abzeichen ---------- */
function streakInfo(email){
  const days = new Set(S.activity.filter(x=>x.creator_email===email).map(x=>x.day));
  let cur=0; const d=new Date(); d.setHours(12,0,0,0);
  if (!days.has(isoDay(d))) d.setDate(d.getDate()-1);
  while (days.has(isoDay(d))) { cur++; d.setDate(d.getDate()-1); }
  let best=0, run=0, last=null;
  for (const x of [...days].sort()){ const t=new Date(x+"T12:00:00").getTime(); run = last && Math.round((t-last)/DAY)===1 ? run+1 : 1; best=Math.max(best,run); last=t; }
  return { cur, best };
}
const BADGES = [
  ["first","🚀","Erstes Thema abgegeben"],
  ["week1","🏅","Woche 1 geschafft"],
  ["streak","🔥","3 Tage am Stück dabei"],
  ["half","⭐","4 Themen abgegeben"],
  ["pass","👑","10 Punkte erreicht"],
  ["all","🏆","Alle Themen abgegeben"]
];
function badgesFor(email){
  const subs=S.subs.filter(s=>s.creator_email===email), w1=S.areas.filter(a=>a.week===1);
  const on = {
    first: subs.length>=1,
    week1: w1.length>0 && w1.every(a=>subOf(email,a.n)),
    streak: streakInfo(email).best>=3,
    half: subs.length>=4,
    pass: total(email)>=10,
    all: S.areas.length>0 && subs.length>=S.areas.length
  };
  return BADGES.map(([k,ic,t]) => ({ k, ic, t, on:!!on[k] }));
}
function storeGet(k){ try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch{ return null; } }
function storeSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
function newBadges(email){
  if (S.viewAs) return new Set();
  const key="ldb-badges-"+email, seen=storeGet(key);
  const now=badgesFor(email).filter(b=>b.on).map(b=>b.k);
  storeSet(key, now);
  if (!seen) return new Set();           // erstes Öffnen: nichts als „neu“ feiern
  return new Set(now.filter(k=>!seen.includes(k)));
}

/* ---------- Video, Handout, Dateien ---------- */
function videoBlock(a){
  const url=a.video_url;
  if (!url) return `<div class="video empty">Das Lehrvideo kommt bald.</div>`;
  const m = url.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  if (m) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1" title="Lehrvideo" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
    <button class="btn ghost" data-seen="${a.n}">Ich habe das Video angesehen</button>`;
  if (/^https:\/\//.test(url)) return `<div class="video"><video src="${esc(url)}" data-area="${a.n}" controls playsinline preload="metadata"></video></div>`;
  if (!/^https?:\/\//.test(url)) return `<div class="video"><video data-video="${esc(url)}" data-area="${a.n}" controls playsinline preload="metadata"></video></div>`;
  return `<div class="video empty">Video-Link ungültig.</div>`;
}
function fileLinks(files){
  return `<div class="files">${list(files).map(f=>`<a data-path="${esc(f.path)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join("") || '<span>Keine Dateien</span>'}</div>`;
}
async function hydrate(){
  const els=[...document.querySelectorAll("a[data-path]:not([href])")];
  if (els.length){
    const paths=[...new Set(els.map(e=>e.dataset.path))];
    const { data } = await sb.storage.from("nachweise").createSignedUrls(paths, 3600);
    const map = Object.fromEntries((data||[]).filter(d=>d.signedUrl).map(d=>[d.path,d.signedUrl]));
    els.forEach(e => { if (map[e.dataset.path]) e.href = map[e.dataset.path]; });
  }
  for (const v of document.querySelectorAll("video[data-video]:not([src])")) {
    const { data:d } = await sb.storage.from("unterlagen").createSignedUrl(v.dataset.video, 6*3600);
    if (d?.signedUrl) v.src = d.signedUrl;
  }
  for (const e of document.querySelectorAll("a[data-handout]:not([href])")) {
    const { data:d } = await sb.storage.from("unterlagen").createSignedUrl(e.dataset.handout, 3600);
    if (d?.signedUrl) e.href = d.signedUrl;
  }
}
function watchVideos(){
  for (const v of document.querySelectorAll("video[data-area]")){
    if (v._w) continue; v._w=true;
    const n=+v.dataset.area;
    const check=()=>{ if (v.duration && v.currentTime/v.duration>=0.9) { v.removeEventListener("timeupdate",check); markStep(n,"video_at"); } };
    v.addEventListener("timeupdate",check);
    v.addEventListener("ended",()=>markStep(n,"video_at"));
  }
}
async function markStep(n, field){
  if (S.me.role!=="creator") return;
  const a=S.areas.find(x=>x.n===n), email=S.me.email, before=stepsDone(email,a);
  const key=field+"-"+email+"-"+n;
  if (readOnly() || S.me.preview || S.needsUpdate) S.localProg[key]=true;
  else {
    const p=progOf(email,n); if (p[field]) return;
    const row={ creator_email:email, area:n, [field]:new Date().toISOString() };
    const { error } = await sb.from("progress").upsert(row, { onConflict:"creator_email,area" });
    if (error) { S.localProg[key]=true; console.warn(error); }
    else { const i=S.progress.findIndex(x=>x.creator_email===email&&x.area===n); if(i<0) S.progress.push(row); else S.progress[i]={...S.progress[i],...row}; }
  }
  const after=stepsDone(email,a);
  if (S.openArea===n){
    const k=after.findIndex((x,i)=>x&&!before[i]);
    if (k>=0){
      const nextName = k===0 ? (quizOf(a).length?"das Quiz":a.handout_path?"das Handout":"deine Aufgabe") : k===1 ? (a.handout_path?"das Handout":"deine Aufgabe") : "deine Aufgabe";
      S.justUnlocked = k===0 ? (quizOf(a).length?"quiz":a.handout_path?"handout":"task") : k===1 ? (a.handout_path?"handout":"task") : "task";
      toast((k===1?"Quiz geschafft! ":"Stark! ")+"Jetzt ist "+nextName+" frei.");
      render(true);
    }
  }
}

/* ---------- Start ---------- */
function drawWave(){
  const svg=$("#wave"); if(!svg) return; let h="";
  for (let i=0;i<12;i++){ const y=290-i*6; h+=`<path d="M-20 ${y} C 110 ${y-20}, 230 ${200-i*8}, 420 ${90-i*6}" fill="none" stroke="${i%4?'#c24fe0':'#FFB017'}" stroke-opacity="${(.06+i*.018).toFixed(3)}" stroke-width="1"/>`; }
  svg.innerHTML=h;
}
async function boot(){
  drawWave();
  if (!window.supabase || !CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes("DEIN-PROJEKT")) {
    view.innerHTML = `<div class="panel stack"><h2>Fast fertig</h2><p class="muted">In <b>config.js</b> fehlen noch die Supabase-Adresse und der öffentliche Schlüssel.</p></div>`; return;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth:{ persistSession:true, detectSessionInUrl:true, flowType:"implicit" } });
  sb.auth.onAuthStateChange((_e, session) => { const changed = session?.user?.email !== S.session?.user?.email; S.session=session; if (changed) load(); });
  const { data } = await sb.auth.getSession(); S.session = data.session; load();
  setInterval(tick, 1000);
}
async function load(){
  if (!S.session) return loginView();
  const email = lc(S.session.user.email);
  view.innerHTML = `<p class="muted">Lädt …</p>`;
  try {
    const { data: me, error } = await sb.from("members").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    $("#toplogo").hidden=false;
    if (!me) { who.innerHTML = `<button class="chip" id="logout">Abmelden</button>`; view.innerHTML = `<div class="panel stack"><h2>Kein Zugang</h2><p class="muted">Die Adresse ${esc(email)} steht nicht auf der Teilnehmerliste. Bitte melde dich bei deinem Manager.</p></div>`; return; }
    S.real = me; S.me = me; S.viewAs = "";
    if (me.role==="creator") {
      const r = await sb.from("activity").upsert({ creator_email:email, day:isoDay(new Date()) }, { onConflict:"creator_email,day", ignoreDuplicates:true });
      if (r?.error) console.warn(r.error);
    }
    await refresh();
    S.tab = S.tab || (me.role === "creator" ? "themen" : me.role === "manager" ? "bewerten" : "uebersicht");
    render();
  } catch(e){ fail(e); }
}
async function refresh(){
  const [a,m,s] = await Promise.all([
    sb.from("areas").select("*").order("n"),
    sb.from("members").select("*").order("name"),
    sb.from("submissions").select("*").order("submitted_at",{ascending:false})
  ]);
  for (const r of [a,m,s]) if (r.error) throw r.error;
  S.areas=a.data||[]; S.members=m.data||[]; S.subs=s.data||[];
  const [p,ac,st] = await Promise.all([ sb.from("progress").select("*"), sb.from("activity").select("*"), sb.from("settings").select("*") ]);
  S.needsUpdate = !!(p.error || ac.error || st.error);
  S.progress = p.data||[]; S.activity = ac.data||[];
  S.settings = Object.fromEntries((st.data||[]).map(r=>[r.key,r.value]));
}

/* ---------- Login ---------- */
function loginView(email="", sent=false, err=""){
  tabsEl.hidden = true; who.innerHTML = ""; $("#switch").hidden=true; $("#toplogo").hidden=true;
  document.querySelector(".wrap").classList.remove("wide");
  view.innerHTML = `<div class="login">
    <img class="logo" src="logo.png" alt="LIVEdream Agency">
    <div class="stack" style="text-align:center"><span class="eyebrow">LIVEdream Creator Bootcamp</span>
    <h1>${sent ? "Schau in dein <em>Postfach</em>" : "Willkommen im <em>Bootcamp</em>"}</h1></div>
    <div class="panel stack">
    <p class="soft">${sent ? `Wir haben dir eine E-Mail an <b>${esc(email)}</b> geschickt. Tippe auf den Link darin oder gib den Code hier ein.` : "Melde dich mit der E-Mail-Adresse an, die du deinem Manager gegeben hast. Du bekommst einen Anmelde-Link, ganz ohne Passwort."}</p>
    ${sent ? `<p class="muted"><b style="color:var(--gold);font-weight:600">Keine Mail da?</b> Schau bitte im Spam-Ordner nach und markiere die Mail als „Kein Spam“. Dann kommt sie beim nächsten Mal normal an.</p>
      <label class="f" for="code">Code aus der E-Mail<input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
      <button class="btn" id="verify">Anmelden</button><button class="btn ghost" id="restart">Andere E-Mail-Adresse</button>`
    : `<label class="f" for="email">E-Mail-Adresse<input id="email" type="email" autocomplete="email" value="${esc(email)}"></label>
      <button class="btn" id="send-link">Anmelde-Link schicken</button>`}
    ${err ? `<p class="err">${esc(err)}</p>` : ""}</div>
  </div>`;
  S._loginEmail = email;
}
async function sendLink(){
  const email = lc($("#email").value);
  if (!/^\S+@\S+\.\S+$/.test(email)) return loginView(email,false,"Bitte eine gültige E-Mail-Adresse eingeben.");
  $("#send-link").disabled = true;
  const { data: ok, error: e1 } = await sb.rpc("is_member", { e: email });
  if (e1) return loginView(email,false,e1.message);
  if (!ok) return loginView(email,false,"Diese Adresse ist nicht freigeschaltet. Bitte frag deinen Manager.");
  const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.origin + location.pathname, shouldCreateUser:true } });
  if (error) return loginView(email,false, error.status===429 ? "Zu viele Versuche. Bitte in ein paar Minuten nochmal." : error.message);
  loginView(email,true);
}
async function verifyCode(){
  const token = $("#code").value.replace(/\s/g,"");
  const { error } = await sb.auth.verifyOtp({ email:S._loginEmail, token, type:"email" });
  if (error) loginView(S._loginEmail,true,"Der Code stimmt nicht oder ist abgelaufen.");
}

/* ---------- Rahmen ---------- */
const TABS = {
  creator: [["themen","Meine Themen"]],
  manager: [["bewerten","Zu bewerten"],["creator","Meine Creator"]],
  lead:    [["uebersicht","Übersicht"],["bewerten","Zu bewerten"],["personen","Teilnehmer"],["themenedit","Themen & Start"]]
};
const ROLE_NAME = { lead:"Agenturleitung", manager:"Manager", creator:"Creator" };
function applyView(){
  const v=S.viewAs;
  if (!v) S.me = S.real;
  else if (v==="__preview") S.me = { email:"__preview", role:"creator", name:"Vorschau", handle:"creator-vorschau", preview:true };
  else S.me = member(v) || S.real;
}
function switcher(){
  if (S.real?.role!=="lead") return "";
  const ms=S.members.filter(m=>m.role==="manager"||(m.role==="lead"&&m.email!==S.real.email&&creators().some(c=>c.manager_email===m.email)));
  const opt=(v,l)=>`<option value="${esc(v)}" ${S.viewAs===v?"selected":""}>${esc(l)}</option>`;
  return `<label class="f" for="viewas">Ansicht<select id="viewas">
    ${opt("","Agenturleitung (alles)")}
    ${ms.length?`<optgroup label="Manager">${ms.map(m=>opt(m.email,"Manager: "+m.name)).join("")}</optgroup>`:""}
    <optgroup label="Creator">${opt("__preview","Creator: Vorschau (alle Themen offen)")}${creators().map(c=>opt(c.email,"Creator: "+label(c))).join("")}</optgroup>
  </select></label>
  ${S.viewAs?`<p class="viewnote">Du siehst die App gerade so wie ${S.viewAs==="__preview"?"ein Creator":esc(S.me.role==="creator"?label(S.me):S.me.name)}.${S.me.role==="creator"?" Abgeben ist hier gesperrt, Video und Handout kannst du durchklicken.":""}</p>`:""}
  ${S.needsUpdate?`<p class="err">Die Datenbank braucht noch das Update (update-2.sql). Bis dahin fehlen Startdatum, Fortschritt und Streak.</p>`:""}`;
}
function render(keepScroll){
  applyView();
  const me=S.me;
  const sw=$("#switch"); sw.innerHTML = switcher(); sw.hidden = !sw.innerHTML.trim();
  const st = me.role==="creator" && !me.preview ? streakInfo(me.email).cur : 0;
  who.innerHTML = `${st?`<span class="chip" title="Tage am Stück dabei">🔥 <b>${st}</b></span>`:""}<span class="chip">${esc(me.role==="creator"?firstName(me):S.real.name)}</span><button class="chip" id="logout">Abmelden</button>`;
  const t = TABS[me.role];
  tabsEl.hidden = t.length < 2 || !!S.openArea;
  tabsEl.innerHTML = t.map(([k,l]) => `<button data-tab="${k}" aria-pressed="${S.tab===k}">${l}</button>`).join("");
  document.querySelector(".wrap").classList.toggle("wide", me.role !== "creator");
  let html;
  if (me.role==="creator") html = S.openArea ? topicView(S.areas.find(a=>a.n===S.openArea)) : creatorHome();
  else if (S.creator) html = creatorDetail(S.creator);
  else html = ({ bewerten:pendingView, creator:managerList, uebersicht:leadOverview, personen:peopleView, themenedit:areaEditor }[S.tab] || pendingView)();
  view.innerHTML = html;
  if (!keepScroll) window.scrollTo(0,0);
  afterRender();
  hydrate().catch(console.error);
}
function afterRender(){
  watchVideos();
  const ring=$(".ring .arc");
  if (ring){
    const target=+ring.dataset.off, full=+ring.dataset.full, val=$(".ring b"), pts=+val.dataset.v;
    if (!S.ringShown){
      S.ringShown=true; ring.style.strokeDashoffset=full; val.textContent="0";
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ ring.style.strokeDashoffset=target; }));
      const t0=performance.now(); const step=t=>{ const k=Math.min(1,(t-t0)/1400); val.textContent=Math.round(pts*(1-Math.pow(1-k,3))); if(k<1) requestAnimationFrame(step); }; requestAnimationFrame(step);
    }
  }
  S.justUnlocked=null;
}

/* ---------- Creator: Start ---------- */
function ringSvg(pts, max){
  const r=44, C=2*Math.PI*r, off=C*(1-Math.min(1,pts/(max||16)));
  const ang=(10/(max||16))*2*Math.PI, mx=50+r*Math.cos(ang), my=50+r*Math.sin(ang);
  return `<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6a8f7"/><stop offset=".5" stop-color="#d6409f"/><stop offset="1" stop-color="#9b2fc9"/></linearGradient></defs>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="8"/>
    <circle class="arc" cx="50" cy="50" r="${r}" fill="none" stroke="url(#rg)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" style="stroke-dashoffset:${off.toFixed(2)}" data-off="${off.toFixed(2)}" data-full="${C.toFixed(2)}"/>
    ${max>=10?`<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="3.4" fill="#FFB017" stroke="#060208" stroke-width="1.5"/>`:""}
  </svg><div class="val"><div><b data-v="${pts}">${pts}</b><small>von ${max} Punkten</small></div></div></div>`;
}
function flipHtml(ms){
  ms=Math.max(0,ms); const d=Math.floor(ms/DAY), h=Math.floor(ms%DAY/36e5), m=Math.floor(ms%36e5/6e4), s=Math.floor(ms%6e4/1e3);
  return [[d,"Tage"],[h,"Std"],[m,"Min"],[s,"Sek"]].map(([v,l])=>`<span data-u="${l}">${pad(v)}<small>${l}</small></span>`).join("");
}
function tick(){
  for (const el of document.querySelectorAll("[data-flip]")){
    const ms=+el.dataset.flip-Date.now();
    if (ms<=0){ el.removeAttribute("data-flip"); render(true); return; }
    const vals=flipHtml(ms).match(/<span[^>]*>(\d+)/g).map(x=>x.replace(/.*>/,""));
    el.querySelectorAll("span").forEach((sp,i)=>{ const node=sp.firstChild; if(node && node.nodeValue!==vals[i]){ node.nodeValue=vals[i]; sp.classList.remove("tick"); void sp.offsetWidth; sp.classList.add("tick"); } });
  }
}
function heroText(e, pts, done){
  const n=S.areas.length;
  if (done>=n && n) return pts>=10 ? ["Bootcamp bestanden!","Du hast es geschafft. Wir sind mega stolz auf dich."] : ["Alles abgegeben!","Dein Manager vergibt noch die letzten Punkte."];
  if (pts>=10) return ["10 Punkte geknackt!","Du hast bestanden. Hol dir jetzt noch den Rest."];
  if (!done) return ["Los geht's!","Starte mit Thema 1. Jedes Thema bringt bis zu 2 Punkte."];
  return [`${done} von ${n} Themen erledigt`,`Ab 10 Punkten hast du bestanden. Noch ${Math.max(0,10-pts)} bis zum Ziel.`];
}
function creatorHome(){
  const e=S.me.email, pts=total(e), done=S.subs.filter(s=>s.creator_email===e).length;
  const fresh=newBadges(e), bs=badgesFor(e);
  if (fresh.size) setTimeout(()=>toast("Neues Abzeichen: "+bs.filter(b=>fresh.has(b.k)).map(b=>b.ic+" "+b.t).join(", ")),600);
  const [ht, hp]=heroText(e, pts, done), hello=new Date().getHours()<11?"Guten Morgen":new Date().getHours()<18?"Hey":"Guten Abend";
  let h = `<div class="stack"><span class="eyebrow">LIVEdream Creator Bootcamp</span><h1>${hello}, <em>${esc(firstName(S.me))}</em></h1></div>
  <div class="panel"><div class="hero">${ringSvg(pts, maxPts())}<div><p><b>${esc(ht)}</b>${esc(hp)}</p>
    <div class="badges">${bs.map(b=>`<span class="${b.on?"on":""} ${fresh.has(b.k)?"new":""}" title="${esc(b.t)}${b.on?"":" (noch offen)"}" aria-label="${esc(b.t)}">${b.ic}</span>`).join("")}</div></div></div></div>`;
  // Weg
  const states=S.areas.map(a=>areaState(e,a));
  const curIdx=states.findIndex(s=>s==="open");
  const doneCount=states.filter(s=>s==="done"||s==="wait").length;
  const fill=S.areas.length ? Math.round(doneCount/S.areas.length*100) : 0;
  let flipDone=false;
  h += `<div class="path" style="--fill:${fill}%">`;
  for (const w of weeks()){
    const o=weekOpens(w), en=weekEnds(w), later=o && Date.now()<o.getTime();
    h += `<div class="wkh"><span>WOCHE ${w}</span>${o?`<small class="muted">${fmtD(o)} bis ${fmtD(en)}</small>`:""}</div>`;
    if (later && !flipDone && !S.me.preview){ flipDone=true;
      h += `<div class="panel flipbox"><small class="muted">Woche ${w} öffnet in</small><div class="flip" data-flip="${o.getTime()}">${flipHtml(o.getTime()-Date.now())}</div></div>`; }
    for (const a of S.areas.filter(x=>x.week===w)){
      const i=S.areas.indexOf(a), st=states[i], s=subOf(e,a.n);
      const cls = st==="done"?"done":st==="wait"?"wait":i===curIdx?"cur":st==="open"?"":"lock";
      const right = st==="done" ? `<span class="pts">${s.points} P</span>` : st==="wait" ? `<span class="waitlbl">wird geprüft</span>`
        : st==="open" ? `<span class="go">${i===curIdx?"Jetzt starten":"Öffnen"}</span>` : `<span class="muted" aria-hidden="true">🔒</span>`;
      const sub = st==="time" ? `Öffnet ${fmtD(weekOpens(a.week))} um 0 Uhr` : st==="lock" ? `Nach Thema ${S.areas[i-1]?.n}` : st==="wait" ? `Abgegeben ${fmtAgo(s.submitted_at)}` : st==="done" ? (s.points===2?"Volle Punktzahl":"Bewertet") : "Video, Handout, Aufgabe";
      h += `<button class="stop ${cls}" data-area="${a.n}" data-state="${st}" ${st==="lock"||st==="time"?'aria-disabled="true"':""}>
        <span class="node">${st==="done"||st==="wait"?"✓":a.n}</span>
        <span class="t"><b>${esc(a.title)}</b><small>${esc(sub)}</small></span>${right}</button>`;
    }
  }
  h += `</div>`;
  if (!S.areas.length) h += `<p class="muted">Noch keine Themen angelegt.</p>`;
  return h;
}

/* ---------- Creator: Thema ---------- */
function quizBlock(a, done){
  const qs=quizOf(a), n=a.n;
  if (done) return `<p class="muted">Alle ${qs.length} Fragen richtig beantwortet. 💜</p>`;
  const st=S.quiz[n] || (S.quiz[n]={i:0,wrong:null,ok:null});
  const q=qs[Math.min(st.i,qs.length-1)];
  return `<div class="quiz"><div class="qbar">${qs.map((_,i)=>`<i class="${i<st.i?"on":i===st.i?"cur":""}"></i>`).join("")}</div>
    <small class="muted">Frage ${st.i+1} von ${qs.length}</small>
    <p class="qq">${esc(q.q)}</p>
    <div class="qa">${list(q.a).map((x,j)=>`<button data-quiz="${n}" data-j="${j}" class="${st.ok===j?"right":st.wrong===j?"wrong":""}" ${st.ok!=null?"disabled":""}>${esc(x)}</button>`).join("")}</div>
    ${st.wrong!=null?`<p class="qhint">Nicht ganz. ${esc(q.h||"Versuch es nochmal.")}</p>`:""}</div>`;
}
function answerQuiz(n, j){
  const a=S.areas.find(x=>x.n===n), qs=quizOf(a), st=S.quiz[n]; if(!st||st.ok!=null) return;
  const q=qs[st.i];
  if (j!==+q.c){ st.wrong=j; return render(true); }
  st.ok=j; st.wrong=null; render(true);
  setTimeout(()=>{ st.i++; st.ok=null; if (st.i>=qs.length){ delete S.quiz[n]; markStep(n,"quiz_at"); } else render(true); }, 750);
}
function topicView(a){
  if (!a) { S.openArea=null; return creatorHome(); }
  const e=S.me.email, s=subOf(e,a.n), [vOk,qOk,hOk]=stepsDone(e,a), ju=S.justUnlocked, hasQ=quizOf(a).length>0;
  const steps=[["Video",vOk]]; if (hasQ) steps.push(["Quiz",qOk]); steps.push(["Handout",hOk],["Aufgabe",!!s]);
  const cur=steps.findIndex(x=>!x[1]);
  const dot=i=>`<span class="sdot ${steps[i][1]?"on":i===cur?"cur":""}">${steps[i][1]?"✓":i+1}</span>`;
  let h = `<button class="btn ghost small back" id="home">← Alle Themen</button>
  <div class="stack"><span class="eyebrow">Thema ${a.n} · Woche ${a.week}</span><h1>${esc(a.title)}</h1>${a.intro?`<p class="soft">${esc(a.intro)}</p>`:""}</div>
  <div><div class="stepper">${steps.map((_,i)=>(i?`<span class="sline ${steps[i-1][1]?"on":""}"></span>`:"")+dot(i)).join("")}</div>
  <div class="slabels">${steps.map(x=>`<span>${x[0]}</span>`).join("")}</div></div>`;
  let no=1;
  const after = hasQ ? "Danach kommt ein kurzes Quiz." : "Danach öffnet sich das Handout.";
  h += `<section class="panel step"><div class="sh"><span class="eyebrow">Schritt ${no++}</span><h2>Lehrvideo</h2>${vOk&&a.video_url?`<span class="lk tag ok">angesehen</span>`:""}</div>
    ${videoBlock(a)}${!vOk?`<p class="muted">Schau das Video bis zum Ende. ${after}</p>`:""}</section>`;
  if (hasQ){
    const lq=!vOk;
    h += `<section class="panel step ${lq?"locked":""} ${ju==="quiz"?"unlocked":""}"><div class="sh"><span class="eyebrow">Schritt ${no++}</span><h2>Quiz</h2>${lq?`<span class="lk">🔒 nach dem Video</span>`:qOk?`<span class="lk tag ok">geschafft</span>`:""}</div>
      ${lq?`<p class="muted">${quizOf(a).length} kurze Fragen zum Video. Zählt nicht für die Punkte.</p>`:quizBlock(a,qOk)}</section>`;
  }
  const l2=!qOk, l2txt=hasQ?"nach dem Quiz":"nach dem Video";
  h += `<section class="panel step ${l2?"locked":""} ${ju==="handout"?"unlocked":""}"><div class="sh"><span class="eyebrow">Schritt ${no++}</span><h2>Handout</h2>${l2?`<span class="lk">🔒 ${l2txt}</span>`:hOk&&a.handout_path?`<span class="lk tag ok">gelesen</span>`:""}</div>
    ${a.handout_path ? (l2 ? `<div class="doc" aria-disabled="true"><span class="paper"></span><span><b>Handout Thema ${a.n}</b><small class="muted">PDF zum Nachlesen</small></span></div>`
      : `<a class="doc" data-handout="${esc(a.handout_path)}" data-n="${a.n}" target="_blank" rel="noopener"><span class="paper"></span><span><b>Handout Thema ${a.n} öffnen</b><small class="muted">PDF zum Nachlesen${!hOk?", danach ist deine Aufgabe frei":""}</small></span></a>`)
      : `<p class="muted">Für dieses Thema gibt es kein Handout.</p>`}</section>`;
  const l3=!hOk;
  h += `<section class="panel step ${l3?"locked":""} ${ju==="task"?"unlocked":""}"><div class="sh"><span class="eyebrow">Schritt ${no}</span><h2>Deine Aufgabe</h2>${l3?`<span class="lk">🔒 nach dem Handout</span>`:""}</div>`;
  if (l3) h += `<p class="muted">Hier siehst du gleich, was du für 1 und 2 Punkte machst, und gibst deinen Nachweis ab.</p>`;
  else h += taskBlock(a) + handIn(a, s);
  return h + `</section>`;
}
function taskBlock(a){
  return `${list(a.pre).length?`<h3>Zuerst</h3><ul class="task">${list(a.pre).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    <div class="tix"><div><b>1<small>Punkt</small></b><ul>${list(a.p1).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><b>2<small>Punkte</small></b><ul>${list(a.p2).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div>
    ${a.proof?`<p class="muted"><b style="color:var(--fg);font-weight:600">Nachweis:</b> ${esc(a.proof)}</p>`:""}`;
}
function pendList(n){ const pend=S.pending[n]||[]; return pend.map((f,i)=>`<span>${esc(f.name)} <button class="chip" data-unpend="${n}" data-i="${i}" aria-label="Entfernen" style="padding:0 6px;margin-left:4px">×</button></span>`).join(""); }
function handIn(a, s){
  const n=a.n;
  if (s && s.points!=null){
    return `<div class="feedback gold"><b style="font-family:var(--head);color:var(--gold)">${s.points} von 2 Punkten</b>${s.feedback?`<br>${esc(s.feedback)}`:""}</div>
      ${s.note?`<h3>Deine Nachricht</h3><p class="feedback">${esc(s.note)}</p>`:""}<h3>Deine Dateien</h3>${fileLinks(s.files)}`;
  }
  const ro=readOnly();
  return `${s?`<div class="feedback">Abgegeben ${fmtAgo(s.submitted_at)}. Dein Manager vergibt die Punkte. Bis dahin kannst du noch etwas ergänzen.</div>${fileLinks(s.files)}`:""}
    <label class="drop" for="up-${n}"><span class="ic">🖼️🎬📄</span><strong>${s?"Weitere Datei hinzufügen":"Nachweis hochladen"}</strong><small>Fotos, Videos oder PDF, je max. 50 MB</small>
      <input id="up-${n}" data-up="${n}" type="file" accept="image/*,video/*,application/pdf" multiple></label>
    <div class="files" id="pend">${pendList(n)}</div>
    <label class="f" for="note"><span class="row2"><span>Nachricht an deinen Manager</span><span id="cnt" class="muted">${(s?.note||"").length} / 1000</span></span>
      <textarea id="note" maxlength="1000" placeholder="Was hast du gemacht? Was lief gut, wo hängst du? Links zu Videos gern hier rein.">${esc(s?.note||"")}</textarea></label>
    <button class="btn gold" id="submit" data-n="${n}" ${ro||S.busy?"disabled":""}>${S.busy?"Wird hochgeladen …":s?"Änderungen speichern":"Abgeben"}</button>
    ${ro?`<p class="viewnote">In dieser Ansicht ist Abgeben gesperrt.</p>`:""}`;
}
async function submitArea(n){
  if (readOnly() || S.busy) return;
  const files=S.pending[n]||[], e=S.me.email, existing=subOf(e,n), note=($("#note")?.value||"").trim();
  if (!existing && !files.length && !note) return toast("Lade einen Nachweis hoch oder schreib deinem Manager eine Nachricht.");
  if (existing && !files.length && note===(existing.note||"")) return toast("Es gibt nichts Neues zu speichern.");
  S.busy=true; S._draft=note; render(true); const nb=$("#note"); if(nb) nb.value=note;
  try{
    const up=[];
    for (const f of files){
      const safe = f.name.normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(-80);
      const path = `${e}/${n}/${Date.now()}-${safe}`;
      const { error } = await sb.storage.from("nachweise").upload(path, f, { contentType:f.type||undefined });
      if (error) throw error;
      up.push({ path, name:f.name, type:f.type, size:f.size });
    }
    const res = existing
      ? await sb.from("submissions").update({ files:[...list(existing.files), ...up], note:note||null }).eq("id", existing.id)
      : await sb.from("submissions").insert({ creator_email:e, area:n, note:note||null, files:up });
    if (res.error) throw res.error;
    S.pending[n]=[]; await refresh(); S.busy=false;
    if (!existing) { S.openArea=null; render(); celebrate(n); }
    else { render(true); toast("Gespeichert."); }
  } catch(err){ S.busy=false; render(true); const nb2=$("#note"); if(nb2) nb2.value=note; fail(err); }
}
function celebrate(n){
  const nx=S.areas.find(a=>a.n>n), e=S.me.email;
  $("#win-t").textContent=`Thema ${n} abgegeben!`;
  $("#win-p").textContent = !nx ? "Das war das letzte Thema. Mega stark!" : areaState(e,nx)==="open" ? `Thema ${nx.n} ist jetzt frei.` : `Thema ${nx.n} öffnet am ${fmtD(weekOpens(nx.week))} um 0 Uhr.`;
  const w=$("#win"); w.classList.add("show"); confetti();
  clearTimeout(celebrate._t); celebrate._t=setTimeout(()=>w.classList.remove("show"),3600);
}
function confetti(){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c=$("#conf"), x=c.getContext("2d"), W=c.width=innerWidth*devicePixelRatio, H=c.height=innerHeight*devicePixelRatio;
  const cols=["#FFB017","#d6409f","#c24fe0","#e6a8f7","#ffffff"];
  const ps=Array.from({length:140},()=>({x:W/2,y:H*.45,vx:(Math.random()-.5)*26*devicePixelRatio,vy:(-Math.random()*22-6)*devicePixelRatio,r:(Math.random()*5+3)*devicePixelRatio,c:cols[Math.random()*cols.length|0],a:Math.random()*6,s:Math.random()*.3-.15}));
  const t0=performance.now();
  (function fr(t){ x.clearRect(0,0,W,H); const k=(t-t0)/1000;
    for (const p of ps){ p.vy+=.9*devicePixelRatio; p.vx*=.985; p.x+=p.vx; p.y+=p.vy; p.a+=p.s; x.save(); x.translate(p.x,p.y); x.rotate(p.a); x.globalAlpha=Math.max(0,1-k/3); x.fillStyle=p.c; x.fillRect(-p.r,-p.r/2,p.r*2,p.r); x.restore(); }
    if (k<3.2) requestAnimationFrame(fr); else x.clearRect(0,0,W,H); })(t0);
}

/* ---------- Manager / Agenturleitung ---------- */
function dots(email){
  return '<div class="dots">' + S.areas.map(a => { const s=subOf(email,a.n);
    const c = !s ? "" : s.points==null ? "w" : "p"+s.points; return `<i class="${c}" title="Thema ${a.n}"></i>`; }).join("") + "</div>";
}
const LEGEND = `<div class="legend"><span><i style="background:var(--gold)"></i>2 Punkte</span><span><i style="background:var(--orchid)"></i>1 Punkt</span><span><i style="background:rgba(255,255,255,.25)"></i>0 Punkte</span><span><i style="background:repeating-linear-gradient(45deg,var(--rose) 0 3px,transparent 3px 6px)"></i>wartet</span></div>`;
function rateBlock(s){
  return `<div class="rate" role="group" aria-label="Punkte">${[0,1,2].map(p=>`<button data-rate="${s.id}" data-p="${p}" aria-pressed="${s.points===p}">${p} ${p===1?"Punkt":"Punkte"}</button>`).join("")}</div>
    <label class="f" for="fb-${s.id}">Rückmeldung an den Creator (optional)<textarea id="fb-${s.id}">${esc(s.feedback||"")}</textarea></label>`;
}
function subCard(s, showCreator=true){
  const a=S.areas.find(x=>x.n===s.area), c=member(s.creator_email);
  return `<div class="row"><div class="head"><b>${showCreator?esc(label(c))+" · ":""}${a?"Thema "+a.n+" · "+esc(a.title):""}</b><span class="tag ${s.points==null?"wait":s.points===2?"gold":"ok"}">${s.points==null?"Offen":s.points+" P"}</span></div>
    <div class="muted">Abgegeben ${fmtAgo(s.submitted_at)}${s.rated_at?` · bewertet von ${esc(member(s.rated_by)?.name||s.rated_by)}`:""}</div>
    ${s.note?`<div><span class="eyebrow">Nachricht vom Creator</span><p class="feedback" style="margin-top:6px">${esc(s.note)}</p></div>`:""}${fileLinks(s.files)}${rateBlock(s)}</div>`;
}
function pendingView(){
  const mine = new Set(myCreators().map(c=>c.email));
  const open = S.subs.filter(s=>s.points==null && mine.has(s.creator_email)).sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at));
  return `<div class="stack"><span class="eyebrow">${S.me.role==="lead"?"Agenturleitung":"Manager"}</span><h1>Zu <em>bewerten</em></h1></div>
    ${open.length ? `<div class="list">${open.map(s=>subCard(s)).join("")}</div>` : `<div class="panel"><p class="muted">Gerade ist nichts offen. 🎉</p></div>`}`;
}
function creatorRow(c){
  const t=total(c.email), st=streakInfo(c.email).cur, b=badgesFor(c.email).filter(x=>x.on);
  return `<button class="row" data-creator="${esc(c.email)}"><div class="head"><b>${esc(label(c))}</b><span class="tag ${t>=10?"gold":""}">${t} / ${maxPts()}</span></div>${dots(c.email)}
    ${st||b.length?`<div class="mini">${st?`<span class="chip">🔥 ${st}</span>`:""}${b.length?`<span class="chip">${b.map(x=>x.ic).join(" ")}</span>`:""}</div>`:""}</button>`;
}
function managerList(){
  const cs=myCreators();
  return `<div class="stack"><span class="eyebrow">Manager</span><h1>Meine <em>Creator</em></h1></div>${LEGEND}
    ${cs.length?`<div class="list">${cs.map(creatorRow).join("")}</div>`:`<div class="panel"><p class="muted">Dir sind noch keine Creator zugeordnet.</p></div>`}`;
}
function creatorDetail(email){
  const c=member(email); if(!c){ S.creator=null; return ""; }
  let h=`<button class="btn ghost small back" id="back">← Zurück</button>
    <div class="stack"><span class="eyebrow">${esc(member(c.manager_email)?.name?"Manager: "+member(c.manager_email).name:"ohne Manager")}</span><h1>${esc(label(c))}</h1>
    <p class="muted">${esc(c.name)} · ${esc(c.email)} · ${total(email)} von ${maxPts()} Punkten · 🔥 ${streakInfo(email).cur} Tage</p></div><div class="list">`;
  for (const a of S.areas){
    const s=subOf(email,a.n), p=progOf(email,a.n);
    if (s) { h += subCard(s,false); continue; }
    h += `<div class="row"><div class="head"><b>Thema ${a.n} · ${esc(a.title)}</b><span class="tag">Nicht abgegeben</span></div>
      <div class="mini">${a.video_url?`<span class="chip">${p.video_at?"✓":"○"} Video</span>`:""}${quizOf(a).length?`<span class="chip">${p.quiz_at?"✓":"○"} Quiz</span>`:""}${a.handout_path?`<span class="chip">${p.handout_at?"✓":"○"} Handout</span>`:""}</div></div>`;
  }
  return h+`</div>`;
}
function leadOverview(){
  const cs=creators(), pass=cs.filter(c=>total(c.email)>=10).length, open=S.subs.filter(s=>s.points==null).length, s0=startDate();
  let h=`<div class="stack"><span class="eyebrow">Agenturleitung</span><h1>Bootcamp <em>Übersicht</em></h1>
    <p class="muted">${s0?`Start: ${fmtD(s0)}${s0.getFullYear()}. Woche 1 bis ${weeks().length}.`:`Noch kein Startdatum. Lege es unter „Themen & Start“ fest, dann öffnen sich die Wochen automatisch.`}</p></div>
    <div class="score"><div class="panel stat"><b>${cs.length}</b><small>Creator</small></div><div class="panel stat"><b>${pass}</b><small>ab 10 Punkten</small></div><div class="panel stat"><b>${open}</b><small>warten auf Bewertung</small></div></div>${LEGEND}`;
  const groups = {};
  for (const c of cs){ const k=c.manager_email||""; (groups[k] ||= []).push(c); }
  for (const [k,l] of Object.entries(groups).sort((a,b)=>(member(a[0])?.name||"~").localeCompare(member(b[0])?.name||"~"))){
    h += `<div class="grp">${esc(member(k)?.name || "Ohne Manager")}</div><div class="list">${l.map(creatorRow).join("")}</div>`;
  }
  if (!cs.length) h += `<div class="panel"><p class="muted">Noch keine Creator eingetragen.</p></div>`;
  return h + `<button class="btn ghost" id="csv">Punkte als Excel-Datei (CSV) herunterladen</button>`;
}
function exportCsv(){
  const rows=[["Creator","Name","E-Mail","Manager",...S.areas.map(a=>"T"+a.n+" "+a.title),"Summe","Bestanden"]];
  for (const c of creators()){
    const pts=S.areas.map(a=>{const s=subOf(c.email,a.n); return !s?"":s.points==null?"offen":s.points;});
    const t=total(c.email); rows.push([label(c),c.name,c.email,member(c.manager_email)?.name||"",...pts,t,t>=10?"ja":"nein"]);
  }
  const csv="﻿"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`Bootcamp-Punkte-${isoDay(new Date())}.csv`; a.click();
}

/* ---------- Teilnehmer verwalten ---------- */
function peopleView(){
  const m = S.editMember ? member(S.editMember) : null;
  const managers = S.members.filter(x=>x.role!=="creator");
  let h = `<div class="stack"><span class="eyebrow">Agenturleitung</span><h1><em>Teilnehmer</em></h1></div>
  <div class="panel stack"><h2>${m?"Person bearbeiten":"Person hinzufügen"}</h2>
  <div class="grid2">
    <label class="f" for="pm-email">E-Mail-Adresse<input id="pm-email" type="email" value="${esc(m?.email||"")}"></label>
    <label class="f" for="pm-role">Rolle<select id="pm-role">${Object.entries(ROLE_NAME).map(([k,v])=>`<option value="${k}" ${(m?.role||"creator")===k?"selected":""}>${v}</option>`).join("")}</select></label>
    <label class="f" for="pm-name">Name<input id="pm-name" type="text" value="${esc(m?.name||"")}"></label>
    <label class="f" for="pm-handle">TikTok-Name (nur Creator)<input id="pm-handle" type="text" value="${esc(m?.handle||"")}"></label>
    <label class="f" for="pm-mgr">Manager (nur Creator)<select id="pm-mgr"><option value="">–</option>${managers.map(x=>`<option value="${esc(x.email)}" ${m?.manager_email===x.email?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
  </div>
  <div class="actions"><button class="btn small" id="pm-save">${m?"Speichern":"Hinzufügen"}</button>${m?`<button class="btn small ghost" id="pm-cancel">Abbrechen</button><button class="btn small danger" id="pm-del">${S.confirmDelete===m.email?"Wirklich löschen? Auch alle Abgaben":"Löschen"}</button>`:""}</div></div>`;
  for (const r of ["lead","manager","creator"]){
    const ps=S.members.filter(x=>x.role===r); if(!ps.length) continue;
    h += `<div class="grp">${ROLE_NAME[r]} (${ps.length})</div><div class="list">${ps.map(p=>`<button class="row" data-edit="${esc(p.email)}"><div class="head"><b>${esc(r==="creator"?label(p):p.name)}</b><span class="muted">${r==="creator"?esc(member(p.manager_email)?.name||"ohne Manager"):""}</span></div><span class="muted">${esc(p.email)}</span></button>`).join("")}</div>`;
  }
  return h;
}
async function saveMember(){
  const row = { email:lc($("#pm-email").value), role:$("#pm-role").value, name:$("#pm-name").value.trim(), handle:$("#pm-handle").value.trim().replace(/^@/,"")||null, manager_email:$("#pm-mgr").value||null };
  if (!/^\S+@\S+\.\S+$/.test(row.email) || !row.name) return toast("Bitte E-Mail und Namen ausfüllen.");
  if (row.role!=="creator"){ row.handle=null; row.manager_email=null; }
  const res = S.editMember ? await sb.from("members").update(row).eq("email", S.editMember) : await sb.from("members").insert(row);
  if (res.error) return fail(res.error.code==="23505"?"Diese E-Mail gibt es schon.":res.error);
  S.editMember=null; await refresh(); render(); toast("Gespeichert.");
}

/* ---------- Themen & Start ---------- */
function areaEditor(){
  const a=S.areas.find(x=>x.n===S.editArea)||S.areas[0], s0=startDate();
  const lines = x => esc(list(x).join("\n"));
  let h = `<div class="stack"><span class="eyebrow">Agenturleitung</span><h1>Themen & <em>Start</em></h1></div>
  <div class="panel stack"><h2>Bootcamp-Start</h2>
    <p class="muted">Immer ein Montag. Woche 1 öffnet an diesem Tag um 0 Uhr, jede weitere Woche 7 Tage später.${s0?` Aktuell: Woche 1 ab ${fmtD(s0)}${s0.getFullYear()}, Woche ${weeks().length} bis ${fmtD(weekEnds(weeks().length))}`:" Noch nicht festgelegt: Bis dahin sind alle Wochen offen."}</p>
    ${S.needsUpdate?`<p class="err">Zuerst muss update-2.sql in Supabase laufen.</p>`:""}
    <div class="actions"><input id="st-date" type="date" value="${esc(S.settings.start||"")}" style="max-width:220px"><button class="btn small" id="st-save" ${S.needsUpdate?"disabled":""}>Start speichern</button></div></div>`;
  if (!a) return h + `<p class="muted">Keine Themen gefunden.</p>`;
  h += `<div class="panel stack"><h2>Thema bearbeiten</h2>
  <label class="f" for="ae-n">Thema<select id="ae-n">${S.areas.map(x=>`<option value="${x.n}" ${x.n===a.n?"selected":""}>${x.n} · ${esc(x.title)}</option>`).join("")}</select></label>
  <div class="grid2">
    <label class="f" for="ae-title">Titel<input id="ae-title" type="text" value="${esc(a.title)}"></label>
    <label class="f" for="ae-week">Woche<input id="ae-week" type="text" inputmode="numeric" value="${a.week}"></label>
  </div>
  <label class="f" for="ae-video">Lehrvideo (hochgeladen oder YouTube-Link)<input id="ae-video" type="text" value="${esc(a.video_url||"")}"></label>
  <label class="f" for="ae-intro">Kurze Einleitung<textarea id="ae-intro">${esc(a.intro||"")}</textarea></label>
  <label class="f" for="ae-pre">Zuerst (eine Zeile pro Punkt, darf leer sein)<textarea id="ae-pre">${lines(a.pre)}</textarea></label>
  <label class="f" for="ae-p1">Für 1 Punkt (eine Zeile pro Punkt)<textarea id="ae-p1">${lines(a.p1)}</textarea></label>
  <label class="f" for="ae-p2">Für 2 Punkte zusätzlich<textarea id="ae-p2">${lines(a.p2)}</textarea></label>
  <label class="f" for="ae-proof">Nachweis<input id="ae-proof" type="text" value="${esc(a.proof||"")}"></label>
  ${"quiz" in a ? `<h3>Quiz nach dem Video</h3><p class="muted">Bis zu 3 Fragen. Leere Fragen werden weggelassen. Markiere die richtige Antwort.</p>
  ${[0,1,2].map(i=>{ const q=list(a.quiz)[i]||{a:[]}; return `<fieldset class="qedit"><legend>Frage ${i+1}</legend>
    <input id="qz-${i}-q" type="text" placeholder="Frage" value="${esc(q.q||"")}">
    ${[0,1,2].map(j=>`<label class="qopt"><input type="radio" name="qz-${i}-c" value="${j}" ${(+q.c||0)===j?"checked":""} aria-label="Antwort ${j+1} ist richtig"><input id="qz-${i}-a${j}" type="text" placeholder="Antwort ${j+1}" value="${esc(list(q.a)[j]||"")}"></label>`).join("")}
    <input id="qz-${i}-h" type="text" placeholder="Hinweis bei falscher Antwort" value="${esc(q.h||"")}"></fieldset>`; }).join("")}`
  : `<p class="muted">Quiz: Erst update-3.sql in Supabase ausführen, dann kannst du hier Quizfragen bearbeiten.</p>`}
  ${a.video_url && !/^https?:/.test(a.video_url) ? `<div class="video"><video data-video="${esc(a.video_url)}" controls playsinline preload="metadata"></video></div>` : ""}
  <label class="f" for="ae-vfile">Lehrvideo hochladen (MP4, max. 50 MB)<input id="ae-vfile" type="file" accept="video/mp4,video/*"></label>
  <label class="f" for="ae-handout">Handout (PDF) ${a.handout_path?`· <a data-handout="${esc(a.handout_path)}" target="_blank" rel="noopener">aktuelles öffnen</a>`:"· noch keins"}<input id="ae-handout" type="file" accept="application/pdf"></label>
  <button class="btn" id="ae-save">Thema speichern</button></div>`;
  return h;
}
async function saveStart(){
  const v=$("#st-date").value;
  if (v){ const [y,m,d]=v.split("-").map(Number); if (new Date(y,m-1,d).getDay()!==1) return toast("Bitte einen Montag wählen."); }
  const res = v ? await sb.from("settings").upsert({ key:"start", value:v }, { onConflict:"key" }) : await sb.from("settings").delete().eq("key","start");
  if (res.error) return fail(res.error);
  await refresh(); render(true); toast(v?"Startdatum gespeichert.":"Startdatum entfernt.");
}
async function saveArea(){
  const n=+$("#ae-n").value, split=id=>$(id).value.split("\n").map(s=>s.trim()).filter(Boolean);
  const row={ title:$("#ae-title").value.trim(), week:parseInt($("#ae-week").value,10)||1, video_url:$("#ae-video").value.trim()||null,
    intro:$("#ae-intro").value.trim()||null, pre:split("#ae-pre"), p1:split("#ae-p1"), p2:split("#ae-p2"), proof:$("#ae-proof").value.trim()||null };
  if ($("#qz-0-q")){
    row.quiz=[0,1,2].map(i=>{ const q=$(`#qz-${i}-q`).value.trim(), an=[0,1,2].map(j=>$(`#qz-${i}-a${j}`).value.trim()), c=+(document.querySelector(`input[name="qz-${i}-c"]:checked`)?.value||0), h=$(`#qz-${i}-h`).value.trim();
      return { q, a:an, c, h }; }).filter(q=>q.q);
    const bad=row.quiz.find(q=>q.a.some(x=>!x));
    if (bad) return toast("Bitte bei jeder Quizfrage alle 3 Antworten ausfüllen.");
  }
  const f=$("#ae-handout").files[0], vf=$("#ae-vfile").files[0];
  if (vf && vf.size>MAX_FILE) return toast("Das Video ist größer als 50 MB.");
  try{
    $("#ae-save").disabled=true;
    if (vf){ $("#ae-save").textContent="Video wird hochgeladen …";
      const path=`video-${n}-${Date.now()}.mp4`; const {error}=await sb.storage.from("unterlagen").upload(path,vf,{contentType:vf.type||"video/mp4"}); if(error) throw error; row.video_url=path; }
    if (f){ const path=`handout-${n}-${Date.now()}.pdf`; const {error}=await sb.storage.from("unterlagen").upload(path,f,{contentType:"application/pdf"}); if(error) throw error; row.handout_path=path; }
    const {error}=await sb.from("areas").update(row).eq("n",n); if(error) throw error;
    await refresh(); render(true); toast("Thema gespeichert.");
  } catch(e){ fail(e); render(true); }
}

/* ---------- Ereignisse ---------- */
document.addEventListener("click", async e => {
  if (e.target.closest("#win")) { $("#win").classList.remove("show"); return; }
  const t = e.target.closest("button,a"); if (!t) return;
  if (t.id==="send-link") return sendLink();
  if (t.id==="verify") return verifyCode();
  if (t.id==="restart") return loginView();
  if (t.id==="logout"){ await sb.auth.signOut(); Object.assign(S,{me:null,real:null,viewAs:"",tab:null,creator:null,openArea:null,ringShown:false,localProg:{}}); return loginView(); }
  if (t.dataset.tab){ S.tab=t.dataset.tab; S.creator=null; S.editMember=null; return render(); }
  if (t.dataset.area){
    const st=t.dataset.state;
    if (st==="lock") return toast("Gib zuerst das Thema davor ab.");
    if (st==="time") return toast("Diese Woche öffnet am Montag um 0 Uhr.");
    S.openArea=+t.dataset.area; return render();
  }
  if (t.id==="home"){ S.openArea=null; return render(); }
  if (t.dataset.quiz) return answerQuiz(+t.dataset.quiz, +t.dataset.j);
  if (t.dataset.seen) return markStep(+t.dataset.seen,"video_at");
  if (t.dataset.handout && t.dataset.n){ if (!t.href) { e.preventDefault(); toast("Handout lädt noch, bitte gleich nochmal tippen."); return; } setTimeout(()=>markStep(+t.dataset.n,"handout_at"),300); return; }
  if (t.dataset.unpend){ const n=+t.dataset.unpend; (S.pending[n]||[]).splice(+t.dataset.i,1); $("#pend").innerHTML=pendList(n); return; }
  if (t.id==="submit") return submitArea(+t.dataset.n);
  if (t.dataset.creator){ S.creator=t.dataset.creator; return render(); }
  if (t.id==="back"){ S.creator=null; return render(); }
  if (t.dataset.rate){
    const id=t.dataset.rate, fb=$(`#fb-${id}`)?.value||"";
    const { error } = await sb.rpc("rate_submission", { sub_id:id, pts:+t.dataset.p, fb });
    if (error) return fail(error);
    await refresh(); render(true); return toast("Punkte gespeichert.");
  }
  if (t.id==="csv") return exportCsv();
  if (t.dataset.edit){ S.editMember=t.dataset.edit; S.confirmDelete=null; return render(); }
  if (t.id==="pm-save") return saveMember();
  if (t.id==="pm-cancel"){ S.editMember=null; S.confirmDelete=null; return render(); }
  if (t.id==="pm-del"){
    if (S.confirmDelete!==S.editMember){ S.confirmDelete=S.editMember; return render(true); }
    const { error } = await sb.from("members").delete().eq("email", S.editMember); if (error) return fail(error);
    S.editMember=null; S.confirmDelete=null; await refresh(); render(); return toast("Gelöscht.");
  }
  if (t.id==="st-save") return saveStart();
  if (t.id==="ae-save") return saveArea();
});
document.addEventListener("change", e => {
  if (e.target.dataset.up){
    const n=+e.target.dataset.up, fs=[...e.target.files], big=fs.filter(f=>f.size>MAX_FILE);
    if (big.length) toast(`${big.map(f=>f.name).join(", ")} ist größer als 50 MB. Bitte kürzer aufnehmen.`);
    S.pending[n]=[...(S.pending[n]||[]), ...fs.filter(f=>f.size<=MAX_FILE)];
    e.target.value=""; $("#pend").innerHTML=pendList(n);
  }
  if (e.target.id==="viewas"){ S.viewAs=e.target.value; S.quiz={}; S.creator=null; S.openArea=null; S.editMember=null; S.ringShown=false; S.localProg={}; applyView(); S.tab = S.me.role==="creator"?"themen":S.me.role==="manager"?"bewerten":"uebersicht"; return render(); }
  if (e.target.id==="ae-n"){ S.editArea=+e.target.value; render(true); }
});
document.addEventListener("input", e => { if (e.target.id==="note"){ const c=$("#cnt"); if(c) c.textContent=`${e.target.value.length} / 1000`; } });
document.addEventListener("keydown", e => {
  if (e.key==="Escape") $("#win").classList.remove("show");
  if (e.key!=="Enter") return;
  if (e.target.id==="email") sendLink();
  if (e.target.id==="code") verifyCode();
});

boot();
})();
