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
const S = { session:null, me:null, real:null, viewAs:"", areas:[], members:[], subs:[], progress:[], activity:[], settings:{}, roster:[], noRoster:false, rosterPreview:null, extras:[], noExtras:false, snaps:[], questions:[], survey:[], top:[], noUpd5:false, survDraft:{},
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
const allCreators = () => S.members.filter(m => m.role === "creator");
const creators = () => allCreators().filter(m => m.bootcamp !== false);   // Bootcamp-Teilnehmer
const inBootcamp = m => m && (m.role !== "creator" || m.preview || m.bootcamp !== false);
const audOf = x => x.audience || "bootcamp";
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
  ["all","🏆","Alle Themen abgegeben"],
  ["snap","📸","Vorher-Nachher gezeigt"]
];
function badgesFor(email){
  const subs=S.subs.filter(s=>s.creator_email===email), w1=S.areas.filter(a=>a.week===1);
  const on = {
    first: subs.length>=1,
    week1: w1.length>0 && w1.every(a=>subOf(email,a.n)),
    streak: streakInfo(email).best>=3,
    half: subs.length>=4,
    pass: total(email)>=10,
    all: S.areas.length>0 && subs.length>=S.areas.length,
    snap: ["vorher","nachher"].every(k=>snapOf(email,k))
  };
  return BADGES.map(([k,ic,t]) => ({ k, ic, t, on:!!on[k] }));
}
const snapOf = (email,k) => S.snaps.find(x=>x.creator_email===email && x.kind===k);
const passed = email => total(email) >= 10;
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
  const imgs=[...document.querySelectorAll("img[data-img]:not([src])")];
  if (imgs.length){ const { data } = await sb.storage.from("nachweise").createSignedUrls([...new Set(imgs.map(i=>i.dataset.img))], 3600);
    const map=Object.fromEntries((data||[]).filter(d=>d.signedUrl).map(d=>[d.path,d.signedUrl])); imgs.forEach(i=>{ if(map[i.dataset.img]) i.src=map[i.dataset.img]; }); }
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
    let { data: me, error } = await sb.from("members").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    $("#toplogo").hidden=false;
    const noAccess = msg => { who.innerHTML = `<button class="chip" id="logout">Abmelden</button>`; view.innerHTML = `<div class="panel stack"><h2>Kein Zugang</h2><p class="muted">${msg}</p></div>`; };
    if (!me) {
      const reg = storeGet("ldb-register") || {}, md = S.session.user.user_metadata || {};
      const handle = md.handle || (reg.email===email ? reg.handle : ""), name = md.name || reg.name || "";
      if (handle) {
        const { data: res, error: ce } = await sb.rpc("claim_member", { nm:name, h:handle });
        if (ce) throw ce;
        storeSet("ldb-register", null);
        if (res==="ok" || res==="exists") { ({ data: me } = await sb.from("members").select("*").eq("email", email).maybeSingle()); if (me) toast("Willkommen in der LIVEdream Academy! 💜"); }
        else return noAccess(res==="taken" ? `Der TikTok-Name @${esc(handle)} ist schon mit einer anderen E-Mail-Adresse registriert. Bitte melde dich bei deinem Manager.` : `Der TikTok-Name @${esc(handle)} steht nicht auf unserer Liste. Bitte melde dich bei deinem Manager.`);
      }
      if (!me) return noAccess(`Die Adresse ${esc(email)} ist noch nicht registriert. Melde dich ab und tippe auf „Neu hier? Registrieren“.`);
    }
    if (me.role==="creator") {
      const { data: role } = await sb.rpc("my_role");
      if (!role) return noAccess("Dein Zugang zur LIVEdream Academy ist abgelaufen, weil du nicht mehr auf unserer Creator-Liste stehst. Wenn das ein Fehler ist, melde dich bei deinem Manager.");
    }
    S.real = me; S.me = me; S.viewAs = "";
    if (me.role==="creator") {
      const r = await sb.from("activity").upsert({ creator_email:email, day:isoDay(new Date()) }, { onConflict:"creator_email,day", ignoreDuplicates:true });
      if (r?.error) console.warn(r.error);
    }
    await refresh();
    S.tab = S.tab || (me.role === "creator" ? (me.bootcamp ? "themen" : "akademie") : me.role === "manager" ? "bewerten" : "uebersicht");
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
  const [p,ac,st,ex] = await Promise.all([ sb.from("progress").select("*"), sb.from("activity").select("*"), sb.from("settings").select("*"), sb.from("extras").select("*").order("sort").order("created_at") ]);
  S.noExtras = !!ex.error; S.extras = ex.data || [];
  const [sn,qu,sv,tp] = await Promise.all([ sb.from("snapshots").select("*"), sb.from("questions").select("*").order("created_at",{ascending:false}), sb.from("survey").select("*"), sb.rpc("top5") ]);
  S.noUpd5 = !!(sn.error || qu.error || sv.error);
  if (S.real?.role==="lead" || S.me?.role==="lead"){ const ro=await sb.from("roster").select("*").order("handle"); S.noRoster=!!ro.error; S.roster=ro.data||[]; }
  S.snaps = sn.data||[]; S.questions = qu.data||[]; S.survey = sv.data||[]; S.top = tp.error ? [] : (tp.data||[]);
  S.needsUpdate = !!(p.error || ac.error || st.error);
  S.progress = p.data||[]; S.activity = ac.data||[];
  S.settings = Object.fromEntries((st.data||[]).map(r=>[r.key,r.value]));
}

/* ---------- Login ---------- */
function loginView(email="", sent=false, err="", mode){
  mode = mode || S._loginMode || "login"; S._loginMode = mode;
  tabsEl.hidden = true; who.innerHTML = ""; $("#switch").hidden=true; $("#toplogo").hidden=true;
  document.querySelector(".wrap").classList.remove("wide");
  const reg = mode==="register", r = S._reg || {};
  view.innerHTML = `<div class="login">
    <img class="logo" src="logo.png" alt="LIVEdream Agency">
    <div class="stack" style="text-align:center"><span class="eyebrow">LIVEdream Academy</span>
    <h1>${sent ? "Schau in dein <em>Postfach</em>" : reg ? "Neu in der <em>Academy</em>" : "Willkommen in der <em>Academy</em>"}</h1></div>
    <div class="panel stack">
    ${sent ? `<p class="soft">Wir haben dir eine E-Mail an <b>${esc(email)}</b> geschickt. Tippe auf den Link darin oder gib den Code hier ein.</p>
      <p class="muted"><b style="color:var(--gold);font-weight:600">Keine Mail da?</b> Schau bitte im Spam-Ordner nach und markiere die Mail als „Kein Spam“. Dann kommt sie beim nächsten Mal normal an.</p>
      <label class="f" for="code">Code aus der E-Mail<input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
      <button class="btn" id="verify">${reg?"Registrierung abschließen":"Anmelden"}</button><button class="btn ghost" id="restart">Andere E-Mail-Adresse</button>`
    : reg ? `<p class="soft">Für Creator der LIVEdream Agency. Gib deinen Namen, deinen TikTok-Namen und deine E-Mail-Adresse ein. Steht dein TikTok-Name auf unserer Liste, bist du sofort drin.</p>
      <label class="f" for="rg-name">Dein Name<input id="rg-name" type="text" autocomplete="name" value="${esc(r.name||"")}"></label>
      <label class="f" for="rg-handle">Dein TikTok-Name<input id="rg-handle" type="text" autocapitalize="none" autocomplete="off" placeholder="@deinname" value="${esc(r.handle||"")}"></label>
      <label class="f" for="email">E-Mail-Adresse<input id="email" type="email" autocomplete="email" value="${esc(email)}"></label>
      <button class="btn" id="register">Registrieren</button>
      <button class="btn ghost" id="to-login">Ich habe schon ein Konto</button>`
    : `<p class="soft">Melde dich mit deiner E-Mail-Adresse an. Du bekommst einen Anmelde-Link, ganz ohne Passwort.</p>
      <label class="f" for="email">E-Mail-Adresse<input id="email" type="email" autocomplete="email" value="${esc(email)}"></label>
      <button class="btn" id="send-link">Anmelde-Link schicken</button>
      <button class="btn ghost" id="to-register">Neu hier? Registrieren</button>`}
    ${err ? `<p class="err">${err}</p>` : ""}</div>
  </div>`;
  S._loginEmail = email;
}
async function otp(email, data){
  const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: location.origin + location.pathname, shouldCreateUser:true, data } });
  if (error) return error.status===429 ? "Zu viele Versuche. Bitte in ein paar Minuten nochmal." : esc(error.message);
  return null;
}
async function sendLink(){
  const email = lc($("#email").value);
  if (!/^\S+@\S+\.\S+$/.test(email)) return loginView(email,false,"Bitte eine gültige E-Mail-Adresse eingeben.");
  $("#send-link").disabled = true;
  const { data: ok, error: e1 } = await sb.rpc("is_member", { e: email });
  if (e1) return loginView(email,false,esc(e1.message));
  if (!ok) return loginView(email,false,"Diese Adresse ist nicht freigeschaltet. Bist du neu? Dann tippe unten auf „Neu hier? Registrieren“.");
  const er = await otp(email); if (er) return loginView(email,false,er);
  loginView(email,true);
}
async function register(){
  const name=$("#rg-name").value.trim(), handle=$("#rg-handle").value.trim().replace(/^@/,"").toLowerCase(), email=lc($("#email").value);
  S._reg={ name, handle };
  if (!name || !handle) return loginView(email,false,"Bitte Name und TikTok-Namen eingeben.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return loginView(email,false,"Bitte eine gültige E-Mail-Adresse eingeben.");
  $("#register").disabled = true;
  const { data: res, error } = await sb.rpc("register_check", { h:handle, e:email });
  if (error) return loginView(email,false,esc(error.message));
  if (res==="login"){ const er=await otp(email); if (er) return loginView(email,false,er); toast("Du hast schon ein Konto. Wir haben dir einen Anmelde-Code geschickt."); S._loginMode="login"; return loginView(email,true); }
  const msg = { not_on_list:`Der TikTok-Name <b>@${esc(handle)}</b> steht nicht auf unserer Liste. Prüf die Schreibweise oder melde dich bei deinem Manager.`,
    taken:`Der TikTok-Name <b>@${esc(handle)}</b> ist schon registriert. Wenn das nicht du warst, melde dich bitte bei deinem Manager.`,
    inactive:"Diese E-Mail-Adresse hat gerade keinen Zugang. Bitte melde dich bei deinem Manager.", missing:"Bitte alles ausfüllen." }[res];
  if (msg) return loginView(email,false,msg);
  storeSet("ldb-register", { name, handle, email });
  const er = await otp(email, { name, handle }); if (er) return loginView(email,false,er);
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
  manager: [["bewerten","Zu bewerten"],["creator","Meine Creator"],["fragen","Fragenbox"]],
  lead:    [["uebersicht","Übersicht"],["bewerten","Zu bewerten"],["fragen","Fragen & Umfrage"],["personen","Teilnehmer"],["themenedit","Themen & Start"]]
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
    <optgroup label="Creator">${opt("__preview","Creator: Vorschau (alle Themen offen)")}${allCreators().map(c=>opt(c.email,"Creator: "+label(c)+(c.bootcamp===false?" (nur Akademie)":""))).join("")}</optgroup>
  </select></label>
  ${S.viewAs?`<p class="viewnote">Du siehst die App gerade so wie ${S.viewAs==="__preview"?"ein Creator":esc(S.me.role==="creator"?label(S.me):S.me.name)}.${S.me.role==="creator"?" Abgeben ist hier gesperrt, Video und Handout kannst du durchklicken.":""}</p>`:""}
  ${S.needsUpdate?`<p class="err">Die Datenbank braucht noch das Update (update-2.sql). Bis dahin fehlen Startdatum, Fortschritt und Streak.</p>`:""}
  ${!S.needsUpdate&&(S.noExtras||S.noUpd5)?`<p class="err">Noch ein Datenbank-Update fehlt (${[S.noExtras&&"update-4.sql",S.noUpd5&&"update-5.sql"].filter(Boolean).join(", ")}).</p>`:""}`;
}
function render(keepScroll){
  applyView();
  const me=S.me;
  const sw=$("#switch"); sw.innerHTML = switcher(); sw.hidden = !sw.innerHTML.trim();
  const st = me.role==="creator" && !me.preview ? streakInfo(me.email).cur : 0;
  who.innerHTML = `${st?`<span class="chip" title="Tage am Stück dabei">🔥 <b>${st}</b></span>`:""}<span class="chip">${esc(me.role==="creator"?firstName(me):S.real.name)}</span><button class="chip" id="logout">Abmelden</button>`;
  const t = me.role==="creator" ? (inBootcamp(me) ? [["themen","Bootcamp"],["akademie","Akademie"]] : [["akademie","Akademie"]]) : [...TABS[me.role], ["akademie","Akademie"]];
  if (me.role==="creator" && !inBootcamp(me)) S.tab="akademie";
  tabsEl.hidden = t.length < 2 || !!S.openArea;
  tabsEl.innerHTML = t.map(([k,l]) => `<button data-tab="${k}" aria-pressed="${S.tab===k}">${l}</button>`).join("");
  document.querySelector(".wrap").classList.toggle("wide", me.role !== "creator");
  let html;
  if (S.tab==="akademie" && !S.creator) html = academyView();
  else if (me.role==="creator") html = S.openArea ? topicView(S.areas.find(a=>a.n===S.openArea)) : creatorHome();
  else if (S.creator) html = creatorDetail(S.creator);
  else html = ({ bewerten:pendingView, creator:managerList, uebersicht:leadOverview, fragen:feedbackView, personen:peopleView, themenedit:areaEditor }[S.tab] || pendingView)();
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
  </svg><div class="val"><div><b data-v="${pts}">${pts}</b><small>von ${max}</small></div></div></div>`;
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
  h += reminderBlock(e) + rewardsBlock(e);
  if (!snapOf(e,"vorher") && !S.noUpd5) h += snapBlock(e);
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
  h += surveyBlock(e) + topBlock() + (snapOf(e,"vorher")||S.noUpd5 ? snapBlock(e) : "") + extrasBlock(e) + questionBlock();
  return h;
}

const fileKind = p => isVid(p)?"Video":/\.pdf$/i.test(p||"")?"PDF":/\.(png|jpe?g|webp|gif)$/i.test(p||"")?"Bild":/\.zip$/i.test(p||"")?"Paket (ZIP)":"Datei";
const isVid = p => /\.(mp4|mov|webm|m4v)$/i.test(p||"");
function extraCard(x, seen){
  return `<a class="doc" data-handout="${esc(x.path)}" data-extra="${esc(x.id)}" target="_blank" rel="noopener"><span class="paper ${isVid(x.path)?"vid":""}"></span><span><b>${esc(x.title)}${seen && !seen.includes(x.id)?' <span class="tag gold">Neu</span>':""}</b><small class="muted">${fileKind(x.path)}${x.note?" · "+esc(x.note):""}</small></span></a>`;
}
function extrasBlock(e){
  const xs=S.extras.filter(x=>x.kind!=="reward" && audOf(x)==="bootcamp"); if (!xs.length) return "";
  const seen = storeGet("ldb-extras-"+e) || [];
  return `<div class="stack"><div class="wkh"><span>EXTRAS</span><small class="muted">Zusatz-Infos, ohne Punkte</small></div>
    <div class="extras">${xs.map(x=>extraCard(x,seen)).join("")}</div></div>`;
}

/* ---------- Erinnerung, Belohnungen, Vorher-Nachher, Top 5, Fragen, Umfrage ---------- */
function currentWeek(){ const now=Date.now(); return weeks().find(w=>{ const o=weekOpens(w); return o && now>=o.getTime() && now<o.getTime()+7*DAY; }); }
function reminderBlock(e){
  const w=currentWeek(); if (!w || S.me.preview) return "";
  const day=new Date().getDay(); if (![5,6,0].includes(day)) return "";
  const open=S.areas.filter(a=>a.week===w && !subOf(e,a.n)); if (!open.length) return "";
  const end=weekOpens(w).getTime()+7*DAY;
  return `<div class="panel remind"><div><b>⏰ ${day===0?"Heute ist Abgabe!":"Bald ist Abgabe"}</b><small class="muted">${open.map(a=>"Thema "+a.n).join(" und ")} bis Sonntag 24 Uhr</small></div><div class="flip" data-flip="${end}">${flipHtml(end-Date.now())}</div></div>`;
}
function rewardsBlock(e){
  const rw=S.extras.filter(x=>x.kind==="reward"), ok=passed(e)||S.me.preview;
  if (!ok) return `<div class="panel rewards locked"><b>🎁 Ab 10 Punkten freischalten</b><small class="muted">Deine Urkunde${rw.length?", "+rw.map(x=>esc(x.title)).join(", "):", Streamer-Rahmen, Overlay und mehr"}.</small></div>`;
  return `<div class="panel rewards stack"><div class="sh"><span class="eyebrow">Bestanden</span><h2>Deine <em>Belohnungen</em></h2></div>
    <div class="extras"><button class="doc" id="cert"><span class="paper cert"></span><span><b>Deine Urkunde</b><small class="muted">Als Bild oder PDF herunterladen</small></span></button>
    ${rw.map(x=>extraCard(x,null)).join("")}</div>
    ${!rw.length?`<p class="muted">Streamer-Rahmen, Overlay und mehr kommen hier bald dazu.</p>`:""}</div>`;
}
function snapBlock(e){
  const ro=readOnly()||S.me.preview, v=snapOf(e,"vorher"), n=snapOf(e,"nachher");
  const lastOpen = S.areas.length && (S.subs.filter(s=>s.creator_email===e).length>=S.areas.length || currentWeek()===weeks().at(-1));
  const slot=(k,x,lock)=>`<div class="snap">${x?`<a data-path="${esc(x.path)}" target="_blank" rel="noopener"><img data-img="${esc(x.path)}" alt="${k}"></a>`:`<div class="ph">${lock?"🔒":"＋"}</div>`}
    <small>${k==="vorher"?"Vorher":"Nachher"}</small>
    ${!ro&&!lock?`<label class="btn ghost small" for="snap-${k}">${x?"Ersetzen":"Hochladen"}<input id="snap-${k}" data-snap="${k}" type="file" accept="image/*" hidden></label>`:""}</div>`;
  return `<div class="panel stack"><div class="sh"><span class="eyebrow">Extra-Abzeichen 📸</span><h2>Vorher-<em>Nachher</em></h2></div>
    <p class="muted">${!v?"Mach jetzt einen Screenshot von deinem kompletten Profil und lade ihn hoch. Am Ende vom Bootcamp kommt das Nachher-Bild dazu.":!n?"Am Ende vom Bootcamp lädst du hier deinen Profil-Screenshot von danach hoch.":"Schau, wie viel sich getan hat!"}</p>
    <div class="snaps">${slot("vorher",v,false)}${slot("nachher",n,!lastOpen&&!n)}</div></div>`;
}
async function uploadSnap(kind, f){
  if (!f) return; if (f.size>MAX_FILE) return toast("Das Bild ist größer als 50 MB.");
  const e=S.me.email, safe=f.name.normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(-60), path=`${e}/snap/${kind}-${Date.now()}-${safe}`;
  try{
    toast("Wird hochgeladen …");
    let r=await sb.storage.from("nachweise").upload(path,f,{contentType:f.type||undefined}); if(r.error) throw r.error;
    r=await sb.from("snapshots").upsert({ creator_email:e, kind, path, created_at:new Date().toISOString() },{ onConflict:"creator_email,kind" }); if(r.error) throw r.error;
    await refresh(); render(true); toast(kind==="vorher"?"Vorher-Bild gespeichert.":"Nachher-Bild gespeichert. 📸");
  } catch(err){ fail(err); }
}
function topBlock(){
  if (!S.top.length) return "";
  const medal=["🥇","🥈","🥉","4","5"];
  return `<div class="panel stack"><div class="sh"><span class="eyebrow">Bestenliste</span><h2>Top <em>5</em></h2></div>
    <ol class="toplist">${S.top.map(t=>`<li><span class="pl">${medal[t.place-1]||t.place}</span><b>@${esc(String(t.handle).replace(/^@/,""))}</b></li>`).join("")}</ol>
    <small class="muted">Ohne Punkte, nur die Reihenfolge. Wird mit jeder Bewertung neu berechnet.</small></div>`;
}
function questionBlock(){
  if (S.noUpd5) return "";
  const pub=S.questions.filter(q=>q.published), ro=readOnly()||S.me.preview;
  return `<div class="panel stack"><div class="sh"><span class="eyebrow">Anonym</span><h2>Fragen<em>box</em></h2></div>
    <p class="muted">Frag, was du dich sonst nicht traust. Dein Name wird nicht gespeichert. Die Antworten kommen hier oder in einem Live.</p>
    <textarea id="qbox" maxlength="1000" placeholder="Deine Frage …"></textarea>
    <button class="btn ghost" id="qsend" ${ro?"disabled":""}>Anonym abschicken</button>
    ${pub.length?`<div class="list">${pub.map(q=>`<div class="row"><b>${esc(q.body)}</b>${q.answer?`<p class="feedback">${esc(q.answer)}</p>`:""}</div>`).join("")}</div>`:""}</div>`;
}
async function sendQuestion(){
  const body=($("#qbox").value||"").trim(); if (body.length<3) return toast("Schreib bitte eine Frage.");
  const r=await sb.from("questions").insert({ body }); if (r.error) return fail(r.error);
  $("#qbox").value=""; toast("Danke! Deine Frage ist anonym angekommen.");
}
function surveyBlock(e){
  if (S.noUpd5 || S.me.role!=="creator") return "";
  const all=S.areas.length && S.subs.filter(s=>s.creator_email===e).length>=S.areas.length;
  if (!all && !S.me.preview) return "";
  if (S.survey.find(x=>x.creator_email===e)) return `<div class="panel"><b>💜 Danke für dein Feedback!</b><small class="muted" style="display:block">Damit machen wir das nächste Bootcamp noch besser.</small></div>`;
  const d=S.survDraft;
  return `<div class="panel stack"><div class="sh"><span class="eyebrow">2 Minuten</span><h2>Wie war's <em>für dich?</em></h2></div>
    <div class="stars" role="group" aria-label="Bewertung">${[1,2,3,4,5].map(i=>`<button data-star="${i}" class="${(d.rating||0)>=i?"on":""}" aria-label="${i} Sterne">★</button>`).join("")}</div>
    <label class="f" for="sv-helped">Welches Thema hat dir am meisten geholfen?<select id="sv-helped"><option value="">–</option>${S.areas.map(a=>`<option value="${a.n}" ${+d.helped===a.n?"selected":""}>${a.n} · ${esc(a.title)}</option>`).join("")}</select></label>
    <label class="f" for="sv-missing">Was hat dir gefehlt?<textarea id="sv-missing" maxlength="1000">${esc(d.missing||"")}</textarea></label>
    <label class="f" for="sv-wish">Was wünschst du dir als nächste Schulung?<textarea id="sv-wish" maxlength="1000">${esc(d.wish||"")}</textarea></label>
    <button class="btn gold" id="sv-send" ${readOnly()||S.me.preview?"disabled":""}>Abschicken</button></div>`;
}
function keepSurveyDraft(){ const d=S.survDraft; if($("#sv-helped")){ d.helped=$("#sv-helped").value; d.missing=$("#sv-missing").value; d.wish=$("#sv-wish").value; } }
async function sendSurvey(){
  keepSurveyDraft(); const d=S.survDraft;
  if (!d.rating) return toast("Bitte gib zuerst Sterne.");
  const r=await sb.from("survey").insert({ creator_email:S.me.email, rating:d.rating, helped:+d.helped||null, missing:(d.missing||"").trim()||null, wish:(d.wish||"").trim()||null });
  if (r.error) return fail(r.error);
  await refresh(); render(true); toast("Danke! 💜");
}

/* ---------- Urkunde ---------- */
async function certificate(){
  const me=S.me, pts=total(me.email), s0=startDate()||new Date();
  const month=s0.toLocaleDateString("de-DE",{month:"long",year:"numeric"});
  toast("Urkunde wird erstellt …");
  try{ await Promise.all([document.fonts.load('800 120px Unbounded'),document.fonts.load('600 40px Poppins'),document.fonts.load('400 40px Poppins')]); }catch{}
  const W=2480, H=1754, c=document.createElement("canvas"); c.width=W; c.height=H; const x=c.getContext("2d");
  x.fillStyle="#060208"; x.fillRect(0,0,W,H);
  const glow=(gx,gy,r,col)=>{ const g=x.createRadialGradient(gx,gy,0,gx,gy,r); g.addColorStop(0,col); g.addColorStop(1,"rgba(6,2,8,0)"); x.fillStyle=g; x.fillRect(0,0,W,H); };
  glow(W*.88,H*.05,1100,"rgba(138,31,184,.55)"); glow(W*.05,H*.98,950,"rgba(184,40,127,.35)");
  for(let i=0;i<14;i++){ x.beginPath(); const y=H-120-i*14; x.moveTo(-40,y); x.bezierCurveTo(W*.3,y-60,W*.6,H*.55-i*20,W+40,H*.25-i*16); x.strokeStyle=i%4?`rgba(194,79,224,${.05+i*.012})`:`rgba(255,176,23,${.08+i*.012})`; x.lineWidth=2; x.stroke(); }
  x.strokeStyle="rgba(255,176,23,.55)"; x.lineWidth=4; x.strokeRect(70,70,W-140,H-140);
  x.strokeStyle="rgba(230,168,247,.25)"; x.lineWidth=2; x.strokeRect(92,92,W-184,H-184);
  const logo=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src="logo.png"; });
  if (logo){ const lw=300, lh=lw*logo.height/logo.width; x.drawImage(logo,(W-lw)/2,150,lw,lh); }
  x.textAlign="center"; x.fillStyle="#c24fe0"; x.font="600 40px Poppins"; x.fillText("L I V E D R E A M   C R E A T O R   B O O T C A M P", W/2, 590);
  x.fillStyle="#ffffff"; x.font="800 150px Unbounded"; x.fillText("URKUNDE", W/2, 770);
  x.fillStyle="#eadcf0"; x.font="400 46px Poppins"; x.fillText("Hiermit bestätigen wir, dass", W/2, 880);
  const name=me.name||label(me); let fs=130; x.font=`800 ${fs}px Unbounded`; while(x.measureText(name).width>W-500 && fs>60){ fs-=6; x.font=`800 ${fs}px Unbounded`; }
  const gg=x.createLinearGradient(W/2-700,0,W/2+700,0); gg.addColorStop(0,"#e6a8f7"); gg.addColorStop(1,"#d6409f"); x.fillStyle=gg; x.fillText(name, W/2, 1040);
  if (me.handle){ x.fillStyle="#9d8aa8"; x.font="500 44px Poppins"; x.fillText("@"+me.handle.replace(/^@/,""), W/2, 1115); }
  x.fillStyle="#eadcf0"; x.font="400 46px Poppins"; x.fillText(`das LIVEdream Creator Bootcamp (${month}) erfolgreich bestanden hat`, W/2, 1220);
  x.fillStyle="#FFB017"; x.font="700 46px Unbounded"; x.fillText(`${pts} von ${maxPts()} Punkten`, W/2, 1310);
  const today=new Date().toLocaleDateString("de-DE");
  x.strokeStyle="rgba(255,255,255,.35)"; x.lineWidth=2;
  [[W*.3,today,"Datum"],[W*.7,"LIVEdream Agency","Agenturleitung"]].forEach(([cx,t,l])=>{ x.beginPath(); x.moveTo(cx-260,1500); x.lineTo(cx+260,1500); x.stroke(); x.fillStyle="#fff"; x.font="600 42px Poppins"; x.fillText(t,cx,1475); x.fillStyle="#9d8aa8"; x.font="400 32px Poppins"; x.fillText(l,cx,1550); });
  const url=c.toDataURL("image/png"), base=`Urkunde-${(me.handle||me.name||"Creator").replace(/[^\w-]+/g,"_")}`;
  S._cert={ url, base, W, H };
  const w=$("#win"); $("#win-t").textContent="Deine Urkunde 🎉"; $("#win-p").innerHTML=`<img src="${url}" alt="Urkunde" style="width:100%;max-width:520px;border-radius:10px;margin:12px 0"><span class="actions" style="justify-content:center"><button class="btn small gold" id="cert-png">Als Bild speichern</button><button class="btn small" id="cert-pdf">Als PDF speichern</button></span>`;
  w.classList.add("show","keep"); confetti();
}
function dl(href, name){ const a=document.createElement("a"); a.href=href; a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
async function certPdf(){
  const C=S._cert; if(!C) return;
  if (!window.jspdf){ await new Promise((res,rej)=>{ const sc=document.createElement("script"); sc.src="vendor/jspdf.umd.min.js"; sc.onload=res; sc.onerror=rej; document.head.appendChild(sc); }).catch(()=>toast("PDF konnte nicht geladen werden. Nimm das Bild.")); }
  if (!window.jspdf) return;
  const doc=new window.jspdf.jsPDF({ orientation:"landscape", unit:"mm", format:"a4" }); doc.addImage(C.url,"PNG",0,0,297,210); doc.save(C.base+".pdf");
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
      : `<p class="muted">Für dieses Thema gibt es kein Handout.</p>`}
    ${!l2 && S.extras.some(x=>x.area===a.n&&x.kind!=="reward"&&audOf(x)==="bootcamp") ? `<small class="muted">Zusätzlich zu diesem Thema</small><div class="extras">${S.extras.filter(x=>x.area===a.n&&x.kind!=="reward"&&audOf(x)==="bootcamp").map(x=>extraCard(x,storeGet("ldb-extras-"+e)||[])).join("")}</div>`:""}</section>`;
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
  const w=$("#win"); w.classList.remove("keep"); w.classList.add("show"); confetti();
  clearTimeout(celebrate._t); celebrate._t=setTimeout(()=>{ if(!w.classList.contains("keep")) w.classList.remove("show"); },3600);
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
    <p class="muted">${esc(c.name)} · ${esc(c.email)} · ${total(email)} von ${maxPts()} Punkten · 🔥 ${streakInfo(email).cur} Tage</p></div>
    ${snapOf(email,"vorher")||snapOf(email,"nachher")?`<div class="panel stack"><h2>Vorher-Nachher</h2><div class="snaps">${["vorher","nachher"].map(k=>{const x=snapOf(email,k); return `<div class="snap">${x?`<a data-path="${esc(x.path)}" target="_blank" rel="noopener"><img data-img="${esc(x.path)}" alt="${k}"></a>`:`<div class="ph">–</div>`}<small>${k==="vorher"?"Vorher":"Nachher"}</small></div>`;}).join("")}</div></div>`:""}
    <div class="list">`;
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

function feedbackView(){
  const lead=S.me.role==="lead";
  if (S.noUpd5) return `<div class="panel"><p class="err">Zuerst update-5.sql in Supabase ausführen.</p></div>`;
  let h=`<div class="stack"><span class="eyebrow">Anonym</span><h1>Frage<em>nbox</em></h1><p class="muted">${lead?"Antworte und veröffentliche, dann sehen alle Creator Frage und Antwort. Oder beantworte sie gesammelt im Live.":"Die anonymen Fragen der Creator. Antworten veröffentlicht die Agenturleitung."}</p></div>`;
  h += S.questions.length ? `<div class="list">${S.questions.map(q=>`<div class="row"><div class="head"><b>${esc(q.body)}</b><span class="tag ${q.published?"ok":""}">${q.published?"veröffentlicht":"neu"}</span></div>
      <small class="muted">${fmtAgo(q.created_at)}</small>
      ${lead?`<textarea id="qa-${q.id}" placeholder="Antwort (optional)">${esc(q.answer||"")}</textarea>
      <div class="actions"><button class="btn small" data-qpub="${q.id}">${q.published?"Antwort speichern":"Veröffentlichen"}</button>${q.published?`<button class="btn small ghost" data-qsave="${q.id}">Verstecken</button>`:""}<button class="btn small danger" data-qdel="${q.id}">${S.confirmDelete===q.id?"Wirklich löschen?":"Löschen"}</button></div>`
      : q.answer?`<p class="feedback">${esc(q.answer)}</p>`:""}</div>`).join("")}</div>` : `<div class="panel"><p class="muted">Noch keine Fragen.</p></div>`;
  if (lead){
    const sv=S.survey, n=sv.length, avg=n?(sv.reduce((a,x)=>a+x.rating,0)/n).toFixed(1):"–";
    const cnt={}; sv.forEach(x=>{ if(x.helped) cnt[x.helped]=(cnt[x.helped]||0)+1; });
    h += `<div class="stack"><span class="eyebrow">Am Ende</span><h1><em>Umfrage</em></h1></div>
    <div class="score"><div class="panel stat"><b>${n}</b><small>Antworten</small></div><div class="panel stat"><b>${avg}</b><small>Sterne im Schnitt</small></div><div class="panel stat"><b>${Object.keys(cnt).length?Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0]:"–"}</b><small>hilfreichstes Thema</small></div></div>
    ${n?`<div class="list">${sv.map(x=>{ const c=member(x.creator_email); return `<div class="row"><div class="head"><b>${esc(label(c)||x.creator_email)}</b><span class="tag gold">${"★".repeat(x.rating)}</span></div>
      ${x.helped?`<small class="muted">Am meisten geholfen: Thema ${x.helped} · ${esc(S.areas.find(a=>a.n===x.helped)?.title||"")}</small>`:""}
      ${x.missing?`<p class="feedback"><b>Gefehlt:</b> ${esc(x.missing)}</p>`:""}${x.wish?`<p class="feedback gold"><b>Wunsch:</b> ${esc(x.wish)}</p>`:""}</div>`; }).join("")}</div>`:`<div class="panel"><p class="muted">Die Umfrage erscheint bei den Creatorn, sobald sie alle Themen abgegeben haben.</p></div>`}`;
  }
  return h;
}
async function answerQ(id, publish){
  const ans=($(`#qa-${id}`)?.value||"").trim()||null, q=S.questions.find(x=>x.id===id);
  const row = publish===null ? { published:false } : { answer:ans, answered_at:ans?new Date().toISOString():null, published:true };
  const r=await sb.from("questions").update(row).eq("id",id); if(r.error) return fail(r.error);
  await refresh(); render(true); toast(publish===null?"Versteckt.":q?.published?"Gespeichert.":"Veröffentlicht.");
}
async function delQ(id){
  if (S.confirmDelete!==id){ S.confirmDelete=id; return render(true); }
  S.confirmDelete=null; const r=await sb.from("questions").delete().eq("id",id); if(r.error) return fail(r.error);
  await refresh(); render(true); toast("Gelöscht.");
}

/* ---------- Akademie ---------- */
function academyView(){
  const me=S.me, staff=me.role!=="creator", lead=me.role==="lead";
  const xs=S.extras.filter(x=>x.kind!=="reward" && (audOf(x)==="all" || (audOf(x)==="team" && staff)));
  const seen=storeGet("ldb-extras-"+me.email)||[];
  const groups={}; xs.forEach(x=>{ (groups[x.category||"Allgemein"] ||= []).push(x); });
  let h=`<div class="stack"><span class="eyebrow">LIVEdream Academy</span><h1>Die <em>Akademie</em></h1>
    <p class="muted">Schulungen, Videos und Infos für alle Creator der LIVEdream Agency. Immer offen, ohne Punkte.</p></div>`;
  if (lead) h += S.noRoster ? `<div class="panel"><p class="err">Zuerst update-6.sql in Supabase ausführen, dann kannst du hier Inhalte hochladen.</p></div>` : `<div class="panel stack"><h2>Inhalt hinzufügen</h2>
    <div class="grid2"><label class="f" for="ak-title">Titel<input id="ak-title" type="text" placeholder="z. B. Schulung Videoproduktion"></label>
    <label class="f" for="ak-cat">Rubrik<input id="ak-cat" type="text" list="ak-cats" placeholder="z. B. Schulungen"><datalist id="ak-cats">${[...new Set(S.extras.map(x=>x.category).filter(Boolean).concat(["Schulungen","Infos","Videos"]))].map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label>
    <label class="f" for="ak-note">Kurzbeschreibung (optional)<input id="ak-note" type="text"></label>
    <label class="f" for="ak-aud">Wer sieht es?<select id="ak-aud"><option value="all">Alle Creator der Agentur</option><option value="team">Nur Manager und Leitung</option></select></label></div>
    <label class="f" for="ak-file">Datei (PDF, Video, Bild oder ZIP, max. 50 MB)<input id="ak-file" type="file"></label>
    <button class="btn small" id="ak-add">Hinzufügen</button></div>`;
  const cats=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  if (!cats.length) h += `<div class="panel"><p class="muted">Hier kommen bald Schulungen und Infos rein.</p></div>`;
  for (const c of cats){
    h += `<div class="wkh"><span>${esc(c.toUpperCase())}</span></div><div class="extras">${groups[c].map(x=> lead
      ? `<div class="row"><div class="head">${extraCard(x,seen)}</div><div class="actions"><span class="tag">${audOf(x)==="team"?"nur Team":"alle Creator"}</span><button class="chip" data-delextra="${esc(x.id)}">${S.confirmDelete===x.id?"Wirklich löschen?":"Löschen"}</button></div></div>`
      : extraCard(x,seen)).join("")}</div>`;
  }
  return h;
}

/* ---------- TikTok-Liste (Zugang) ---------- */
const normH = h => String(h||"").trim().replace(/^@/,"").toLowerCase();
function parseRoster(text){
  const staff=S.members.filter(m=>m.role!=="creator"), rows=[], warn=[];
  const lines=String(text||"").replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean);
  lines.forEach((l,i)=>{
    const c=l.split(/\t|;|,/).map(x=>x.trim().replace(/^"|"$/g,""));
    if (i===0 && /tiktok|handle|manager|bootcamp/i.test(l) && !/^@/.test(c[0])) return;
    const handle=normH(c[0]); if (!handle || /\s/.test(handle)) { if(handle) warn.push(`Zeile ${i+1}: „${c[0]}“ ist kein TikTok-Name`); return; }
    const row={ handle };
    if (c[1]){ const m=staff.find(x=>lc(x.name)===lc(c[1])||x.email===lc(c[1])||lc(x.name).split(" ")[0]===lc(c[1])); if (m) row.manager_email=m.email; else warn.push(`@${handle}: Manager „${c[1]}“ nicht gefunden`); }
    if (c[2]) row.bootcamp=/^(ja|j|yes|y|x|1|true|bootcamp)$/i.test(c[2]);
    rows.push(row);
  });
  return { rows, warn };
}
function rosterPreview(){
  const { rows, warn }=parseRoster($("#ro-text").value), replace=$("#ro-replace").checked;
  if (!rows.length) return toast("Keine TikTok-Namen gefunden.");
  const now=new Set(S.roster.map(r=>r.handle)), inList=new Set(rows.map(r=>r.handle));
  const neu=rows.filter(r=>!now.has(r.handle)).length, gone=replace?S.roster.filter(r=>!inList.has(r.handle)):[];
  S.rosterPreview={ rows, warn, replace, neu, gone, text:$("#ro-text").value }; render(true);
}
async function rosterApply(){
  const P=S.rosterPreview; if(!P) return;
  const { data, error }=await sb.rpc("import_roster",{ rows:P.rows, replace_all:P.replace });
  if (error) return fail(error);
  S.rosterPreview=null; await refresh(); render(true); toast(`Liste übernommen (${data} Namen).`);
}
async function rosterToggle(h){
  const r=S.roster.find(x=>x.handle===h); if(!r) return;
  const { error }=await sb.rpc("import_roster",{ rows:[{ handle:h, bootcamp:!r.bootcamp }], replace_all:false }); if(error) return fail(error);
  await refresh(); render(true);
}
async function rosterDelete(h){
  const k="ro:"+h; if (S.confirmDelete!==k){ S.confirmDelete=k; return render(true); }
  S.confirmDelete=null; const { error }=await sb.from("roster").delete().eq("handle",h); if(error) return fail(error);
  await refresh(); render(true); toast(`@${h} hat keinen Zugang mehr.`);
}
function rosterPanel(){
  if (S.noRoster) return `<div class="panel"><p class="err">Für die TikTok-Liste zuerst update-6.sql in Supabase ausführen.</p></div>`;
  const P=S.rosterPreview, reg=h=>allCreators().find(m=>normH(m.handle)===h);
  let h=`<div class="panel stack"><h2>TikTok-Liste <small class="muted">(${S.roster.length})</small></h2>
    <p class="muted">Nur wer auf dieser Liste steht, kann sich registrieren und die Academy nutzen. Eine Zeile pro Creator: <b>TikTok-Name; Manager; Bootcamp (ja/nein)</b>. Du kannst die Spalten direkt aus Excel kopieren oder eine CSV-Datei wählen. Fehlt Manager oder Bootcamp, bleibt der bisherige Wert.</p>
    <textarea id="ro-text" placeholder="@luna.live; Parec; ja&#10;@gamer_kevin; Alan; nein">${esc(P?.text||"")}</textarea>
    <div class="actions"><label class="btn small ghost" for="ro-file">CSV-Datei wählen<input id="ro-file" type="file" accept=".csv,.txt,text/csv,text/plain" hidden></label></div>
    <label class="qopt" style="font-size:13px;color:var(--soft)"><input type="checkbox" id="ro-replace" ${P?.replace?"checked":""}> Liste ersetzen: Wer nicht in der neuen Liste steht, verliert den Zugang</label>
    ${P?`<div class="feedback gold"><b>Vorschau:</b> ${P.rows.length} Namen, davon ${P.neu} neu.${P.replace?` <b>${P.gone.length} verlieren den Zugang</b>${P.gone.length?": "+P.gone.slice(0,12).map(r=>"@"+esc(r.handle)).join(", ")+(P.gone.length>12?" …":""):""}.`:""}
      ${P.warn.length?`<br><span style="color:var(--err)">${P.warn.slice(0,8).map(esc).join("<br>")}</span>`:""}</div>
      <div class="actions"><button class="btn small gold" id="ro-apply">Ja, übernehmen</button><button class="btn small ghost" id="ro-cancel">Abbrechen</button></div>`
    : `<button class="btn small" id="ro-preview">Vorschau</button>`}</div>`;
  if (S.roster.length) h += `<div class="list">${S.roster.map(r=>{ const m=reg(r.handle); return `<div class="row"><div class="head"><b>@${esc(r.handle)}</b><span class="actions">
      <button class="chip" data-robc="${esc(r.handle)}" title="Bootcamp an/aus">${r.bootcamp?"🎓 Bootcamp":"Nur Akademie"}</button>
      <button class="chip" data-rodel="${esc(r.handle)}">${S.confirmDelete==="ro:"+r.handle?"Wirklich entfernen?":"Entfernen"}</button></span></div>
      <span class="muted">${m?`✓ registriert (${esc(m.email)})`:"noch nicht registriert"} · ${esc(member(r.manager_email)?.name||"ohne Manager")}</span></div>`; }).join("")}</div>`;
  return h;
}

/* ---------- Teilnehmer verwalten ---------- */
function peopleView(){
  const m = S.editMember ? member(S.editMember) : null;
  const managers = S.members.filter(x=>x.role!=="creator");
  let h = `<div class="stack"><span class="eyebrow">Agenturleitung</span><h1><em>Teilnehmer</em></h1></div>${rosterPanel()}
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
  if (row.role==="creator" && row.handle && !S.noRoster){ const r2=await sb.rpc("import_roster",{ rows:[{ handle:row.handle, manager_email:row.manager_email, bootcamp:true }], replace_all:false }); if (r2.error) console.warn(r2.error); }
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
  h += `<div class="panel stack"><h2>Extras & Belohnungen</h2><p class="muted">Extras sind immer offen, geben keine Punkte und erscheinen bei den Creatorn mit „Neu“-Zeichen. Belohnungen (z. B. Streamer-Rahmen, Overlay, Animation) sehen nur Creator ab 10 Punkten, zusammen mit ihrer Urkunde.</p>
    ${S.noExtras ? `<p class="err">Zuerst update-4.sql in Supabase ausführen.</p>` : `
    ${S.extras.filter(x=>audOf(x)==="bootcamp").length?`<div class="list">${S.extras.filter(x=>audOf(x)==="bootcamp").map(x=>`<div class="row"><div class="head"><b>${x.kind==="reward"?"🎁":isVid(x.path)?"🎬":"📄"} ${esc(x.title)}${x.area?` <span class="muted">· Thema ${x.area}</span>`:""}</b><span class="actions"><a class="chip" data-handout="${esc(x.path)}" target="_blank" rel="noopener" style="text-decoration:none">Öffnen</a><button class="chip" data-delextra="${esc(x.id)}">${S.confirmDelete===x.id?"Wirklich löschen?":"Löschen"}</button></span></div>${x.note?`<span class="muted">${esc(x.note)}</span>`:""}</div>`).join("")}</div>`:""}
    <div class="grid2"><label class="f" for="ex-title">Titel<input id="ex-title" type="text" placeholder="z. B. Richtlinien & Tabus"></label>
    <label class="f" for="ex-note">Kurzbeschreibung (optional)<input id="ex-note" type="text" placeholder="z. B. Was im Live erlaubt ist"></label></div>
    <div class="grid2"><label class="f" for="ex-kind">Art<select id="ex-kind"><option value="extra">Extra (für alle, sofort)</option><option value="reward">Belohnung (ab 10 Punkten)</option></select></label>
    <label class="f" for="ex-file">Datei (PDF, Video, Bild oder ZIP, max. 50 MB)<input id="ex-file" type="file"></label>
    <label class="f" for="ex-area">Auch bei Thema zeigen (optional)<select id="ex-area"><option value="">–</option>${S.areas.map(y=>`<option value="${y.n}">${y.n} · ${esc(y.title)}</option>`).join("")}</select></label></div>
    <button class="btn small" id="ex-add">Extra hinzufügen</button>`}</div>`;
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
async function addExtra(pre="ex"){
  const q=id=>$(`#${pre}-${id}`);
  const title=q("title").value.trim(), note=q("note").value.trim()||null, f=q("file").files[0];
  if (!title || !f) return toast("Bitte Titel und Datei auswählen.");
  const vid=/^video\//.test(f.type)||isVid(f.name), ext=(f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]||(vid?"mp4":"pdf")).toLowerCase(), area=+(q("area")?.value)||null, kind=q("kind")?.value||"extra", audience=q("aud")?.value||null, category=q("cat")?.value.trim()||null;
  if (f.size>MAX_FILE) return toast("Die Datei ist größer als 50 MB.");
  try{
    q("add").disabled=true; q("add").textContent="Wird hochgeladen …";
    const path=`extra-${Date.now()}.${ext}`; let r=await sb.storage.from("unterlagen").upload(path,f,{contentType:f.type||"application/octet-stream"}); if(r.error) throw r.error;
    r=await sb.from("extras").insert(Object.assign({ title, note, path, area, sort:S.extras.length }, kind==="reward"?{kind}:{}, audience?{audience, category}:{})); if(r.error) throw r.error;
    await refresh(); render(true); toast("Extra hinzugefügt.");
  } catch(e){ fail(e); render(true); }
}
async function delExtra(id){
  if (S.confirmDelete!==id){ S.confirmDelete=id; return render(true); }
  const x=S.extras.find(y=>y.id===id); S.confirmDelete=null;
  const r=await sb.from("extras").delete().eq("id",id); if(r.error) return fail(r.error);
  if (x) await sb.storage.from("unterlagen").remove([x.path]).catch(()=>{});
  await refresh(); render(true); toast("Gelöscht.");
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


/* ---------- Impressum & Datenschutz ---------- */
const LEGAL = {
impressum: `<h1>Impressum</h1>
<p>Angaben gemäß § 5 DDG</p>
<p><b>Sophie Berger</b><br>c/o LIVEdream Agency UG (haftungsbeschränkt)<br>Hardenbergstraße 83<br>51373 Leverkusen<br>Deutschland</p>
<p>E-Mail: <a href="mailto:zofy_creates@web.de">zofy_creates@web.de</a><br>Kontaktformular: <a href="https://forms.gle/gtkiCJp1DUDsdvmV7" target="_blank" rel="noopener">forms.gle/gtkiCJp1DUDsdvmV7</a></p>
<p>Verantwortlich für den Inhalt: Sophie Berger (Anschrift wie oben)</p>
<h2>Rechte an der App</h2>
<p>Die LIVEdream Academy (Konzept, Gestaltung, Programmcode und Inhalte der App) ist ein persönliches Werk von Sophie Berger. Alle Rechte liegen bei ihr persönlich und nicht bei der LIVEdream Agency UG (haftungsbeschränkt). Die Agentur nutzt die App mit Erlaubnis von Sophie Berger. Diese Erlaubnis kann jederzeit widerrufen werden. Vervielfältigung oder Weitergabe nur mit schriftlicher Zustimmung.</p>
<h2>Streitbeilegung</h2>
<p>Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle bin ich nicht verpflichtet und nicht bereit.</p>`,
datenschutz: `<h1>Datenschutz&shy;erklärung</h1>
<p>Stand: November 2026</p>
<h2>1. Verantwortliche</h2>
<p>Sophie Berger, c/o LIVEdream Agency UG (haftungsbeschränkt), Hardenbergstraße 83, 51373 Leverkusen. E-Mail: <a href="mailto:zofy_creates@web.de">zofy_creates@web.de</a></p>
<h2>2. Wofür ist die App da?</h2>
<p>Die LIVEdream Academy ist eine Schulungsplattform für Creator und Manager der LIVEdream Agency. Sie stellt Lehrvideos, Handouts und Aufgaben bereit und ermöglicht Abgaben, Bewertungen und Rückmeldungen.</p>
<h2>3. Welche Daten wir verarbeiten</h2>
<ul>
<li><b>Konto:</b> E-Mail-Adresse, Name, TikTok-Name, Rolle (Creator, Manager, Agenturleitung) und zugeordneter Manager.</li>
<li><b>Anmeldung:</b> Beim Login schicken wir dir einen Link oder Code per E-Mail. Dabei werden technisch nötige Daten wie Zeitpunkt und IP-Adresse kurz verarbeitet.</li>
<li><b>Lernfortschritt:</b> ob du Video, Quiz und Handout eines Themas abgeschlossen hast, an welchen Tagen du die App geöffnet hast (für die Streak-Anzeige) und deine Abzeichen.</li>
<li><b>Abgaben:</b> die Dateien, die du hochlädst (Fotos, Videos, PDFs), deine Nachricht an deinen Manager, Punkte und Rückmeldungen. Dazu deine Vorher-Nachher-Screenshots, falls du welche hochlädst.</li>
<li><b>Fragenbox:</b> Fragen werden ohne Namen und ohne E-Mail-Adresse gespeichert.</li>
<li><b>Umfrage:</b> deine Antworten. Sie sieht nur die Agenturleitung.</li>
<li><b>Bestenliste:</b> In den Top 5 erscheint dein TikTok-Name für die anderen Teilnehmer, ohne Punkte.</li>
</ul>
<h2>4. Wer sieht was?</h2>
<p>Du siehst deine eigenen Daten. Dein Manager sieht die Daten seiner Creator. Die Agenturleitung sieht alle Daten. Andere Creator sehen deine Daten nicht, nur deinen TikTok-Namen in der Bestenliste, wenn du in den Top 5 bist.</p>
<h2>5. Rechtsgrundlagen</h2>
<p>Wir verarbeiten deine Daten, um dir die Schulung im Rahmen deiner Zusammenarbeit mit der LIVEdream Agency anzubieten (Art. 6 Abs. 1 lit. b DSGVO). Die Bestenliste, die Streak-Anzeige und die Umfrage dienen unserem berechtigten Interesse, die Schulung motivierend zu gestalten und zu verbessern (Art. 6 Abs. 1 lit. f DSGVO).</p>
<h2>6. Dienstleister</h2>
<ul>
<li><b>Supabase</b> (Supabase Inc., USA) speichert Datenbank, Login und Dateien. Die Server stehen in Frankfurt am Main (EU). Es besteht ein Vertrag zur Auftragsverarbeitung mit EU-Standardvertragsklauseln.</li>
<li><b>Netlify</b> (Netlify Inc., USA) stellt die Webseite bereit. Beim Aufruf werden technisch nötige Daten wie IP-Adresse und Zeitpunkt verarbeitet. Eine Übermittlung in die USA ist möglich. Sie ist durch EU-Standardvertragsklauseln bzw. das EU-US Data Privacy Framework abgesichert.</li>
<li><b>Login-E-Mails</b> werden über den E-Mail-Dienst WEB.DE (1&amp;1 Mail &amp; Media GmbH, Deutschland) verschickt.</li>
</ul>
<p>Schriften und Programmbibliotheken liegen direkt auf unserem Server. Es werden keine Daten an Google oder andere Anbieter geschickt. Wir nutzen keine Werbe- oder Analyse-Cookies und kein Tracking.</p>
<h2>7. Speicher in deinem Browser</h2>
<p>Die App speichert in deinem Browser deine Anmeldung und kleine Merkhilfen, etwa welche Abzeichen und Extras du schon gesehen hast. Das ist technisch nötig (§ 25 Abs. 2 TDDDG). Du kannst es jederzeit über die Browser-Einstellungen löschen.</p>
<h2>8. Wie lange wir speichern</h2>
<p>Wir speichern deine Daten, solange du Zugang zur Academy hast. Endet deine Zusammenarbeit mit der Agentur, löschen wir dein Konto und deine Dateien, sofern keine gesetzlichen Aufbewahrungspflichten bestehen. Auf Wunsch löschen wir früher.</p>
<h2>9. Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Schreib dafür einfach an <a href="mailto:zofy_creates@web.de">zofy_creates@web.de</a>. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.</p>`
};
function showLegal(){
  const k=location.hash.slice(1); let el=$("#legalpage");
  if (!LEGAL[k]) { if (el) el.remove(); return; }
  if (!el){ el=document.createElement("div"); el.id="legalpage"; el.className="legalpage"; document.body.appendChild(el); }
  el.innerHTML=`<div class="wrap"><button class="btn ghost small back" id="legal-back">← Zurück</button><div class="panel stack legaltext">${LEGAL[k]}</div></div>`;
  el.scrollTop=0;
}
window.addEventListener("hashchange", showLegal);

/* ---------- Ereignisse ---------- */
document.addEventListener("click", async e => {
  if (e.target.closest("#cert-png")) { dl(S._cert.url, S._cert.base+".png"); return; }
  if (e.target.closest("#cert-pdf")) { certPdf(); return; }
  if (e.target.closest("#win")) { $("#win").classList.remove("show","keep"); return; }
  const t = e.target.closest("button,a"); if (!t) return;
  if (t.id==="legal-back"){ history.replaceState(null,"",location.pathname+location.search); return showLegal(); }
  if (t.id==="send-link") return sendLink();
  if (t.id==="verify") return verifyCode();
  if (t.id==="restart") return loginView();
  if (t.id==="register") return register();
  if (t.id==="to-register"){ S._loginMode="register"; return loginView($("#email")?.value||""); }
  if (t.id==="to-login"){ S._loginMode="login"; return loginView($("#email")?.value||""); }
  if (t.id==="logout"){ await sb.auth.signOut(); Object.assign(S,{me:null,real:null,viewAs:"",tab:null,creator:null,openArea:null,ringShown:false,localProg:{}}); return loginView(); }
  if (t.dataset.tab){ S.tab=t.dataset.tab; S.creator=null; S.editMember=null; return render(); }
  if (t.dataset.area){
    const st=t.dataset.state;
    if (st==="lock") return toast("Gib zuerst das Thema davor ab.");
    if (st==="time") return toast("Diese Woche öffnet am Montag um 0 Uhr.");
    S.openArea=+t.dataset.area; return render();
  }
  if (t.id==="cert") return certificate();
  if (t.id==="qsend") return sendQuestion();
  if (t.dataset.star){ keepSurveyDraft(); S.survDraft.rating=+t.dataset.star; return render(true); }
  if (t.id==="sv-send") return sendSurvey();
  if (t.dataset.qpub) return answerQ(t.dataset.qpub, true);
  if (t.dataset.qsave) return answerQ(t.dataset.qsave, null);
  if (t.dataset.qdel) return delQ(t.dataset.qdel);
  if (t.id==="home"){ S.openArea=null; return render(); }
  if (t.dataset.quiz) return answerQuiz(+t.dataset.quiz, +t.dataset.j);
  if (t.dataset.seen) return markStep(+t.dataset.seen,"video_at");
  if (t.dataset.extra){ if (!t.href) { e.preventDefault(); toast("Lädt noch, bitte gleich nochmal tippen."); return; }
    if (!S.viewAs){ const k="ldb-extras-"+S.me.email, seen=storeGet(k)||[]; if(!seen.includes(t.dataset.extra)){ seen.push(t.dataset.extra); storeSet(k,seen); setTimeout(()=>render(true),400); } } return; }
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
  if (t.id==="ex-add") return addExtra("ex");
  if (t.id==="ak-add") return addExtra("ak");
  if (t.id==="ro-preview") return rosterPreview();
  if (t.id==="ro-apply") return rosterApply();
  if (t.id==="ro-cancel"){ S.rosterPreview=null; return render(true); }
  if (t.dataset.robc) return rosterToggle(t.dataset.robc);
  if (t.dataset.rodel) return rosterDelete(t.dataset.rodel);
  if (t.dataset.delextra) return delExtra(t.dataset.delextra);
  if (t.id==="ae-save") return saveArea();
});
document.addEventListener("change", e => {
  if (e.target.dataset.up){
    const n=+e.target.dataset.up, fs=[...e.target.files], big=fs.filter(f=>f.size>MAX_FILE);
    if (big.length) toast(`${big.map(f=>f.name).join(", ")} ist größer als 50 MB. Bitte kürzer aufnehmen.`);
    S.pending[n]=[...(S.pending[n]||[]), ...fs.filter(f=>f.size<=MAX_FILE)];
    e.target.value=""; $("#pend").innerHTML=pendList(n);
  }
  if (e.target.id==="viewas"){ S.viewAs=e.target.value; S.quiz={}; S.creator=null; S.openArea=null; S.editMember=null; S.ringShown=false; S.localProg={}; applyView(); S.tab = S.me.role==="creator"?(inBootcamp(S.me)?"themen":"akademie"):S.me.role==="manager"?"bewerten":"uebersicht"; return render(); }
  if (e.target.id==="ro-file"){ const f=e.target.files[0]; if(f) f.text().then(tx=>{ $("#ro-text").value=tx; toast("Datei eingelesen. Jetzt „Vorschau“ tippen."); }); return; }
  if (e.target.dataset.snap) return uploadSnap(e.target.dataset.snap, e.target.files[0]);
  if (e.target.id==="ae-n"){ S.editArea=+e.target.value; render(true); }
});
document.addEventListener("input", e => { if (e.target.id==="note"){ const c=$("#cnt"); if(c) c.textContent=`${e.target.value.length} / 1000`; } });
document.addEventListener("keydown", e => {
  if (e.key==="Escape") $("#win").classList.remove("show");
  if (e.key!=="Enter") return;
  if (e.target.id==="email") (S._loginMode==="register" ? register() : sendLink());
  if (e.target.id==="code") verifyCode();
});

showLegal();
boot();
})();
