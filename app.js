/* LIVEdream Creator Bootcamp – App (ohne Build-Schritt, läuft als statische Seite) */
(() => {
"use strict";
const CFG = window.BOOTCAMP_CONFIG || {};
const MAX_FILE = 50 * 1024 * 1024;
const DAY = 864e5;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const view = $("#view"), who = $("#who"), bnav = $("#bnav");

let sb = null;
const S = { session:null, me:null, real:null, viewAs:"", areas:[], members:[], subs:[], progress:[], activity:[], settings:{}, roster:[], noRoster:false, rosterPreview:null, extras:[], noExtras:false, snaps:[], questions:[], survey:[], top:[], noUpd5:false, survDraft:{}, cal:[], tasks:[], noUpd7:false, qres:[], noUpd8:false, qz:null, xp:[], bs:[], bsTop:[], goals:[], noUpd9:false, refs:[], noUpd11:false, gchk:[], gnote:[], noUpd13:false, mp:[], ml:[], wins:[], wr:[], noUpd16:false, mpForm:false, wForm:false,  gOpen:new Set(), impAns:null,
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
  hydrateAvatars().catch(console.error); hydrateCovers().catch(console.error); hydrateWins().catch(console.error);
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
  const vids=[...document.querySelectorAll("video[data-video]:not([src])")];
  if (vids.length){
    const ps=[...new Set(vids.map(v=>v.dataset.video))], { data } = await sb.storage.from("unterlagen").createSignedUrls([...ps, ...ps.map(posterOf)], 6*3600);
    const map=Object.fromEntries((data||[]).filter(d=>d.signedUrl).map(d=>[d.path,d.signedUrl]));
    vids.forEach(v=>{ const p=v.dataset.video, u=map[p]; if (!u) return;
      if (map[posterOf(p)]) { v.poster=map[posterOf(p)]; v.src=u; }
      else { v.src=u+"#t=0.5"; backfillPoster(p,u); } });
  }
  const vth=[...document.querySelectorAll("img[data-vposter]:not([src])")];
  if (vth.length){
    const ps=[...new Set(vth.map(i=>i.dataset.vposter))], { data } = await sb.storage.from("unterlagen").createSignedUrls([...ps, ...ps.map(posterOf)], 3600);
    const map=Object.fromEntries((data||[]).filter(d=>d.signedUrl).map(d=>[d.path,d.signedUrl]));
    vth.forEach(i=>{ const p=i.dataset.vposter; if (map[posterOf(p)]) i.src=map[posterOf(p)]; else if (map[p]) backfillPoster(p,map[p]).then(b=>{ if (b) i.src=URL.createObjectURL(b); }); });
  }
  for (const i of document.querySelectorAll("img[data-cimg]:not([src])")) {
    const { data:d } = await sb.storage.from("unterlagen").createSignedUrl(i.dataset.cimg, 3600);
    if (d?.signedUrl){ i.src = d.signedUrl; const a=i.closest("a[data-chref]"); if (a) a.href=d.signedUrl; }
  }
  for (const e of document.querySelectorAll("a[data-handout]:not([href])")) {
    const { data:d } = await sb.storage.from("unterlagen").createSignedUrl(e.dataset.handout, 3600);
    if (d?.signedUrl) e.href = d.signedUrl;
  }
}
function watchVideos(){
  const iv=$("video[data-intro]");
  if (iv && !iv._w){ iv._w=true;
    const ok=()=>{ if (S.introOk) return; S.introOk=true; const b=$("#intro-go"); if(b){ b.disabled=false; b.classList.add("pulse"); b.textContent="Weiter zum Bootcamp"; } const hnt=$("#intro-hint"); if(hnt) hnt.textContent="Super! Jetzt geht's los."; };
    iv.addEventListener("timeupdate",()=>{ if (iv.duration && iv.currentTime/iv.duration>=0.9) ok(); });
    iv.addEventListener("ended",ok);
    iv.addEventListener("error",ok);
  }
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
        const ref = md.ref || (reg.email===email ? reg.ref : "");
        if (res==="ok" && ref) { const rr=await sb.rpc("claim_referral",{ rh:ref }); if (rr.error) console.warn(rr.error); }
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
    if (me.role==="creator"){ S.impAns=storeGet("ldb-imp-"+me.email)||{}; setTimeout(()=>award("login", todayKey()).then(n=>{ if(n) render(true); }), 900); }
    S.tab = S.tab || (me.role === "creator" ? "start" : "uebersicht");
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
  if (S.real?.role==="lead" || S.me?.role==="lead" || S.real?.role==="manager"){ const ro=await sb.from("roster").select("*").order("handle"); S.noRoster=!!ro.error; S.roster=ro.data||[]; }
  const qr=await sb.from("quiz_results").select("*"); S.noUpd8=!!qr.error; S.qres=qr.data||[];
  const [xe,bs,gl,bt,rf]=await Promise.all([ sb.from("xp_events").select("*"), sb.from("backstage").select("*"), sb.from("goals").select("*"), sb.rpc("backstage_top",{ m:null }), sb.from("referrals").select("*").order("created_at",{ ascending:false }) ]);
  if (S.me?.role!=="creator"){ const [gc,gn]=await Promise.all([ sb.from("guide_checks").select("*"), sb.from("guide_notes").select("*") ]); S.noUpd13=!!(gc.error||gn.error); S.gchk=gc.data||[]; S.gnote=gn.data||[]; }
  S.noUpd11=!!rf.error; S.refs=rf.data||[];
  S.noUpd9=!!(xe.error||bs.error||gl.error); S.xp=xe.data||[]; S.bs=bs.data||[]; S.goals=gl.data||[]; S.bsTop=bt.error?[]:(bt.data||[]);
  const [av,ao,bk]=await Promise.all([ sb.from("avail").select("*").order("weekday"), sb.from("avail_off").select("*"), sb.from("bookings").select("*").gte("starts_at", new Date(Date.now()-DAY).toISOString()).order("starts_at") ]);
  const [mp,ml,wi,wr]=await Promise.all([ sb.from("match_posts").select("*").gte("until", new Date().toISOString()).order("live_at"), sb.from("match_likes").select("*").gte("created_at", new Date(Date.now()-16*DAY).toISOString()), sb.from("wins").select("*").order("created_at",{ ascending:false }).limit(60), sb.from("win_reacts").select("*") ]);
  S.noUpd16=!!(mp.error||ml.error||wi.error||wr.error); S.mp=mp.data||[]; S.ml=ml.data||[]; S.wins=wi.data||[]; S.wr=wr.data||[];
  S.noUpd14=!!(av.error||ao.error||bk.error); S.av=av.data||[]; S.avOff=ao.data||[]; S.bk=bk.data||[];
  if (!S.noUpd14 && S.real?.role==="creator"){ const bz=await sb.rpc("busy_times"); S.busy=new Set(Array.isArray(bz.data)?bz.data.map(x=>+new Date(x)):[]); }
  const cl=await sb.from("calendar").select("*").order("starts"); S.noUpd7=!!cl.error; S.cal=cl.data||[];
  if (!S.noUpd7 && S.real?.role==="lead"){ const tk=await sb.from("tasks").select("*").order("created_at"); S.tasks=tk.data||[]; }
  S.snaps = sn.data||[]; S.questions = qu.data||[]; S.survey = sv.data||[]; S.top = tp.error ? [] : (tp.data||[]);
  S.needsUpdate = !!(p.error || ac.error || st.error);
  S.progress = p.data||[]; S.activity = ac.data||[];
  S.settings = Object.fromEntries((st.data||[]).map(r=>[r.key,r.value]));
}

/* ---------- Login ---------- */
function loginView(email="", sent=false, err="", mode){
  mode = mode || S._loginMode || "login"; S._loginMode = mode;
  bnav.hidden = true; who.innerHTML = ""; $("#switch").hidden=true; $("#toplogo").hidden=true;
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
      <label class="f" for="rg-ref">Wer hat dich zu uns eingeladen? (TikTok-Name, optional)<input id="rg-ref" type="text" autocapitalize="none" autocomplete="off" placeholder="@name" value="${esc(r.ref||"")}"></label>
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
  const name=$("#rg-name").value.trim(), handle=$("#rg-handle").value.trim().replace(/^@/,"").toLowerCase(), email=lc($("#email").value), ref=($("#rg-ref")?.value||"").trim().replace(/^@/,"").toLowerCase();
  S._reg={ name, handle, ref };
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
  storeSet("ldb-register", { name, handle, email, ref });
  const er = await otp(email, ref ? { name, handle, ref } : { name, handle }); if (er) return loginView(email,false,er);
  loginView(email,true);
}
async function verifyCode(){
  const token = $("#code").value.replace(/\s/g,"");
  const { error } = await sb.auth.verifyOtp({ email:S._loginEmail, token, type:"email" });
  if (error) loginView(S._loginEmail,true,"Der Code stimmt nicht oder ist abgelaufen.");
}

/* ---------- Rahmen ---------- */
const ic = (n, cls="") => `<svg class="ico ${cls}" aria-hidden="true"><use href="#${n}"/></svg>`;
const LEAD_MORE = ["fragen","personen","themenedit","akademie","recruit","anim","match","erfolge"];
function navItems(){
  const me=S.me;
  if (me.role==="creator") return [["start","i-home","Start"],["lernen","i-learn","Lernen"],["kalender","i-cal","Kalender"],["anim","i-spark","Animation"],...(S.noUpd5?[]:[["@kk","i-mail","Sag's uns"]]),["profil","i-user","Profil"]];
  const mine=new Set(myCreators().map(c=>c.email)), open=S.subs.filter(s=>s.points==null && mine.has(s.creator_email)).length;
  if (me.role==="manager") return [["uebersicht","i-home","Start"],["creator","i-people","Betreuung"],["bewerten","i-check","Bewerten",open],["kalender","i-cal","Kalender",soonBooked()],["akademie","i-learn","Lernen"]];
  return [["uebersicht","i-home","Start"],["bewerten","i-check","Bewerten",open],["kalender","i-cal","Kalender"],...(S.real.role==="lead"?[["fuehrung","i-list","Führung"]]:[]),["bootcamp","i-learn","Bootcamp"]];
}
function navHtml(){
  const items=navItems(), cur = S.tab==="termine" ? "kalender" : S.me.role!=="creator" && LEAD_MORE.includes(S.tab) && items.some(x=>x[0]==="uebersicht") ? "uebersicht" : S.tab;
  return `<div class="bn" style="--n:${items.length}">${items.map(([k,i,l,n])=>`<button ${k==="@kk"?'id="kk-open"':`data-tab="${k}"`} aria-current="${cur===k?"page":"false"}"><span class="bi">${ic(i)}${n?`<i class="dot">${n}</i>`:""}</span>${l}</button>`).join("")}</div>`;
}
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
  who.innerHTML = me.role==="creator"
    ? `<button class="chip invchip" id="inv-open" aria-label="Streamer einladen">${ic("i-rocket")}<span>Einladen</span></button>${st?`<span class="chip" title="Tage am Stück dabei">🔥 <b>${st}</b></span>`:""}${S.noUpd9?`<button class="avabtn" data-tab="profil" aria-label="Mein Profil">${esc(initialOf(me))}</button>`:`<button class="avabtn rg" data-tab="profil" aria-label="Mein Profil">${lvRing(me.email,46,{badge:false})}</button>`}`
    : `<button class="chip invchip" id="share-app" aria-label="App teilen">${ic("i-mail")}<span>App teilen</span></button><span class="chip">${esc(S.real.name)}</span><button class="chip" id="logout">Abmelden</button>`;
  if (me.role==="creator"){
    if (S.tab==="themen"){ S.tab="lernen"; S.learn="bootcamp"; }
    if (S.tab==="akademie"){ S.tab="lernen"; S.learn=S.learn==="quiz"?"quiz":"akademie"; }
    if (!["start","lernen","kalender","profil","anim","termine","match","erfolge"].includes(S.tab)) S.tab="start";
  } else if (["start","lernen","profil","themen"].includes(S.tab) || (S.tab==="fuehrung" && S.real.role!=="lead") || S.tab==="mehr") S.tab = "uebersicht";
  if (me.role==="lead" && S.tab==="mehr") S.tab="uebersicht";
  bnav.innerHTML = navHtml(); bnav.hidden = !!S.openArea || !!(S.qz && !S.qz.done);
  document.querySelector(".wrap").classList.toggle("wide", me.role !== "creator");
  let html;
  if (S.qz && !S.creator) html = quizView();
  else if (me.role==="creator") html = S.openArea ? topicView(S.areas.find(a=>a.n===S.openArea)) : ({ lernen:learnView, kalender:calendarView, profil:()=>profileView(me.email), anim:animView, termine:termView, match:matchView, erfolge:winsView }[S.tab] || startView)();
  else if (S.creator) html = creatorDetail(S.creator);
  else if (S.pend) html = pendingDetail(S.pend);
  else if (S.tab==="akademie") html = academyView();
  else if (S.tab==="kalender") html = calendarView();
  else if (S.tab==="termine") html = termView();
  else if (S.tab==="fuehrung" && S.real.role==="lead") html = leadView();
  else html = ({ bewerten:pendingView, creator:managerList, uebersicht:leadStart, bootcamp:leadOverview, fragen:feedbackView, personen:peopleView, themenedit:areaEditor, recruit:recruitView, anim:animView, match:matchView, erfolge:winsView }[S.tab] || pendingView)();
  view.innerHTML = html;
  if (!keepScroll) window.scrollTo(0,0);
  afterRender(); watchAni(); fab();
  hydrate().catch(console.error);
}
function initSortables(){
  if (!window.Sortable || S.viewAs || S.me?.role!=="lead") return;
  document.querySelectorAll("[data-sortable]").forEach(el=>{
    if (el._sortable) return;
    el._sortable=Sortable.create(el,{ handle:".drag", animation:150, ghostClass:"sghost", chosenClass:"schosen", delay:0,
      onEnd:()=>saveOrder([...el.children].map(c=>c.dataset.sid).filter(Boolean)) });
  });
}
async function saveOrder(ids){
  if (ids.length<2) return;
  const cur=ids.map(id=>S.extras.find(x=>x.id===id)?.sort??0), base=Math.min(...cur);
  const ch=ids.map((id,i)=>[id,base+i]).filter(([id,v])=>(S.extras.find(x=>x.id===id)?.sort??0)!==v || new Set(cur).size<cur.length);
  if (!ch.length) return;
  const rs=await Promise.all(ch.map(([id,v])=>sb.from("extras").update({ sort:v }).eq("id",id)));
  const bad=rs.find(r=>r.error); if (bad) { fail(bad.error); await refresh(); return render(true); }
  ch.forEach(([id,v])=>{ const x=S.extras.find(y=>y.id===id); if (x) x.sort=v; });
  S.extras.sort((a,b)=>(a.sort??0)-(b.sort??0) || String(a.created_at||"").localeCompare(String(b.created_at||"")));
  render(true); toast("Reihenfolge gespeichert.");
}
function afterRender(){
  initSortables();
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
  const pr=$(".path.prereveal");
  if (pr){
    const io=new IntersectionObserver(es=>{ if (es.some(x=>x.isIntersecting)){ io.disconnect(); pr.classList.add("reveal"); setTimeout(confetti, 500); } },{ threshold:.15 });
    io.observe(pr);
    setTimeout(()=>{ const r=pr.getBoundingClientRect(); if (r.top>innerHeight*.6) window.scrollTo({ top:scrollY+r.top-90, behavior:"smooth" }); }, 1300);
  }
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
  let h = `<div class="panel"><div class="hero">${ringSvg(pts, maxPts())}<div><p><b>${esc(ht)}</b>${esc(hp)}</p>
    <button class="chip" data-tab="profil">${ic("i-star")} ${bs.filter(b=>b.on).length} von ${bs.length} Abzeichen</button></div></div></div>`;
  h += reminderBlock(e);
  if (!snapOf(e,"vorher") && !S.noUpd5) h += snapBlock(e);
  // Weg
  const states=S.areas.map(a=>areaState(e,a));
  const curIdx=states.findIndex(s=>s==="open");
  const doneCount=states.filter(s=>s==="done"||s==="wait").length;
  const fill=S.areas.length ? Math.round(doneCount/S.areas.length*100) : 0;
  let flipDone=false;
  const rv=S.revealPath; S.revealPath=false; let ri=0;
  h += `<div class="path ${rv?"prereveal":""}" style="--fill:${fill}%">`;
  for (const w of weeks()){
    const o=weekOpens(w), en=weekEnds(w), later=o && Date.now()<o.getTime();
    h += `<div class="wkh" style="--i:${ri++}"><span>WOCHE ${w}</span>${o?`<small class="muted">${fmtD(o)} bis ${fmtD(en)}</small>`:""}</div>`;
    if (later && !flipDone && !S.me.preview){ flipDone=true;
      h += `<div class="panel flipbox"><small class="muted">Woche ${w} öffnet in</small><div class="flip" data-flip="${o.getTime()}">${flipHtml(o.getTime()-Date.now())}</div></div>`; }
    for (const a of S.areas.filter(x=>x.week===w)){
      const i=S.areas.indexOf(a), st=states[i], s=subOf(e,a.n);
      const cls = st==="done"?"done":st==="wait"?"wait":i===curIdx?"cur":st==="open"?"":"lock";
      const right = st==="done" ? `<span class="pts">${s.points} P</span>` : st==="wait" ? `<span class="waitlbl">wird geprüft</span>`
        : st==="open" ? `<span class="go">${i===curIdx?"Jetzt starten":"Öffnen"}</span>` : `<span class="muted" aria-hidden="true">🔒</span>`;
      const sub = st==="time" ? `Öffnet ${fmtD(weekOpens(a.week))} um 0 Uhr` : st==="lock" ? `Nach Thema ${S.areas[i-1]?.n}` : st==="wait" ? `Abgegeben ${fmtAgo(s.submitted_at)}` : st==="done" ? (s.points===2?"Volle Punktzahl":"Bewertet") : "Video, Handout, Aufgabe";
      h += `<button class="stop ${cls}" style="--i:${ri++}" data-area="${a.n}" data-state="${st}" ${st==="lock"||st==="time"?'aria-disabled="true"':""}>
        <span class="node">${st==="done"||st==="wait"?"✓":a.n}</span>
        <span class="t"><b>${esc(a.title)}</b><small>${esc(sub)}</small></span>${right}</button>`;
    }
  }
  h += `</div>`;
  if (!S.areas.length) h += `<p class="muted">Noch keine Themen angelegt.</p>`;
  h += (snapOf(e,"vorher")||S.noUpd5 ? snapBlock(e) : "") + extrasBlock(e);
  return h;
}

/* ---------- Begrüßung beim ersten Öffnen ---------- */
function welcomeExtra(){
  const vs=S.extras.filter(x=>x.kind!=="reward" && audOf(x)==="bootcamp" && x.area==null && isVid(x.path));
  return vs.find(x=>/begr/i.test(x.title)) || vs[0];
}
function introKey(){ return "ldb-intro-"+S.me.email; }
function needIntro(){
  return S.tab==="lernen" && S.learn==="bootcamp" && introPending();
}
function introPending(){
  if (!welcomeExtra()) return false;
  if (S.showIntro) return true;
  const e=S.me.email;
  if (S.viewAs ? S.introSeenView?.[e] : storeGet(introKey())) return false;
  return !S.progress.some(p=>p.creator_email===e) && !S.subs.some(s=>s.creator_email===e);
}
function introView(){
  const w=welcomeExtra(), e=S.me.email;
  const more=S.extras.filter(x=>x.kind!=="reward" && x.id!==w.id && ((audOf(x)==="bootcamp") || (audOf(x)==="all" && x.area==null)));
  const seen=storeGet("ldb-extras-"+e)||[], ok=S.introOk || S.showIntro || S.me.preview || !!S.viewAs;
  return `<div class="intro">
  <div class="stack"><span class="eyebrow">Willkommen im LIVEdream Creator Bootcamp</span><h1>Schön, dass du da bist, <em>${esc(firstName(S.me))}</em></h1>
    <p class="muted">Bevor dein Weg startet: Schau dir kurz die Begrüßung an. Da erfährst du, wie das Bootcamp abläuft.</p></div>
  <div class="panel stack"><div class="video"><video data-video="${esc(w.path)}" data-intro="1" controls playsinline preload="metadata"></video></div>
    <ol class="introsteps"><li><b>8 Themen in 4 Wochen</b><small class="muted">Jeden Montag um 0 Uhr öffnen 2 neue Themen.</small></li>
      <li><b>Video, Quiz, Handout, Aufgabe</b><small class="muted">So läuft jedes Thema ab.</small></li>
      <li><b>Bis Sonntag 24 Uhr abgeben</b><small class="muted">Bis zu 2 Punkte pro Thema, ab 10 Punkten bestanden.</small></li></ol></div>
  ${more.length?`<div class="stack"><div class="wkh"><span>EXTRAS</span><small class="muted">Gut zu wissen, ohne Punkte</small></div><div class="extras">${more.map(x=>extraCard(x,seen)).join("")}</div></div>`:""}
  <div class="introgo"><button class="btn ${ok?"pulse":""}" id="intro-go" ${ok?"":"disabled"}>${ok?"Weiter zum Bootcamp":"Erst das Video ansehen"}</button>
    <small class="muted" id="intro-hint">${ok?"":"Der Knopf geht auf, sobald du das Video fast ganz gesehen hast."}</small></div></div>`;
}
function introFinish(){
  if (S.viewAs) (S.introSeenView ||= {})[S.me.email]=true; else storeSet(introKey(), new Date().toISOString());
  const again=S.showIntro; S.showIntro=false;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (again || reduce){ S.ringShown=false; render(); return; }
  const fx=document.createElement("div"); fx.className="introfx";
  fx.innerHTML=`<div class="fxin"><span class="eyebrow">Dein Weg beginnt</span><b>Woche <em>1</em></b><i></i></div>`;
  document.body.appendChild(fx);
  requestAnimationFrame(()=>fx.classList.add("on"));
  setTimeout(()=>{ S.revealPath=true; S.ringShown=false; render(); fx.classList.add("out"); }, 1500);
  setTimeout(()=>fx.remove(), 2200);
}

const fileKind = p => isVid(p)?"Video":/\.pdf$/i.test(p||"")?"PDF":/\.(png|jpe?g|webp|gif)$/i.test(p||"")?"Bild":/\.zip$/i.test(p||"")?"Paket (ZIP)":"Datei";
const isVid = p => /\.(mp4|mov|webm|m4v)$/i.test(p||"");
/* Vorschaubild für hochgeladene Videos: Bild aus dem Video (bei 1 Sek.) wird als <video>.jpg daneben gespeichert */
const posterOf = p => p+".jpg";
function grabFrame(src){
  return new Promise((res,rej)=>{
    const v=document.createElement("video"), done=(f,x)=>{ clearTimeout(t); v.removeAttribute("src"); v.load(); f(x); };
    const t=setTimeout(()=>done(rej,new Error("timeout")),20000);
    v.crossOrigin="anonymous"; v.muted=true; v.playsInline=true; v.preload="auto";
    v.onloadedmetadata=()=>{ v.currentTime=Math.min(1, (v.duration||2)*0.1); };
    v.onseeked=()=>{ try{ const w=Math.min(720,v.videoWidth||720), h=Math.round(w*(v.videoHeight||1280)/(v.videoWidth||720)), c=document.createElement("canvas"); c.width=w; c.height=h;
      c.getContext("2d").drawImage(v,0,0,w,h); c.toBlob(b=>b?done(res,b):done(rej,new Error("leer")),"image/jpeg",.8); } catch(e){ done(rej,e); } };
    v.onerror=()=>done(rej,new Error("video"));
    v.src=src;
  });
}
async function savePoster(path, src){
  try{ const b=await grabFrame(src); const r=await sb.storage.from("unterlagen").upload(posterOf(path), b, { contentType:"image/jpeg", upsert:true }); if (r.error) throw r.error; return b; }
  catch(e){ console.warn("Vorschaubild", path, e); return null; }
}
/* Vorschaubild eines hochgeladenen Videos selbst austauschen (Leitung) */
let vcSeq=0;
const vCoverBtn = path => { const id="vc-"+(++vcSeq); return `<label class="chip" for="${id}" style="cursor:pointer">${ic("i-cam")} Vorschaubild<input id="${id}" data-vcover="${esc(path)}" type="file" accept="image/*" hidden></label>`; };
async function setVideoCover(path, f){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (!f) return;
  try{
    toast("Vorschaubild wird hochgeladen …");
    const url=URL.createObjectURL(f), img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("Bild konnte nicht gelesen werden.")); i.src=url; });
    const sc=Math.min(1, 720/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
    c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc); c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(url);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
    const u=await sb.storage.from("unterlagen").upload(posterOf(path), blob, { contentType:"image/jpeg", upsert:true }); if (u.error) throw u.error;
    render(true); toast("Vorschaubild gespeichert ✓ (kann ein paar Minuten zwischengespeichert sein)");
  } catch(e){ fail(e); }
}
const posterTried=new Set();
function backfillPoster(path, url){
  if (S.me?.role!=="lead" || S.viewAs || window.__DEMO || posterTried.has(path)) return Promise.resolve(null);
  posterTried.add(path); return savePoster(path, url);
}
const ytId = u => (String(u||"").match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)||[])[1];
function extraCard(x, seen){
  const yt=ytId(x.link);
  if (yt) return `<button class="doc ytdoc" data-yt="${esc(yt)}" data-ytx="${esc(x.id)}"><span class="paper vid yt"><img src="https://i.ytimg.com/vi/${esc(yt)}/mqdefault.jpg" alt="" loading="lazy">${ic("i-play")}</span><span><b>${esc(x.title)}${seen && !seen.includes(x.id)?' <span class="tag gold">Neu</span>':""}</b><small class="muted">Video${x.path && x.path!=="youtube"?" + Präsentation":""}${x.note?" · "+esc(x.note):""}</small></span></button>`;
  return `<a class="doc" data-handout="${esc(x.path)}" data-extra="${esc(x.id)}" target="_blank" rel="noopener"><span class="paper ${isVid(x.path)?"vid":""}">${isVid(x.path)?`<img class="vth" data-vposter="${esc(x.path)}" alt="">`:""}</span><span><b>${esc(x.title)}${seen && !seen.includes(x.id)?' <span class="tag gold">Neu</span>':""}</b><small class="muted">${fileKind(x.path)}${x.note?" · "+esc(x.note):""}</small></span></a>`;
}
function extrasBlock(e){
  const xs=S.extras.filter(x=>x.kind!=="reward" && audOf(x)==="bootcamp"); if (!xs.length) return "";
  const seen = storeGet("ldb-extras-"+e) || [];
  return `<div class="stack"><div class="wkh"><span>EXTRAS</span><small class="muted">Zusatz-Infos, ohne Punkte</small></div>
    <div class="extras">${xs.map(x=>extraCard(x,seen)).join("")}</div>
    ${welcomeExtra()?`<button class="btn ghost small" id="intro-again">Begrüßung nochmal ansehen</button>`:""}</div>`;
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
  return `<button class="panel kkcard" id="kk-open"><span class="ic"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg></span><span><b>Sag's uns</b><small class="muted">Frage, Kritik oder Wunsch. Anonym, ohne Namen.</small></span><span class="go">Schreiben</span></button>`;
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
    ${!l2 && S.extras.some(x=>x.area===a.n&&x.kind!=="reward"&&audOf(x)!=="team") ? `<small class="muted">Zusätzlich zu diesem Thema</small><div class="extras">${S.extras.filter(x=>x.area===a.n&&x.kind!=="reward"&&audOf(x)!=="team").map(x=>extraCard(x,storeGet("ldb-extras-"+e)||[])).join("")}</div>`:""}</section>`;
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
  const t=total(c.email), st=streakInfo(c.email).cur, b=badgesFor(c.email).filter(x=>x.on), qr=qzRes(c.email,"streamer"), qt=qr&&qzType("streamer",qr.result);
  const L=S.noUpd9?null:levelOf(xpOf(c.email));
  return `<button class="row" data-creator="${esc(c.email)}"><div class="head">${L?`<span class="rwho">${lvRing(c.email,40,{badge:false})}<span><b>${esc(label(c))}</b><small class="lvt" style="${lvVars(L.i)}">Stufe ${L.n} · ${esc(L.name)}</small></span></span>`:`<b>${esc(label(c))}</b>`}<span class="tag ${t>=10?"gold":""}">${t} / ${maxPts()}</span></div>${dots(c.email)}
    ${st||b.length||qt?`<div class="mini">${qt?`<span class="chip gold">${ic(TYPE_IC[qt.key]||"i-star")} ${esc(qt.name)}</span>`:""}${st?`<span class="chip">${ic("i-fire")} ${st}</span>`:""}${b.length?`<span class="chip">${ic("i-star")} ${b.length} Abzeichen</span>`:""}${guideChip(c.email)}</div>`:`<div class="mini">${guideChip(c.email)}</div>`}</button>`;
}
/* Alle Creator eines Managers: registrierte (auch ohne Bootcamp) + auf der Liste, aber noch nicht registriert */
const myPeople = () => allCreators().filter(c => c.manager_email === S.me.email);
const myPending = () => { const reg=new Set(allCreators().map(c=>normH(c.handle))); return (S.roster||[]).filter(r => r.manager_email === S.me.email && !reg.has(normH(r.handle))); };
function managerList(){
  const cs=myPeople(), pend=myPending();
  return `<div class="stack"><span class="eyebrow">Betreuung</span><h1>Meine <em>Creator</em></h1>
    <p class="muted">${cs.length} in der App${pend.length?` · ${pend.length} noch nicht registriert`:""}</p></div>${cs.length?LEGEND:""}
    ${cs.length?`<div class="list">${cs.map(creatorRow).join("")}</div>`:""}
    ${pend.length?`<div class="sec"><span>Noch nicht in der App</span><small>${pend.length}</small></div>
      <p class="muted" style="margin:0 0 8px">Stehen auf der Liste, haben sich aber noch nicht registriert. Den Betreuungsleitfaden kannst du trotzdem schon führen. Schick ihnen den Link zur App.</p>
      <div class="list">${pend.map(r=>`<button class="row" data-pend="${esc(normH(r.handle))}"><div class="head"><b>@${esc(normH(r.handle))}</b><span class="tag">nicht in der App</span></div>${r.name||(!S.noUpd13&&GUIDE().length)?`<div class="mini">${r.name?`<span class="chip">${esc(r.name)}</span>`:""}${guideChip("h:"+normH(r.handle))}</div>`:""}</button>`).join("")}</div>`:""}
    ${!cs.length&&!pend.length?`<div class="panel"><p class="muted" style="margin:0">Dir sind noch keine Creator zugeordnet.</p></div>`:""}`;
}
function pendingDetail(h){
  const r=(S.roster||[]).find(x=>normH(x.handle)===h); if (!r){ S.pend=null; return managerList(); }
  return `<button class="btn ghost small back" id="back">← Zurück</button>
    <div class="stack"><span class="eyebrow">${esc(member(r.manager_email)?.name?"Manager: "+member(r.manager_email).name:"ohne Manager")}</span><h1>@${esc(h)}</h1>
    <p class="muted">${r.name?esc(r.name)+" · ":""}Steht auf der Liste, ist aber noch nicht in der App. Alles, was du hier abhakst und notierst, wird übernommen, sobald sich der Creator registriert.</p></div>
    ${guideBlock("h:"+h)}`;
}
function creatorDetail(email){
  const c=member(email); if(!c){ S.creator=null; return ""; }
  let h=`<button class="btn ghost small back" id="back">← Zurück</button>
    <div class="stack"><span class="eyebrow">${esc(member(c.manager_email)?.name?"Manager: "+member(c.manager_email).name:"ohne Manager")}</span><h1>${esc(label(c))}</h1>
    <p class="muted">${esc(c.name)} · ${esc(c.email)} · ${total(email)} von ${maxPts()} Punkten · 🔥 ${streakInfo(email).cur} Tage</p><div class="titles">${titleChips(email,false)}</div></div>
    ${S.noUpd9?"":lvHero(email,false)}${liveStand(email)}${recCard(email,false)}${goalAdmin(email)}${guideBlock(email)}
    <div class="hexes">${allBadges(email).map(hexBadge).join("")}</div>
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
  let h=`<div class="stack"><span class="eyebrow">Bootcamp</span><h1>Bootcamp <em>Übersicht</em></h1>
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
  let h=`<div class="stack"><span class="eyebrow">Anonym</span><h1>Sag's <em>uns</em></h1><p class="muted">${lead?"Antworte und veröffentliche, dann sehen alle Creator Frage und Antwort. Oder beantworte sie gesammelt im Live.":"Die anonymen Nachrichten der Creator: Fragen, Kritik und Wünsche. Antworten veröffentlicht die Agenturleitung."}</p></div>`;
  h += S.questions.length ? `<div class="list">${S.questions.map(q=>`<div class="row"><div class="head"><b>${esc(q.body)}</b><span class="actions"><span class="tag ${q.kind==="kritik"?"err":q.kind==="wunsch"?"gold":""}">${kkLabel(q.kind)}</span><span class="tag ${q.published?"ok":""}">${q.published?"veröffentlicht":"neu"}</span></span></div>
      <small class="muted">${fmtAgo(q.created_at)}</small>
      ${lead?`<textarea id="qa-${q.id}" placeholder="Antwort (optional)">${esc(q.answer||"")}</textarea>
      <div class="actions"><button class="btn small" data-qpub="${q.id}">${q.published?"Antwort speichern":"Veröffentlichen"}</button>${q.published?`<button class="btn small ghost" data-qsave="${q.id}">Verstecken</button>`:""}<button class="btn small danger" data-qdel="${q.id}">${S.confirmDelete===q.id?"Wirklich löschen?":"Löschen"}</button></div>`
      : q.answer?`<p class="feedback">${esc(q.answer)}</p>`:""}</div>`).join("")}</div>` : `<div class="panel"><p class="muted">Noch keine Nachrichten.</p></div>`;
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
  const xs=S.extras.filter(x=>x.kind!=="reward" && x.kind!=="tiktok" && (x.level==null || lead) && (audOf(x)==="all" || (audOf(x)==="team" && staff)));
  const seen=storeGet("ldb-extras-"+me.email)||[];
  const groups={}; xs.forEach(x=>{ (groups[x.category||"Allgemein"] ||= []).push(x); });
  let h=`<div class="stack"><span class="eyebrow">LIVEdream Academy</span><h1>Die <em>Akademie</em></h1>
    <p class="muted">Schulungen, Videos und Infos. Immer offen, ohne Punkte.</p></div>` + ttStrip(0) + (lead && !S.noUpd11 ? ttAdmin() : "") + (staff ? quizCards() : "");
  if (lead) h += S.noRoster ? `<div class="panel"><p class="err">Zuerst update-6.sql in Supabase ausführen, dann kannst du hier Inhalte hochladen.</p></div>` : `<div class="panel stack"><h2>Inhalt hinzufügen</h2>
    <div class="grid2"><label class="f" for="ak-title">Titel<input id="ak-title" type="text" placeholder="z. B. Schulung Videoproduktion"></label>
    <label class="f" for="ak-cat">Rubrik<input id="ak-cat" type="text" list="ak-cats" placeholder="z. B. Schulungen"><datalist id="ak-cats">${[...new Set(S.extras.map(x=>x.category).filter(Boolean).concat(["Schulungen","Infos","Videos"]))].map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label>
    <label class="f" for="ak-note">Kurzbeschreibung (optional)<input id="ak-note" type="text"></label>
    <label class="f" for="ak-aud">Wer sieht es?<select id="ak-aud"><option value="all">Alle Creator der Agentur</option><option value="team">Nur Manager und Leitung</option></select></label>
    <label class="f" for="ak-level">Freischaltung (Overlay, Animation …)<select id="ak-level"><option value="">Nein, normaler Inhalt</option>${LEVELS.slice(1).map(([,n],i)=>`<option value="${i+2}">Ab Stufe ${i+2} · ${n}</option>`).join("")}</select></label></div>
    <label class="f" for="ak-yt">YouTube-Link (optional, Video auf „Nicht gelistet“ stellen)<input id="ak-yt" type="url" placeholder="https://youtu.be/…"></label>
    <label class="f" for="ak-file">Datei, z. B. Präsentation als PDF (max. 50 MB, optional, wenn ein YouTube-Link da ist)<input id="ak-file" type="file"></label>
    <button class="btn small" id="ak-add">Hinzufügen</button></div>`;
  const cats=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  if (!cats.length) h += `<div class="panel"><p class="muted">Hier kommen bald Schulungen und Infos rein.</p></div>`;
  for (const c of cats){
    h += `<div class="wkh"><span>${esc(c.toUpperCase())}</span>${lead&&groups[c].length>1?`<small class="muted">Zum Sortieren am ⠿ ziehen</small>`:""}</div><div class="extras" ${lead&&!S.viewAs?"data-sortable":""}>${groups[c].map(x=> lead
      ? `<div class="row" data-sid="${esc(x.id)}"><div class="head"><span class="drag" aria-label="Ziehen zum Sortieren">⠿</span>${extraCard(x,seen)}</div><div class="actions"><span class="tag">${x.level!=null?"Freischaltung ab Stufe "+x.level:audOf(x)==="team"?"nur Team":"alle Creator"}</span>${isVid(x.path)?vCoverBtn(x.path):""}<button class="chip" data-delextra="${esc(x.id)}">${S.confirmDelete===x.id?"Wirklich löschen?":"Löschen"}</button></div></div>`
      : extraCard(x,seen)).join("")}</div>`;
  }
  return h;
}

/* ---------- Persönlichkeits-Quizze ---------- */
const QZ = () => window.LDA_QUIZZES || [];
const qzRes = (email, id) => S.qres.find(r=>r.creator_email===email && r.quiz===id);
const qzType = (id, key) => QZ().find(q=>q.id===id)?.types.find(t=>t.key===key);
function quizCards(){
  if (!QZ().length) return "";
  const me=S.me.email, canPlay=S.me.role==="creator";
  return `<div class="wkh"><span>QUIZZE</span><small class="muted">Finde heraus, was zu dir passt</small></div>
  <div class="qzcards">${QZ().map(q=>{ const r=canPlay&&qzRes(me,q.id), t=r&&qzType(q.id,r.result);
    return `<button class="panel qzcard" data-qz="${q.id}"><span class="qzic">${t?t.emoji:q.icon}</span><span><b>${esc(q.title)}</b>
      <small class="muted">${t?`Dein Ergebnis: <b class="gold">${esc(t.name)}</b>`:esc(q.teaser)}</small></span><span class="go">${t?"Ansehen":"Los"}</span></button>`; }).join("")}</div>`;
}
function shuffle(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [x[i],x[j]]=[x[j],x[i]]; } return x; }
function quizStart(id){
  const q=QZ().find(x=>x.id===id); if (!q) return;
  S.qz={ id, i:0, picks:[], order:q.questions.map(x=>shuffle(x.a.map((_,j)=>j))) }; render();
}
function quizView(){
  const R=S.qz, q=QZ().find(x=>x.id===R.id);
  if (R.done) return quizResult(q, R.result, true, R.second);
  const Q=q.questions[R.i], n=q.questions.length;
  return `<button class="btn ghost small back" id="qz-quit">← Abbrechen</button>
  <div class="qzrun"><span class="eyebrow">${esc(q.title)}</span>
    <div class="qzbar"><i style="width:${Math.round(R.i/n*100)}%"></i></div><small class="muted">Frage ${R.i+1} von ${n}</small>
    <h2 class="qzq">${esc(Q.q)}</h2>
    <div class="qzans">${R.order[R.i].map((j,k)=>`<button class="qzopt" style="--i:${k}" data-qza="${j}">${esc(Q.a[j].t)}</button>`).join("")}</div></div>`;
}
function quizScore(q, picks){
  const keys=q.types.map(t=>t.key), max={}, sc={}, last={};
  keys.forEach(k=>{ sc[k]=0; max[k]=q.questions.reduce((a,x)=>a+Math.max(0,...x.a.map(o=>o.w[k]||0)),0)||1; });
  picks.forEach((a,i)=>{ for (const k in a.w){ sc[k]+=a.w[k]; if (a.w[k]>=2) last[k]=i; } });
  const rank=keys.slice().sort((a,b)=> (sc[b]/max[b]-sc[a]/max[a]) || ((last[b]??-1)-(last[a]??-1)));
  return { rank, pct:Object.fromEntries(keys.map(k=>[k,Math.round(sc[k]/max[k]*100)])) };
}
function quizResult(q, key, fresh, second){
  const t=q.types.find(x=>x.key===key); if (!t) return "";
  const t2=second && q.types.find(x=>x.key===second);
  const nische=q.id==="nische";
  return `${fresh?`<button class="btn ghost small back" id="qz-quit">← Zurück</button>`:""}
  <div class="panel stack qzresult ${fresh?"fresh":""}"><span class="eyebrow">${fresh?"Dein Ergebnis":esc(q.title)}</span>
    <div class="qzbig">${t.emoji}</div><h1>${esc(t.name)}</h1><p class="lead"><b>${esc(t.short)}</b></p><p class="soft">${esc(t.text)}</p>
    ${t2?`<div class="qzsecond"><span>${t2.emoji}</span><span><small class="muted">Dein Zweittyp</small><b>${esc(t2.name)}</b></span></div>`:""}
    <div class="wkh"><span>${nische?"DEINE 3 THEMEN":"DAS PASST ZU DIR"}</span></div>
    <ul class="qzlist">${t.mech.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>
    ${t.ideas?`<div class="wkh"><span>5 VIDEOIDEEN</span></div><ol class="qzlist">${t.ideas.map(m=>`<li>${esc(m)}</li>`).join("")}</ol>`:""}
    <p class="feedback gold"><b>${nische?"Live-Idee:":"Tipp:"}</b> ${esc(t.tip)}</p>
    ${S.me.role==="creator"?`<button class="btn ghost small" data-qz-again="${q.id}">Quiz nochmal machen</button>`:""}</div>`;
}
async function quizAnswer(j){
  const R=S.qz, q=QZ().find(x=>x.id===R.id); if (!R || R.done || R.busy) return;
  R.busy=true; const b=document.querySelector(`[data-qza="${j}"]`); if (b) b.classList.add("picked");
  await new Promise(r=>setTimeout(r,320)); R.busy=false;
  R.picks.push(q.questions[R.i].a[j]);
  if (R.i < q.questions.length-1){ R.i++; return render(true); }
  const { rank, pct }=quizScore(q, R.picks);
  R.result=rank[0]; R.second=rank[1]; R.done=true;
  const row={ creator_email:S.me.email, quiz:q.id, result:R.result, scores:{ ...pct, _second:R.second }, created_at:new Date().toISOString() };
  if (!readOnly() && !S.me.preview && !S.noUpd8){
    const r=await sb.from("quiz_results").upsert(row,{ onConflict:"creator_email,quiz" });
    if (r.error) console.warn(r.error);
  }
  S.qres=S.qres.filter(x=>!(x.creator_email===row.creator_email&&x.quiz===row.quiz)); S.qres.push(row);
  render(); setTimeout(confetti, 350);
}
function quizBadges(email){
  const xs=QZ().map(q=>{ const r=qzRes(email,q.id), t=r&&qzType(q.id,r.result); return t?`<span class="chip">${t.emoji} ${esc(t.name)}</span>`:""; }).filter(Boolean);
  return xs.length?`<div class="mini">${xs.join("")}</div>`:"";
}

/* ---------- Neuer Aufbau: Start, Lernen, Profil, Mehr ---------- */
const initialOf = m => (String(m?.name || m?.handle || "?").trim()[0] || "?").toUpperCase();
const TYPE_IC = { matcher:"i-sword", gastgeber:"i-heart", entertainer:"i-spark", gamer:"i-game", kuenstler:"i-palette", begleiter:"i-cup", ruhepol:"i-moon", experte:"i-bulb", talkmaster:"i-mic", abenteurer:"i-compass",
  alltag:"i-home", humor:"i-smile", beauty:"i-gem", kreativ:"i-palette", gaming:"i-game", wissen:"i-bulb", fitness:"i-dumbbell", liebe:"i-heart", tiere:"i-paw", reisen:"i-plane" };
const BADGE_IC = { first:"i-rocket", week1:"i-star", streak:"i-fire", half:"i-learn", pass:"i-crown", all:"i-trophy", snap:"i-cam" };
const BADGE_SHORT = { first:"Erste Abgabe", week1:"Woche 1", streak:"3 Tage am Stück", half:"Halbzeit", pass:"Bestanden", all:"Alles abgegeben", snap:"Vorher-Nachher" };
function titleChips(email, own){
  return QZ().map(q=>{ const r=qzRes(email,q.id), t=r&&qzType(q.id,r.result);
    if (t) return `<button class="title ${q.id==="streamer"?"":"alt"}" data-qzshow="${q.id}" data-who="${esc(email)}"><i>${ic(TYPE_IC[t.key]||"i-star")}</i>${esc(t.name)}</button>`;
    return own ? `<button class="title off" data-qz="${q.id}"><i>${ic("i-quiz")}</i>${esc(q.title)}</button>` : "";
  }).join("");
}
function allBadges(email){
  const m=member(email)||S.me, out=[];
  for (const q of QZ()){ const r=qzRes(email,q.id), t=r&&qzType(q.id,r.result);
    out.push(t ? { ic:TYPE_IC[t.key]||"i-star", t:t.name, on:true, p:true, qz:q.id, who:email } : { ic:"i-quiz", t:q.title, on:false, qz:q.id, play:true }); }
  if (inBootcamp(m)) for (const b of badgesFor(email)) out.push({ ic:BADGE_IC[b.k]||"i-star", t:BADGE_SHORT[b.k]||b.t, on:b.on, k:b.k });
  return out;
}
function hexBadge(b){
  const attr = b.qz ? (b.on ? `data-qzshow="${b.qz}" data-who="${esc(b.who||"")}"` : (S.me.role==="creator" ? `data-qz="${b.qz}"` : "disabled")) : "disabled";
  return `<button class="bd ${b.p?"p":""} ${b.on?"":"off"}" ${attr} title="${esc(b.t)}${b.on?"":" (noch offen)"}"><span class="hx">${ic(b.on?b.ic:(b.play?"i-quiz":b.ic))}</span><small>${esc(b.t)}</small></button>`;
}
function nextCard(e){
  const card=(i,t,sub,attr)=>`<button class="next" ${attr}><span class="nic">${ic(i)}</span><span class="nt"><b>${esc(t)}</b><small>${esc(sub)}</small></span><span class="ngo">${ic("i-chev")}</span></button>`;
  if (inBootcamp(S.me) && S.areas.length){
    if (introPending()) return card("i-play","Dein Bootcamp startet","Erst die Begrüßung ansehen",'data-tab="lernen" data-learn="bootcamp"');
    const states=S.areas.map(a=>areaState(e,a)), i=states.findIndex(x=>x==="open");
    if (i>=0){ const a=S.areas[i], p=progOf(e,a.n), go=p.video_at||p.quiz_at||p.handout_at||S.localProg?.[a.n];
      return card("i-play",`Thema ${a.n} · ${a.title}`, go?"Weiter, wo du warst":"Jetzt starten", `data-area="${a.n}" data-state="open"`); }
    const w=weeks().find(w=>{ const o=weekOpens(w); return o && Date.now()<o.getTime(); });
    if (w && states.includes("time")) return card("i-lock",`Woche ${w} öffnet ${fmtD(weekOpens(w))}`,"Bis dahin: Akademie und Quizze",'data-tab="lernen" data-learn="akademie"');
  }
  const q=QZ().find(q=>!qzRes(e,q.id));
  if (q) return card("i-quiz", q.title, "Finde heraus, was zu dir passt", `data-qz="${q.id}"`);
  return card("i-learn","Akademie","Schulungen und Infos ansehen",'data-tab="lernen" data-learn="akademie"');
}
function startView(){
  const e=S.me.email, me=S.me, boot=inBootcamp(me);
  const fresh=newBadges(e); if (fresh.size){ const bs=badgesFor(e); setTimeout(()=>toast("Neues Abzeichen: "+bs.filter(b=>fresh.has(b.k)).map(b=>b.ic+" "+b.t).join(", ")),600); }
  const hello=new Date().getHours()<11?"Guten Morgen":new Date().getHours()<18?"Hey":"Guten Abend";
  const main=QZ()[0] && qzRes(e,QZ()[0].id), mt=main && qzType(main.quiz, main.result);
  const done=S.areas.filter(a=>["done","wait"].includes(areaState(e,a))).length, fill=S.areas.length?Math.round(done/S.areas.length*100):0;
  const seen=storeGet("ldb-extras-"+e)||[], newAk=S.extras.filter(x=>x.kind!=="reward" && audOf(x)==="all" && !seen.includes(x.id)).length;
  const openQz=QZ().filter(q=>!qzRes(e,q.id)).length, t=isoDay(new Date()), now=calItems("all").filter(c=>c.starts<=t && c.ends>=t);
  const soon=calItems("all").filter(c=>c.starts>t).sort((a,b)=>a.starts.localeCompare(b.starts));
  const ok=passed(e)||me.preview;
  const tile=(i,l,attr,extra="")=>`<button class="tile" ${attr}><span class="tic">${ic(i)}</span>${l}${extra}</button>`;
  const dot=n=>n?`<i class="dot">${n>9?"9+":n}</i>`:"";
  const camps=[...now,...soon].slice(0,4);
  checkLevelUp(e);
  const hk=hookToday(), im=impulsNow(), hkDone=S.xp.some(x=>x.creator_email===e&&x.kind==="hook"&&x.ref===todayKey()), imDone=S.xp.some(x=>x.creator_email===e&&x.kind==="impuls"&&x.ref===weekKey());
  return `<div class="hi"><h1>${hello}, <em>${esc(firstName(me))}</em></h1><div class="hirow">${mt?`<button class="title" data-qzshow="${main.quiz}" data-who="${esc(e)}"><i>${ic(TYPE_IC[mt.key]||"i-star")}</i>${esc(mt.name)}</button>`:""}</div></div>
  ${remindRows(myReminders())}
  ${S.noUpd9?"":lvHero(e,true)}
  ${inviteBar()}
  ${nextCard(e)}
  ${hk||im?`<div class="daily">${hk?`<button class="dcard ${hkDone?"done":""}" id="hook-open"><span class="dic">${ic("i-spark")}</span><b>Hook des Tages</b><small>${hkDone?"Erledigt ✓":"+10 XP"}</small></button>`:""}${im?`<button class="dcard ${imDone?"done":""}" id="imp-open"><span class="dic">${ic("i-bulb")}</span><b>Impuls der Woche</b><small>${imDone?"Angesehen ✓":"bis +50 XP"}</small></button>`:""}</div>`:""}
  ${goalCard(e,true)}
  <div class="tiles">
    ${boot?tile("i-learn","Bootcamp",'data-tab="lernen" data-learn="bootcamp"',`<span class="tbar"><i style="width:${fill}%"></i></span>`):""}
    ${tile("i-play","Akademie",'data-tab="lernen" data-learn="akademie"',dot(newAk))}
    ${tile("i-quiz","Quizze",'data-tab="lernen" data-learn="quiz"',dot(openQz))}
    ${tile("i-cal","Kalender",'data-tab="kalender"',dot(now.length))}
    ${S.noUpd16?"":tile("i-sword","Match-Börse",'data-tab="match"',dot(matchDot()))+tile("i-trophy","Erfolge-Wand",'data-tab="erfolge"',dot(winDot()))}
    ${S.noUpd14||S.me.preview?"":tile("i-clock","1:1-Termin",'data-tab="termine"',myBooking()?`<i class="dot">✓</i>`:"")}
    ${boot?tile("i-gift","Belohnungen",'id="rw-open"',ok?`<i class="dot">!</i>`:`<small class="tl">ab 10 P</small>`):""}
    ${tile("i-user","Profil",'data-tab="profil"')}
    ${tile("i-spark","Animationen",'data-tab="anim"')}
    <a class="tile" href="${esc(MERCH_URL())}" target="_blank" rel="noopener"><span class="tic">${ic("i-heart")}</span>Merch-Shop</a>${partnerTiles()}
  </div>
  ${ttStrip(6)}
  ${boot?reminderBlock(e):""}
  ${camps.length?`<div class="sec"><span>${now.length?"Läuft gerade":"Kommt bald"}</span><button class="lnk" data-tab="kalender">Alle ansehen</button></div>
    <div class="camps">${camps.map(c=>`<button class="camp k-${c.kind}" data-cal="${esc(c.id)}"><b>${esc(c.title)}</b><small>${c.starts>t?"ab "+fmtDate(c.starts).replace(/\.\d{4}$/,"."):"bis "+fmtDate(c.ends).replace(/\.\d{4}$/,".")}</small></button>`).join("")}</div>`:""}
  ${topLists()}
  ${recCard(e,true)}
  ${boot?surveyBlock(e)+topBlock():""}`;
}
function learnView(){
  const segs=[...(inBootcamp(S.me)?[["bootcamp","Bootcamp"]]:[]),["akademie","Akademie"],["quiz","Quizze"]];
  if (!segs.some(x=>x[0]===S.learn)) S.learn=segs[0][0];
  const top=`<div class="seg seg3" role="group" aria-label="Bereich">${segs.map(([k,l])=>`<button data-learn="${k}" aria-pressed="${S.learn===k}">${l}</button>`).join("")}</div>`;
  const body = S.learn==="bootcamp" ? (needIntro()?introView():creatorHome()) : S.learn==="akademie" ? academyView() : quizPage();
  return top + body;
}
function quizPage(){
  return `<div class="stack"><span class="eyebrow">Quizze</span><h1>Wer bist <em>du live?</em></h1><p class="muted">Dein Ergebnis wird dein Titel im Profil.</p></div>` + quizCards().replace(/^<div class="wkh">.*?<\/div>/s,"");
}
function profileView(email){
  const m=member(email)||S.me, mg=member(m.manager_email), boot=inBootcamp(m), own=email===S.me.email;
  const bs=allBadges(email), on=bs.filter(b=>b.on).length;
  const me2=own && S.me.role==="creator";
  return `<div class="prof">${S.noUpd9?`<span class="ava">${esc(initialOf(m))}</span>`:`<button class="ringbtn" data-lvsheet="${esc(email)}" aria-label="Level-Details">${lvRing(email,170)}</button>`}
    ${me2&&!S.viewAs?`<label class="avup" for="av-file">${ic("i-cam")} Profilbild ${m.avatar?"ändern":"hochladen"}<input id="av-file" type="file" accept="image/*" hidden></label>`:""}<b>${esc(m.name||label(m))}</b>
    <small class="muted">${m.handle?"@"+esc(String(m.handle).replace(/^@/,"")):""}${mg?` · Manager: ${esc(mg.name)}`:""}</small>
    ${S.noUpd9?"":lvPill(email)}<div class="titles">${titleChips(email, own && S.me.role==="creator")}</div></div>
  ${S.noUpd9?"":mixRow(xpParts(email), me2)}
  <div class="stats"><div><b>${fmtN(xpOf(email))}</b><small>XP</small></div>${boot?`<div><b>${total(email)}</b><small>Bootcamp-Punkte</small></div>`:""}<div><b>${on}</b><small>Abzeichen</small></div></div>
  ${goalCard(email, own)}
  ${liveStand(email)}
  ${recCard(email, own && S.me.role==="creator")}
  <div class="sec"><span>Abzeichen</span><small>${on} von ${bs.length}</small></div>
  <div class="hexes">${bs.map(hexBadge).join("")}</div>
  ${unlocksBlock(email)}
  ${own && !S.viewAs ? `<button class="btn ghost small" id="logout">${ic("i-out")} Abmelden</button>` : ""}`;
}
function moreTiles(){
  const qn=S.questions.filter(q=>!q.answer && !q.published).length;
  const it=[["fragen","i-mail","Sag's uns & Umfrage",qn],["personen","i-people","Teilnehmer"],["recruit","i-rocket","Recruiting",S.refs.filter(r=>r.status==="offen").length],["themenedit","i-grid","Themen & Start"],["akademie","i-learn","Akademie & Inhalte"],["anim","i-spark","Animationen"],...(S.noUpd16?[]:[["match","i-sword","Match-Börse",matchDot()],["erfolge","i-trophy","Erfolge-Wand",winDot()]]),...(S.noUpd14?[]:[["termine","i-clock","1:1-Termine",soonBooked()]])];
  return `<div class="tiles">${it.map(([k,i,l,n])=>`<button class="tile" data-tab="${k}"><span class="tic">${ic(i)}</span>${l}${n?`<i class="dot">${n}</i>`:""}</button>`).join("")}<a class="tile" href="${esc(MERCH_URL())}" target="_blank" rel="noopener"><span class="tic">${ic("i-heart")}</span>Merch-Shop</a>${partnerTiles()}</div>`;
}
function leadStart(){ if (S.me.role==="manager") return mgrStart(); return leadDash() + (S.me.role==="lead" ? `<div class="sec"><span>Bereiche</span></div>${moreTiles()}` : ""); }



/* ---------- Animationen von Zofy: Beispiele, Preise, Anfrage (nur die Verantwortliche sieht alle Anfragen) ---------- */
const ANI = [
  ["gs-thankyou","Thank you","gs"],["quer-falke","Falke","q"],["bg-loop","Dornen-Kreis","bg"],["quer-phoenix","Phönix","q"],["gs-levelup","Level Up","gs"],
  ["quer-nuri","Nuri","q"],["quer-drache","Drache","q"],["gs-x2","x2 im Match","gs"],["quer-loewen","Löwenfamilie","q"],["loop-game","Dornen dunkel","bg"],
  ["quer-pyramide","Pyramide","q"],["gs-logo","Logo","gs"],["quer-zeus","Zeus","q"],["quer-weltraumkatze","Weltraum-Katze","q"],["quer-gorilla","Gorilla","q"]
];
const ANI_KIND = { gs:"Greenscreen", bg:"Loop", q:"Animation" };
const ANI_PRICES = [
  ["gs15","Greenscreen, 15 Sek.","71,40","89,25","1 Korrekturrunde"],
  ["gs20","Greenscreen / Loop, 20 Sek.","107,10","130,90","1 Korrekturrunde"],
  ["gs30","Greenscreen / Loop, 30 Sek.","142,80","178,50","1 Korrekturrunde"],
  ["logo60","Logo-Animation / Loop, ca. 1 Min.","184,45","226,10","keine Korrektur"],
  ["bg3","Hintergrund-Loop, ca. 3 Min.","583,10","725,90","keine Korrektur"]
];
const waNum = () => { let d=String(S.settings.anim_whatsapp||"").replace(/\D/g,""); if (d.startsWith("00")) d=d.slice(2); else if (d.startsWith("0")) d="49"+d.slice(1); return d.length>=8?d:""; };
function aniPhone([f,t,k]){
  const live = k==="gs" ? `<div class="aui"><span class="anm"><i></i>deinname</span><span class="alive">LIVE</span></div>` : "";
  return `<figure class="aph"><div class="aphone"><div class="ascr" style="background-image:url(ani/${f}.jpg)"><video data-ani="ani/${f}.mp4" poster="ani/${f}.jpg" muted loop playsinline preload="none"></video>${live}</div></div>
    <figcaption><small>${ANI_KIND[k]}</small><b>${esc(t)}</b></figcaption></figure>`;
}
function animView(){
  const lead=S.real?.role==="lead" && !S.viewAs, has=!!waNum();
  const btn=n=>has||lead?`<button class="btn" id="an-new${n}">${ic("i-spark")} Animation anfragen</button>`:`<p class="muted" style="margin:0">Anfragen sind bald hier möglich.</p>`;
  return `<div class="stack"><span class="eyebrow">Von Zofy für dich</span><h1>Deine eigene <em>Animation</em></h1>
    <p class="muted">Greenscreen-Einblendungen, Logo-Animationen und Hintergrund-Loops für dein Live. Alles individuell für dich gemacht.</p></div>
    ${lead?`<div class="panel stack"><b>WhatsApp-Nummer für Anfragen</b><p class="muted" style="margin:0">Nur du als Leitung siehst dieses Feld. Creator landen mit ihrer Anfrage direkt in deinem WhatsApp-Chat.</p>
      <div class="actions"><input id="an-wa" type="tel" inputmode="tel" placeholder="z. B. 0170 1234567" value="${esc(S.settings.anim_whatsapp||"")}" style="flex:1;min-width:0"><button class="btn small" id="an-wa-save">Speichern</button></div></div>`:""}
    ${btn("")}
    <div class="sec"><span>Beispiele</span></div>
    <div class="agrid">${ANI.map(aniPhone).join("")}</div>
    <div class="sec"><span>Preise für Agenturmitglieder</span></div>
    <div class="aprices">${ANI_PRICES.map(([k,n,p,o,c])=>`<div class="panel aprice"><b>${n}</b><span class="ap">${p} €</span><small><s>${o} €</s> · ${c}</small></div>`).join("")}</div>
    <p class="muted" style="margin:0">Alle Preise brutto inkl. 19 % MwSt. Der Normalpreis ist durchgestrichen.</p>
    <div class="achips"><span>${ic("i-palette")} Referenzbild vorab</span><span>${ic("i-play")} erste Version mit Wasserzeichen</span><span>${ic("i-gem")} Bezahlung per Vorkasse</span><span>${ic("i-star")} 10 % Rabatt ab der 3. Animation</span><span>${ic("i-mic")} Sound auf Wunsch (+65,45 € ab 30 Sek.)</span><span>${ic("i-check")} lebenslange Nutzungsrechte</span></div>
    ${btn("2")}`;
}
function openAniForm(){
  if (!waNum()) return toast("Bitte zuerst oben die WhatsApp-Nummer speichern.");
  sheet(`<div class="sh"><span class="eyebrow">Animation anfragen</span><h2>Was wünschst du dir?</h2></div>
    <label class="f" for="an-item">Art der Animation<select id="an-item">${ANI_PRICES.map(([k,n,p])=>`<option value="${k}">${n} · ${p} €</option>`).join("")}<option value="offen">Weiß ich noch nicht</option></select></label>
    <label class="f" for="an-wish">Deine Idee (Motiv, Farben, Text, wofür im Live)<textarea id="an-wish" maxlength="1500" placeholder="Zum Beispiel: Ein Drache mit meinem Namen, wenn jemand eine Galaxy schickt"></textarea></label>
    <label class="chk"><input type="checkbox" id="an-sound"> Mit Sound</label>
    <p class="muted" style="margin:0">Deine Anfrage öffnet sich in WhatsApp an Zofy. Dort schickst du sie ab, und dort laufen auch Referenzbild, Freigabe und Rechnung.</p>
    <button class="btn" id="an-send">${ic("i-mail")} Per WhatsApp anfragen</button>`);
}
function aniSend(){
  const k=$("#an-item").value, it=ANI_PRICES.find(p=>p[0]===k), wish=$("#an-wish").value.trim(), sound=$("#an-sound").checked, m=S.me;
  const txt=[`Hi Zofy, ich möchte eine Animation anfragen (über die LIVEdream Academy).`,``,`Name: ${m.name||""}`,`TikTok: @${String(m.handle||"").replace(/^@/,"")}`,`Animation: ${it?`${it[1]} (${it[2]} €)`:"Weiß ich noch nicht"}`,`Sound: ${sound?"ja":"nein"}`,wish?`Idee: ${wish}`:""].filter((x,i)=>x!==""||i===1).join("\n");
  const url=`https://wa.me/${waNum()}?text=${encodeURIComponent(txt)}`;
  closeSheet(); window.open(url,"_blank","noopener") || (location.href=url);
}
async function aniWaSave(){
  const v=$("#an-wa").value.trim(), btn=$("#an-wa-save");
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (v && v.replace(/\D/g,"").length<8) return toast("Bitte die ganze Handynummer eingeben, z. B. 0170 1234567.");
  btn.disabled=true; btn.textContent="Speichert …";
  try{
    const res=await Promise.race([ sb.from("settings").upsert({ key:"anim_whatsapp", value:v||null }, { onConflict:"key" }), new Promise(r=>setTimeout(()=>r({ error:{ message:"Keine Antwort vom Server. Bitte die Seite neu laden und nochmal versuchen." } }),12000)) ]);
    if (res.error) throw res.error;
    S.settings.anim_whatsapp=v; render(true); toast(v?"Nummer gespeichert ✓":"Nummer entfernt.");
  } catch(e){ fail(e); btn.disabled=false; btn.textContent="Speichern"; }
}
let aniIO=null;
function watchAni(){
  aniIO?.disconnect(); const vs=document.querySelectorAll("video[data-ani]"); if (!vs.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  aniIO=new IntersectionObserver(es=>es.forEach(x=>{ const v=x.target;
    if (x.isIntersecting){ if (!v.src) v.src=v.dataset.ani; v.play().catch(()=>{}); } else v.pause(); }),{ threshold:.35 });
  vs.forEach(v=>aniIO.observe(v));
}

/* ---------- Leitung: Übersicht mit Monats-Erinnerungen ---------- */
function monthReminders(){
  const d=new Date(), day=d.getDate(), last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  if (!(day>=Math.min(30,last) || day<=2)) return [];
  const from=new Date(d); if (day<=2) from.setDate(0); from.setDate(Math.min(30,new Date(from.getFullYear(),from.getMonth()+1,0).getDate())); from.setHours(0,0,0,0);
  const key="ldb-rem-"+isoDay(from), hidden=storeGet(key)||[];
  const bsDone=S.bs.some(b=>new Date(b.uploaded_at)>=from), roDone=(S.roster||[]).some(r=>new Date(r.added_at)>=from);
  return [
    ["bs","Backstage-Export hochladen","Top 5, Live-Tage und XP","personen",bsDone],
    ["ro","Zugangsliste aktualisieren","Neue rein, Abgänge raus","personen",roDone]
  ].filter(r=>!r[4] && !hidden.includes(r[0])).map(r=>({ id:r[0], t:r[1], s:r[2], tab:r[3], key }));
}
function leadDash(){
  const t=isoDay(new Date()), lead=S.real?.role==="lead";
  const rem=[...myReminders(), ...(lead?monthReminders():[])];
  const qn=S.questions.filter(q=>!q.answer && !q.published).length, open=S.subs.filter(s=>s.points==null).length;
  const rf=S.refs.filter(r=>r.status==="offen").length, drafts=(S.cal||[]).filter(c=>c.status==="draft").length;
  const regs=allCreators().length, list=(S.roster||[]).length, live=(S.cal||[]).filter(c=>c.status!=="draft" && c.starts<=t && c.ends>=t).length;
  const tasks=(S.tasks||[]).filter(x=>!x.done_at && x.due && x.due<=isoDay(new Date(Date.now()+3*DAY))).length;
  const k=(i,n,l,tab,warn)=>`<button class="kpi ${warn&&n?"warn":""}" data-tab="${tab}"><span class="kring"><b>${n}</b><i>${ic(i)}</i></span><small>${l}</small></button>`;
  return `<div class="stack"><span class="eyebrow">Agenturleitung</span><h1>Hallo, <em>${esc(firstName(S.real))}</em></h1></div>
    ${remindRows(rem)}
    <div class="kpis">
      ${k("i-check",open,"Bewerten","bewerten",1)}
      ${k("i-mail",qn,"Sag's uns","fragen",1)}
      ${k("i-rocket",rf,"Recruiting","recruit",1)}
      ${!S.noUpd7?k("i-cal",drafts,"Freigeben","kalender",1):""}
      ${lead&&!S.noUpd7?k("i-list",tasks,"Aufgaben fällig","fuehrung",1):""}
      ${!S.noUpd14?k("i-clock",upBk().filter(b=>b.owner_email===S.me.email).length,"1:1 gebucht","termine"):""}
      ${k("i-people",regs,"Registriert","personen")}
      ${!S.noUpd7?k("i-fire",live,"Kampagnen live","kalender"):""}
    </div>`;
}

/* ---------- 1:1-Termine: feste Wochenzeiten (Leitung + Manager), Creator buchen im Kalender beim eigenen Manager ---------- */
const HOW = ["WhatsApp-Anruf","Videoanruf","Telefon"];
const WDL = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
const hm = t => String(t||"").slice(0,5);
const toMin = t => { const [h,m]=String(t).split(":").map(Number); return h*60+(m||0); };
const isoDow = d => (d.getDay()+6)%7+1;
const fmtDay = d => d.toLocaleDateString("de-DE",{ weekday:"long", day:"numeric", month:"long" });
const fmtDayS = d => d.toLocaleDateString("de-DE",{ weekday:"short", day:"numeric", month:"numeric" });
const fmtTime = d => d.toLocaleTimeString("de-DE",{ hour:"2-digit", minute:"2-digit" });
const bkAt = b => new Date(b.starts_at);
const upBk = () => (S.bk||[]).filter(b=>+bkAt(b)+b.minutes*6e4 > Date.now()).sort((a,b)=>bkAt(a)-bkAt(b));
const myBooking = () => S.me?.role==="creator" ? upBk().find(b=>b.creator_email===S.me.email) : null;
const soonBooked = () => S.noUpd14 ? 0 : upBk().filter(b=>b.owner_email===S.me.email && +bkAt(b) < Date.now()+7*DAY).length;
const termOwner = () => S.me.role==="creator" ? S.me.manager_email : S.me.email;
function busySet(owner){
  if (S.real?.role==="creator") return S.busy || new Set();
  return new Set((S.bk||[]).filter(b=>b.owner_email===owner).map(b=>+bkAt(b)));
}
const bookable = x => !x.busy && +x.at > Date.now()+36e5 && +x.at < Date.now()+56*DAY;
function daySlots(owner, d){
  const key=isoDay(d), off=(S.avOff||[]).some(o=>o.owner_email===owner && o.day===key), busy=busySet(owner), seen=new Set(), list=[];
  if (!off) (S.av||[]).filter(a=>a.owner_email===owner && +a.weekday===isoDow(d)).forEach(a=>{
    for (let m=toMin(a.t_from); m+a.minutes<=toMin(a.t_to); m+=a.minutes){
      const at=new Date(d.getFullYear(),d.getMonth(),d.getDate(),Math.floor(m/60),m%60);
      if (!seen.has(+at)){ seen.add(+at); list.push({ at, minutes:a.minutes, how:a.how }); } } });
  const bks=(S.bk||[]).filter(b=>b.owner_email===owner && isoDay(bkAt(b))===key);
  bks.forEach(b=>{ if (!seen.has(+bkAt(b))){ seen.add(+bkAt(b)); list.push({ at:bkAt(b), minutes:b.minutes, how:b.how }); } });
  list.forEach(x=>{ x.booking=bks.find(b=>+bkAt(b)===+x.at)||null; x.busy=!!x.booking || busy.has(+x.at); });
  return { off, list:list.sort((a,b)=>a.at-b.at) };
}
function tMonth(){ if (!S.tMonth){ const n=new Date(); S.tMonth=new Date(n.getFullYear(), n.getMonth(), 1); } return S.tMonth; }
function termCal(owner, staff){
  const m0=tMonth(), y=m0.getFullYear(), mo=m0.getMonth(), first=new Date(y,mo,1), start=new Date(first); start.setDate(1-((first.getDay()+6)%7));
  const today=isoDay(new Date()), t0=new Date(); t0.setHours(0,0,0,0);
  let h=`<div class="cal tcal"><div class="calhead"><button class="chip" data-tnav="-1" aria-label="Vorheriger Monat">‹</button><b>${MONTHS[mo]} ${y}</b><button class="chip" data-tnav="1" aria-label="Nächster Monat">›</button></div>
    <div class="caldow">${["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=>`<span>${d}</span>`).join("")}</div><div class="tgrid">`;
  for (let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); if (i>=35 && d.getMonth()!==mo) break;
    const k=isoDay(d), past=d<t0, ds=daySlots(owner,d);
    const n = staff ? ds.list.filter(x=>x.booking).length : ds.list.filter(bookable).length, has = staff ? ds.list.length>0 : n>0;
    h+=`<button class="tcd ${d.getMonth()!==mo?"out":""} ${k===today?"today":""} ${past?"past":""} ${has&&!past?"has":""} ${ds.off?"off":""} ${S.tDay===k?"sel":""}" data-tday="${k}">
      <span>${d.getDate()}</span>${staff ? (n?`<i class="tn">${n}</i>`:"") : (has&&!past?`<i class="tdot"></i>`:"")}</button>`;
  }
  return h+`</div><div class="tleg">${staff?`<span><i class="tl has"></i>Deine Zeiten</span><span><i class="tn">1</i>Gebucht</span><span><i class="tl off"></i>Gesperrt</span>`:`<span><i class="tl has"></i>Freie Termine</span>`}</div></div>`;
}
function termTeaser(){
  if (S.noUpd14 || S.me.preview) return "";
  const me=S.me;
  if (me.role==="creator"){
    const mg=member(me.manager_email), b=myBooking(); if (!mg) return "";
    return `<button class="remind tteaser" data-tab="termine"><span class="kic">${ic("i-clock")}</span><div><b>1:1-Termin mit ${esc(firstName(mg))}</b><small>${b?`Gebucht: ${fmtDayS(bkAt(b))}, ${fmtTime(bkAt(b))} Uhr`:"Tag aussuchen und Termin buchen"}</small></div><span class="rgo">${ic("i-chev")}</span></button>`;
  }
  const bk=upBk().filter(b=>b.owner_email===me.email).length, rules=(S.av||[]).filter(a=>a.owner_email===me.email).length;
  return `<button class="remind tteaser" data-tab="termine"><span class="kic">${ic("i-clock")}</span><div><b>Meine 1:1-Termine</b><small>${rules?`${bk} gebucht`:"Noch keine festen Zeiten eingestellt"}</small></div><span class="rgo">${ic("i-chev")}</span></button>`;
}
function termView(){
  if (S.noUpd14) return `<div class="stack"><span class="eyebrow">1:1-Termine</span><h1>Termin <em>buchen</em></h1></div><div class="panel"><p class="${S.real.role==="lead"?"err":"muted"}" style="margin:0">${S.real.role==="lead"?"Zuerst update-14-termine.sql in Supabase ausführen.":"Die Terminbuchung kommt bald."}</p></div>`;
  return S.me.role==="creator" ? termCreator() : termStaff();
}
function termCreator(){
  const me=S.me, mg=member(me.manager_email), mine=myBooking();
  let h=`<div class="stack"><span class="eyebrow">1:1-Termin</span><h1>Termin mit <em>${esc(mg?firstName(mg):"deinem Manager")}</em></h1>
    <p class="muted">Tipp auf einen markierten Tag und such dir eine freie Zeit aus.</p></div>`;
  if (!mg) return h+`<div class="panel"><p class="muted" style="margin:0">Dir ist gerade noch kein Manager zugeordnet. Sobald das passiert ist, kannst du hier einen Termin buchen.</p></div>`;
  if (mine){ const d=bkAt(mine);
    h+=`<div class="panel stack tmine"><span class="eyebrow">Dein Termin</span><b class="tbig">${fmtDay(d)}, ${fmtTime(d)} Uhr</b>
      <small class="muted">${mine.minutes} Min. · ${esc(mine.how)} mit ${esc(firstName(mg))}</small>${mine.topic?`<p class="soft" style="margin:0">„${esc(mine.topic)}“</p>`:""}
      <div class="actions"><button class="btn small ghost" data-bkcancel="${esc(mine.id)}">${S.confirmDelete==="bk"+mine.id?"Wirklich absagen?":"Termin absagen"}</button></div>
      <small class="muted">Ist der Termin vorbei oder abgesagt, kannst du den nächsten buchen.</small></div>`; }
  if (!(S.av||[]).some(a=>a.owner_email===mg.email)) return h+`<div class="panel"><p class="muted" style="margin:0">${esc(firstName(mg))} hat noch keine Zeiten für Termine eingestellt. Schau bald wieder rein.</p></div>`;
  h+=termCal(mg.email,false);
  if (S.tDay){ const d=new Date(S.tDay+"T00:00"), ds=daySlots(mg.email,d), vis=ds.list.filter(x=>+x.at>Date.now());
    h+=`<div class="panel stack tdayv"><b class="tbig">${fmtDay(d)}</b>
      ${!vis.length?`<p class="muted" style="margin:0">An diesem Tag gibt es keine freien Zeiten.</p>`
      :`<div class="tslots">${vis.map(x=>bookable(x)&&!mine?`<button class="tslot" data-tbook="${+x.at}">${fmtTime(x.at)}<small>${x.minutes} Min.</small></button>`:`<span class="tslot gone">${fmtTime(x.at)}<small>${x.busy?"vergeben":mine?"–":"zu kurzfristig"}</small></span>`).join("")}</div>
       <small class="muted">${esc(vis[0].how)} mit ${esc(firstName(mg))}${mine?" · Du hast schon einen Termin.":""}</small>`}</div>`; }
  return h;
}
function openBook(ms){
  const mg=member(S.me.manager_email), d=new Date(+ms), x=daySlots(mg?.email, new Date(d.getFullYear(),d.getMonth(),d.getDate())).list.find(s=>+s.at===+ms); if (!x) return;
  S._book=+ms;
  sheet(`<div class="sh"><span class="eyebrow">1:1-Termin buchen</span><h2>${fmtDay(d)}, ${fmtTime(d)} Uhr</h2></div>
    <p class="muted" style="margin:0">${x.minutes} Min. · ${esc(x.how)} mit ${esc(mg?firstName(mg):"deinem Manager")}</p>
    <label class="f" for="sl-topic">Worüber möchtest du sprechen?<textarea id="sl-topic" maxlength="500" placeholder="Zum Beispiel: Meine Lives laufen gerade schlecht, ich brauche Ideen"></textarea></label>
    <button class="btn" id="sl-book">${ic("i-check")} Termin buchen</button>`);
}
const BOOK_MSG = { ok:"Termin gebucht!", taken:"Die Zeit ist leider gerade weggegangen.", late:"Zu kurzfristig: bitte mindestens 1 Stunde vorher buchen.", has:"Du hast schon einen offenen Termin.", missing:"Diese Zeit gibt es nicht mehr.", role:"Buchen geht nur als Creator." };
async function bookSlot(){
  if (S.viewAs || S.me.preview) return toast("In der Vorschau wird nichts gebucht.");
  const btn=$("#sl-book"); btn.disabled=true;
  const r=await sb.rpc("book_slot",{ st:new Date(S._book).toISOString(), t:$("#sl-topic").value.trim() }); if (r.error){ btn.disabled=false; return fail(r.error); }
  closeSheet(); toast(BOOK_MSG[r.data]||"Gespeichert."); await refresh(); render(true);
}
async function cancelMine(id){
  if (S.viewAs || S.me.preview) return toast("In der Vorschau wird nichts geändert.");
  if (S.confirmDelete!=="bk"+id){ S.confirmDelete="bk"+id; return render(true); }
  S.confirmDelete=null; const r=await sb.rpc("cancel_booking",{ bid:id }); if (r.error) return fail(r.error);
  toast(r.data==="ok"?"Termin abgesagt.":"Der Termin konnte nicht mehr abgesagt werden."); await refresh(); render(true);
}
function termStaff(){
  const me=S.me, lead=S.real.role==="lead" && !S.viewAs, rules=(S.av||[]).filter(a=>a.owner_email===me.email).sort((a,b)=>a.weekday-b.weekday||toMin(a.t_from)-toMin(b.t_from));
  const opt=(v,l,sel)=>`<option value="${v}" ${sel?"selected":""}>${l}</option>`;
  const rulesPanel=`<div class="panel stack"><h2>Meine festen Zeiten</h2>
    <p class="muted" style="margin:0">Zum Beispiel montags 11 bis 13 Uhr. Daraus macht die App Termine im Kalender, die deine Creator buchen können.</p>
    ${rules.length?`<div class="trules">${rules.map(a=>`<div class="trule"><b>${WDL[a.weekday-1]}</b><span>${hm(a.t_from)}–${hm(a.t_to)} Uhr · ${a.minutes} Min. · ${esc(a.how)}</span><button class="tx" data-avdel="${esc(a.id)}" aria-label="Zeit löschen">×</button></div>`).join("")}</div>`:""}
    <div class="tform">
      <label class="f" for="av-wd">Wochentag<select id="av-wd">${WDL.map((w,i)=>opt(i+1,w,i===0)).join("")}</select></label>
      <label class="f" for="av-from">Von<input id="av-from" type="time" value="11:00" step="900"></label>
      <label class="f" for="av-to">Bis<input id="av-to" type="time" value="13:00" step="900"></label>
      <label class="f" for="av-min">Termin-Länge<select id="av-min">${[15,20,30,45,60].map(m=>opt(m,m+" Min.",m===30)).join("")}</select></label>
      <label class="f" for="av-how">Wie<select id="av-how">${HOW.map(x=>opt(x,x)).join("")}</select></label>
    </div>
    <button class="btn small" id="av-add">${ic("i-clock")} Zeit hinzufügen</button></div>`;
  let h=`<div class="stack"><span class="eyebrow">1:1-Termine</span><h1>Meine <em>Termine</em></h1>
    <p class="muted">Tipp auf einen Tag, um deine Termine zu sehen. Einzelne Tage kannst du sperren, zum Beispiel im Urlaub.</p></div>`;
  if (!rules.length) h+=rulesPanel;
  h+=termCal(me.email,true);
  if (S.tDay){ const d=new Date(S.tDay+"T00:00"), ds=daySlots(me.email,d), wdRules=rules.some(a=>+a.weekday===isoDow(d));
    h+=`<div class="panel stack tdayv"><div class="tdhead"><b class="tbig">${fmtDay(d)}</b>${wdRules?`<button class="btn small ghost" data-avoff="${S.tDay}">${ds.off?"Tag wieder freigeben":"Tag sperren"}</button>`:""}</div>
      ${ds.off?`<p class="muted" style="margin:0">Dieser Tag ist gesperrt. Creator können hier nichts buchen.</p>`:""}
      ${!ds.list.length&&!ds.off?`<p class="muted" style="margin:0">An diesem Tag hast du keine festen Zeiten.</p>`:""}
      ${ds.list.length?`<div class="tlist">${ds.list.map(x=>{ const b=x.booking, c=b&&member(b.creator_email);
        return `<div class="titem ${b?"bk":""}"><b>${fmtTime(x.at)}</b><div>${b?`<span>${esc(c?label(c):"Creator")}${c&&c.handle&&c.name?" · "+esc(c.name):""}</span>${b.topic?`<small>„${esc(b.topic)}“</small>`:""}<small>${b.minutes} Min. · ${esc(b.how)}</small>`:`<small>frei · ${x.minutes} Min.</small>`}</div>
          ${b?`<button class="chip" data-bkfree="${esc(b.id)}">${S.confirmDelete==="bf"+b.id?"Wirklich absagen?":"Absagen"}</button>`:""}</div>`; }).join("")}</div>`:""}</div>`; }
  const next=upBk().filter(b=>b.owner_email===me.email);
  h+=`<div class="sec"><span>Nächste Termine</span><small>${next.length}</small></div>
    ${next.length?`<div class="list">${next.slice(0,8).map(b=>{ const c=member(b.creator_email); return `<button class="row tnext" data-tday="${isoDay(bkAt(b))}"><b>${fmtDayS(bkAt(b))}, ${fmtTime(bkAt(b))} Uhr</b><small class="muted">${esc(c?label(c):"Creator")}${b.topic?" · „"+esc(b.topic)+"“":""}</small></button>`; }).join("")}</div>`:`<p class="muted">Noch keine Buchungen.</p>`}`;
  if (rules.length) h+=rulesPanel;
  if (lead){
    const others=upBk().filter(b=>b.owner_email!==me.email), owners=[...new Set([...others.map(b=>b.owner_email), ...(S.av||[]).filter(a=>a.owner_email!==me.email).map(a=>a.owner_email)])];
    h+=`<div class="sec"><span>Ganzes Team</span><small>nur Leitung</small></div>
      ${owners.length?`<div class="list">${owners.map(o=>{ const xs=others.filter(b=>b.owner_email===o), rs=(S.av||[]).filter(a=>a.owner_email===o);
        return `<div class="row"><div class="head"><b>${esc(member(o)?.name||o)}</b><small class="muted">${xs.length} gebucht · ${rs.map(a=>`${WDL[a.weekday-1].slice(0,2)} ${hm(a.t_from)}–${hm(a.t_to)}`).join(", ")||"keine festen Zeiten"}</small></div>
          ${xs.map(b=>{ const c=member(b.creator_email); return `<div class="tsub"><b>${fmtDayS(bkAt(b))}, ${fmtTime(bkAt(b))} Uhr</b> <small class="muted">${esc(c?label(c):"Creator")}${b.topic?" · „"+esc(b.topic)+"“":""}</small></div>`; }).join("")}</div>`; }).join("")}</div>`
      :`<p class="muted">Die anderen haben noch keine Zeiten eingestellt.</p>`}`;
  }
  return h;
}
async function addRule(){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const weekday=+$("#av-wd").value, t_from=$("#av-from").value, t_to=$("#av-to").value, minutes=+$("#av-min").value, how=$("#av-how").value;
  if (!t_from || !t_to) return toast("Bitte Von und Bis eintragen.");
  if (toMin(t_to)-toMin(t_from) < minutes) return toast("Bis muss mindestens eine Termin-Länge nach Von liegen.");
  $("#av-add").disabled=true;
  const r=await sb.from("avail").insert({ owner_email:S.real.email, weekday, t_from, t_to, minutes, how }); if (r.error){ fail(r.error); return render(true); }
  toast(`${WDL[weekday-1]} ${t_from}–${t_to} Uhr gespeichert.`); await refresh(); render(true);
}
async function delRule(id){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (S.confirmDelete!=="av"+id){ S.confirmDelete="av"+id; toast("Nochmal tippen zum Löschen. Gebuchte Termine bleiben bestehen."); return; }
  S.confirmDelete=null; const r=await sb.from("avail").delete().eq("id",id); if (r.error) return fail(r.error);
  await refresh(); render(true);
}
async function toggleOff(day){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const off=(S.avOff||[]).some(o=>o.owner_email===S.real.email && o.day===day);
  const r = off ? await sb.from("avail_off").delete().eq("owner_email",S.real.email).eq("day",day) : await sb.from("avail_off").insert({ owner_email:S.real.email, day });
  if (r.error) return fail(r.error);
  toast(off?"Tag wieder freigegeben.":"Tag gesperrt. Schon gebuchte Termine bleiben bestehen."); await refresh(); render(true);
}
async function freeBooking(id){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (S.confirmDelete!=="bf"+id){ S.confirmDelete="bf"+id; return render(true); }
  S.confirmDelete=null; const r=await sb.from("bookings").delete().eq("id",id); if (r.error) return fail(r.error);
  toast("Abgesagt. Sag dem Creator bitte kurz Bescheid."); await refresh(); render(true);
}

/* Erinnerungen: 1:1-Termine, eigene Kampagnen und Termine/Meetings heute und morgen (nicht TikTok-Kampagnen) */
function myReminders(){
  if (!S.me || S.me.preview) return [];
  const t=isoDay(new Date()), tm=isoDay(new Date(Date.now()+DAY)), when=d=>d===t?"Heute":"Morgen", out=[], me=S.me;
  const hidden=storeGet("ldb-crem-"+me.email)||[];
  if (!S.noUpd14){
    const bks = me.role==="creator" ? [myBooking()].filter(Boolean) : upBk().filter(b=>b.owner_email===me.email);
    bks.filter(b=>[t,tm].includes(isoDay(bkAt(b)))).forEach(b=>{ const o=member(me.role==="creator"?b.owner_email:b.creator_email);
      out.push({ id:"bk"+b.id, t:`${when(isoDay(bkAt(b)))}, ${fmtTime(bkAt(b))} Uhr: 1:1 mit ${esc(o?(me.role==="creator"?firstName(o):label(o)):"")}`, s:esc(b.how)+(me.role!=="creator"&&b.topic?" · „"+esc(b.topic)+"“":""), go:`data-tab="termine"` }); });
  }
  if (!S.noUpd7){
    const items = me.role==="creator" ? calItems("all") : (S.cal||[]).filter(c=>!isDraft(c) && (c.audience==="all" || S.real?.role==="lead"));
    items.filter(c=>c.kind!=="tiktok" && (c.starts===t || c.starts===tm)).forEach(c=>
      out.push({ id:"cal"+c.id, t:`${when(c.starts)}${c.at_time?", "+esc(c.at_time)+" Uhr":""}: ${esc(c.title)}`, s:c.kind==="termin"?(c.audience==="lead"?"Termin der Leitung":"Termin"):"LIVEdream-Kampagne startet", go:`data-cal="${esc(c.id)}"` }));
  }
  return out.filter(x=>!hidden.includes(x.id)).map(x=>({ ...x, key:"ldb-crem-"+me.email }));
}
function remindRows(list){
  return list.map(r=>`<div class="remind">${`<span class="kic">${ic(r.go?.includes("termine")?"i-clock":"i-bell")}</span>`}<div><b>${r.t}</b><small>${r.s}</small></div><button class="rgo" ${r.go||`data-tab="${r.tab}"`} aria-label="Öffnen">${ic("i-chev")}</button><button class="rx" data-remhide="${r.id}" data-remkey="${r.key}" aria-label="Ausblenden">${ic("i-check")}</button></div>`).join("");
}

/* ---------- Manager-Startseite: Übersicht, Erinnerungen, Neuigkeiten der eigenen Creator ---------- */
function mgrNews(){
  const mine=new Set(myPeople().map(c=>c.email)), since=Date.now()-7*DAY, out=[], who=e=>esc(label(member(e)));
  allCreators().filter(c=>mine.has(c.email) && c.created_at && +new Date(c.created_at)>since).forEach(c=>out.push({ at:c.created_at, ic:"i-people", t:`${who(c.email)} ist jetzt in der App`, go:`data-creator="${esc(c.email)}"` }));
  S.subs.filter(x=>mine.has(x.creator_email) && +new Date(x.submitted_at)>since).forEach(x=>out.push({ at:x.submitted_at, ic:"i-check", t:`${who(x.creator_email)} hat Thema ${x.area} abgegeben${x.points==null?" · wartet auf Bewertung":""}`, go:x.points==null?`data-tab="bewerten"`:`data-creator="${esc(x.creator_email)}"` }));
  if (!S.noUpd14) (S.bk||[]).filter(b=>b.owner_email===S.me.email && b.created_at && +new Date(b.created_at)>since).forEach(b=>out.push({ at:b.created_at, ic:"i-clock", t:`${who(b.creator_email)} hat ein 1:1 gebucht: ${fmtDayS(bkAt(b))}, ${fmtTime(bkAt(b))} Uhr`, go:`data-tday="${isoDay(bkAt(b))}" data-tab2="termine"` }));
  (S.qres||[]).filter(q=>mine.has(q.creator_email) && q.created_at && +new Date(q.created_at)>since).forEach(q=>{ const t=qzType(q.quiz,q.result); out.push({ at:q.created_at, ic:"i-quiz", t:`${who(q.creator_email)} hat ein Quiz gemacht${t?": "+esc(t.name):""}`, go:`data-creator="${esc(q.creator_email)}"` }); });
  (S.goals||[]).filter(g=>mine.has(g.creator_email) && g.done && g.month===ymNow()).forEach(g=>out.push({ at:g.updated_at||new Date().toISOString(), ic:"i-trophy", t:`${who(g.creator_email)} hat das Monatsziel erreicht: ${esc(g.title)}`, go:`data-creator="${esc(g.creator_email)}"` }));
  return out.sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,12);
}
function mgrStart(){
  const me=S.me, people=myPeople(), pend=myPending(), mine=new Set(myCreators().map(c=>c.email));
  const open=S.subs.filter(x=>x.points==null && mine.has(x.creator_email)).length, bk=S.noUpd14?0:upBk().filter(b=>b.owner_email===me.email).length;
  const untouched=S.noUpd13?0:people.filter(c=>guideCount(c.email)[0]===0).length, news=mgrNews();
  const k=(i,n,l,tab,warn)=>`<button class="kpi ${warn&&n?"warn":""}" data-tab="${tab}"><span class="kring"><b>${n}</b><i>${ic(i)}</i></span><small>${l}</small></button>`;
  const tile=(tab,i,l,n)=>`<button class="tile" data-tab="${tab}"><span class="tic">${ic(i)}</span>${l}${n?`<i class="dot">${n}</i>`:""}</button>`;
  const ago=d=>{ const h=Math.round((Date.now()-new Date(d))/36e5); return h<1?"gerade eben":h<24?`vor ${h} Std.`:`vor ${Math.round(h/24)} Tg.`; };
  return `<div class="stack"><span class="eyebrow">Manager</span><h1>Hallo, <em>${esc(firstName(me))}</em></h1></div>
    ${remindRows(myReminders())}
    <div class="kpis">
      ${k("i-people",people.length,"Meine Creator","creator")}
      ${k("i-mail",pend.length,"Noch nicht in der App","creator",1)}
      ${S.noUpd13?"":k("i-list",untouched,"Noch nicht betreut","creator",1)}
      ${k("i-check",open,"Bewerten","bewerten",1)}
      ${S.noUpd14?"":k("i-clock",bk,"1:1 gebucht","termine")}
    </div>
    <div class="sec"><span>Neuigkeiten</span><small>letzte 7 Tage</small></div>
    ${news.length?`<div class="news">${news.map(n=>`<button class="nrow" ${n.go}><span class="kic">${ic(n.ic)}</span><span>${n.t}</span><small>${ago(n.at)}</small></button>`).join("")}</div>`:`<p class="muted">Gerade nichts Neues von deinen Creatorn.</p>`}
    <div class="sec"><span>Bereiche</span></div>
    <div class="tiles">${tile("creator","i-people","Betreuung")}${tile("bewerten","i-check","Bewerten",open)}${S.noUpd14?"":tile("termine","i-clock","1:1-Termine",soonBooked())}${tile("kalender","i-cal","Kalender")}${tile("akademie","i-learn","Akademie")}${tile("fragen","i-mail","Sag's uns")}${S.noUpd16?"":tile("match","i-sword","Match-Börse",matchDot())+tile("erfolge","i-trophy","Erfolge-Wand",winDot())}</div>`;
}

/* ---------- Partner (Kooperationen): Kachel + Infoblatt, Leitung pflegt Text und Link ---------- */
const PARTNERS = [["tiktori","CastMonkey (ehemals Tiktory)","i-rocket"],["papaya","Papaya Given","i-spark"]];
const PARTNER_DEFAULT = { tiktori:{ info:"Tools für dein TikTok LIVE: Overlays, Sound-Alarme und Text-to-Speech bei Geschenken und Followern, Abläufe automatisieren, Punkte und Level für deine Zuschauer. Läuft mit TikTok LIVE Studio und OBS.\n\nStart: kostenlos registrieren und deinen TikTok-Namen eintragen. Es gibt auch Bezahl-Tarife mit mehr Funktionen.", link:"https://castmonkey.com/de", label:"Zu CastMonkey" }, papaya:{ info:"Papaya Given ist eine Marketingagentur und unser Kooperationspartner.\n\nInteresse an einer Kooperation im TikTok Shop? Den Kontakt stellen wir für dich her. Sprich einfach deinen Manager an.", link:"https://www.instagram.com/papayagiven.agency/", label:"Papaya Given auf Instagram" } };
const partnerOf = k => { try { const v=JSON.parse(S.settings["partner_"+k]||"null"); return v||PARTNER_DEFAULT[k]||{}; } catch(e){ return PARTNER_DEFAULT[k]||{}; } };
function partnerTiles(){
  const lead=S.real?.role==="lead" && !S.viewAs;
  return PARTNERS.filter(([k])=>lead || partnerOf(k).info || partnerOf(k).link).map(([k,n,i])=>`<button class="tile" data-partner="${k}"><span class="tic">${ic(i)}</span>${n}</button>`).join("");
}
function openPartner(k){
  const [,n]=PARTNERS.find(p=>p[0]===k)||[], d=partnerOf(k), lead=S.real?.role==="lead" && !S.viewAs;
  sheet(`<div class="sh"><span class="eyebrow">Unser Partner</span><h2>${esc(n)}</h2></div>
    ${d.info?`<p class="soft" style="margin:0;white-space:pre-line">${esc(d.info)}</p>`:`<p class="muted" style="margin:0">${lead?"Noch keine Infos eingetragen.":"Infos folgen bald."}</p>`}
    ${d.link?`<a class="btn" href="${esc(d.link)}" target="_blank" rel="noopener">${ic("i-chev")} ${esc(d.label||"Mehr erfahren")}</a>`:""}
    ${lead?`<div class="panel stack" style="margin-top:6px"><b>Bearbeiten (nur Leitung)</b>
      <label class="f" for="pt-info">Infos für die Creator<textarea id="pt-info" maxlength="2000" placeholder="Was bietet ${esc(n)}? Wie läuft der Kontakt (z. B. über uns)?">${esc(d.info||"")}</textarea></label>
      <label class="f" for="pt-link">Link (Webseite oder TikTok, optional)<input id="pt-link" type="url" value="${esc(d.link||"")}" placeholder="https://"></label>
      <label class="f" for="pt-label">Text auf dem Knopf<input id="pt-label" type="text" maxlength="40" value="${esc(d.label||"")}" placeholder="Mehr erfahren"></label>
      <button class="btn small" id="pt-save" data-pk="${k}">Speichern</button></div>`:""}`);
}
async function savePartner(k){
  const link=$("#pt-link").value.trim();
  if (link && !/^https:\/\//.test(link)) return toast("Der Link muss mit https:// anfangen.");
  const v=JSON.stringify({ info:$("#pt-info").value.trim(), link, label:$("#pt-label").value.trim() });
  const r=await sb.from("settings").upsert({ key:"partner_"+k, value:v }, { onConflict:"key" }); if (r.error) return fail(r.error);
  S.settings["partner_"+k]=v; closeSheet(); render(true); toast("Gespeichert ✓");
}

/* ---------- App teilen (Leitung + Manager): Link mit Text für Creator verschicken ---------- */
const APP_URL = () => location.origin + "/";
const shareText = () => `Hey! Hier ist die LIVEdream Academy, unsere App für dich als Creator der LIVEdream Agency: Lernvideos, Kampagnen-Kalender, 1:1-Termine mit deinem Manager und mehr.

So kommst du rein: Link öffnen, auf „Neu hier? Registrieren“ tippen und Name, TikTok-Name und E-Mail eingeben.

${APP_URL()}`;
function openShare(){
  sheet(`<div class="sh"><span class="eyebrow">App teilen</span><h2>Link an Creator schicken</h2></div>
    <p class="muted" style="margin:0">Creator registrieren sich selbst mit ihrem TikTok-Namen. Reinkommen kann nur, wer auf eurer Liste steht.</p>
    <label class="f" for="sh-text">Nachricht<textarea id="sh-text" rows="7">${esc(shareText())}</textarea></label>
    <div class="actions" style="flex-wrap:wrap">
      ${navigator.share?`<button class="btn small" id="sh-native">${ic("i-rocket")} Teilen</button>`:""}
      <button class="btn small ${navigator.share?"ghost":""}" id="sh-wa">${ic("i-mail")} WhatsApp</button>
      <button class="btn small ghost" id="sh-copy">Text kopieren</button>
      <button class="btn small ghost" id="sh-link">Nur Link kopieren</button>
    </div>`);
}
async function copyTxt(t, msg){ try{ await navigator.clipboard.writeText(t); toast(msg); } catch(e){ toast("Kopieren ging nicht. Bitte den Text markieren und kopieren."); } }

/* ---------- Level-System: XP, Stufen, Hook des Tages, Impuls der Woche, Backstage, Monatsziel ---------- */
const LEVELS = [[0,"Newcomer"],[300,"Rookie"],[1000,"Rising Star"],[2500,"Performer"],[5000,"Pro"],[9000,"Elite"],[15000,"Legend"]];
const XP_LABEL = { login:"Reingeschaut", hook:"Hook des Tages", impuls:"Impuls der Woche", iq1:"Impuls-Frage", iq2:"Impuls-Frage", iq3:"Impuls-Frage", camp:"Kampagne gelesen", extra:"Akademie-Inhalt" };
const fmtN = n => Number(n||0).toLocaleString("de-DE");
const hnorm = h => lc(String(h||"").replace(/^@/,""));
const ymNow = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
const ymLabel = ym => { const [y,m]=String(ym||"").split("-").map(Number); return m?`${MONTHS[m-1]} ${y}`:""; };
const todayKey = () => isoDay(new Date());
function weekKey(d=new Date()){ const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
  const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t-y0)/DAY+1)/7))}`; }
const rankBonus = r => !r ? 0 : r===1 ? 300 : r===2 ? 200 : r===3 ? 150 : r<=5 ? 100 : r<=10 ? 50 : 0;
const bsRows = email => { const h=hnorm(member(email)?.handle || (S.me?.email===email ? S.me.handle : "")); return h ? S.bs.filter(b=>hnorm(b.handle)===h).sort((a,b)=>b.month.localeCompare(a.month)) : []; };
function xpParts(email){
  const ev=S.xp.filter(x=>x.creator_email===email), m=member(email)||S.me;
  const parts={ app:ev.reduce((a,x)=>a+x.xp,0), lernen:0, live:0, ziel:0, werben:0 };
  parts.lernen += S.subs.filter(s=>s.creator_email===email).length*50 + (inBootcamp(m) && passed(email) ? 200 : 0) + S.qres.filter(r=>r.creator_email===email).length*50;
  for (const b of bsRows(email)) parts.live += (b.days||0)*10 + Math.max(rankBonus(b.rank_d), rankBonus(b.rank_t));
  parts.ziel += S.goals.filter(g=>g.creator_email===email && g.done).length*250;
  parts.werben = recOk(email)*REC_XP;
  return parts;
}
const xpOf = email => Object.values(xpParts(email)).reduce((a,b)=>a+b,0);
function levelOf(xp){
  let i=0; LEVELS.forEach(([min],k)=>{ if (xp>=min) i=k; });
  const [min,name]=LEVELS[i], next=LEVELS[i+1];
  return { i, n:i+1, name, min, next:next?.[0], nextName:next?.[1], pct: next ? Math.round((xp-min)/(next[0]-min)*100) : 100 };
}
let levelSeen=null;
function checkLevelUp(email){
  if (S.viewAs || S.me.preview || S.me.role!=="creator") return;
  const n=levelOf(xpOf(email)).n, k="ldb-level-"+email, was=storeGet(k);
  if (was==null){ storeSet(k,n); return; }
  if (n>was){ storeSet(k,n); const L=levelOf(xpOf(email)); setTimeout(()=>{ win("Stufe "+n+": "+L.name, "Neue Stufe erreicht. Schau in deinem Profil, was du freigeschaltet hast."); confetti(); }, 500); }
}
function win(t,p){ const w=$("#win"); if(!w) return toast(t); $("#win-t").textContent=t; $("#win-p").textContent=p; w.classList.add("show"); setTimeout(()=>w.classList.remove("show"),2600); }
async function award(kind, ref){
  if (S.noUpd9 || S.viewAs || !S.me || S.me.role!=="creator" || S.me.preview) return 0;
  if (S.xp.some(x=>x.creator_email===S.me.email && x.kind===kind && x.ref===ref)) return 0;
  const r=await sb.rpc("award_xp",{ k:kind, r:ref }); if (r.error){ console.warn(r.error); return 0; }
  const pts=r.data||0;
  S.xp.push({ creator_email:S.me.email, kind, ref, xp:pts, created_at:new Date().toISOString() });
  if (pts>0){ xpToast(pts); checkLevelUp(S.me.email); }
  return pts;
}
function xpToast(n){ const t=document.createElement("div"); t.className="xpfly"; t.textContent="+"+n+" XP"; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); }

/* Level-Ring: eigene Farbwelt je Stufe, Ring ums Profilbild, persönliches XP-Kreisdiagramm */
const LV_STYLE = [
  { c:["#c9d0dc","#6b7385"], ic:"i-spark",  rw:"Start in der Academy" },
  { c:["#ffc2ad","#d0607a"], ic:"i-rocket", rw:"Eigener Profilrahmen" },
  { c:["#ffd0ea","#ff3fa8"], ic:"i-star",   rw:"Erstes Stream-Overlay" },
  { c:["#e3b8ff","#8a2fd9"], ic:"i-mic",    rw:"Live-Ziel-Vorlagen und Begrüßungstexte" },
  { c:["#b7c4ff","#5a3be0"], ic:"i-gem",    rw:"Animation für PC-Streamer" },
  { c:["#ffe08a","#c24fe0"], ic:"i-crown",  rw:"Zweites Overlay und kleine Live-Einblendungen" },
  { c:["#fff3c4","#FFB017"], ic:"i-trophy", rw:"Persönliches Overlay und Shoutout" }
];
const MIX = [["live","Live","#FFB017"],["lernen","Lernen","#ff5fb8"],["app","App","#c24fe0"],["ziel","Ziel","#5fe3a8"],["werben","Werben","#4fd1ff"]];
const MIX_SAY = { live:"deine Lives", lernen:"Lernen", app:"deine App-Aktivität", ziel:"deine Monatsziele", werben:"das Werben neuer Streamer" };
const AVURL = {};
let rgid = 0;
const lvVars = i => `--la:${LV_STYLE[i].c[0]};--lb:${LV_STYLE[i].c[1]}`;
function avaInner(m){
  const p=m?.avatar;
  return `<span class="avl">${esc(initialOf(m||{}))}</span>${p?`<img class="avimg" data-avatar="${esc(p)}" ${AVURL[p]?`src="${esc(AVURL[p])}"`:""} alt="">`:""}`;
}
function lvHex(i, size, locked){
  return `<span class="lvhx${locked?" off":""}" style="${lvVars(i)};--s:${size}px">${ic(LV_STYLE[i].ic)}</span>`;
}
function lvRing(email, size, opt={}){
  const m=member(email) || (S.me?.email===email ? S.me : null);
  const L=levelOf(xpOf(email)), [a,b]=LV_STYLE[L.i].c, id="lr"+(rgid++), h=size/2;
  const sw=Math.max(3, size*.06), r=h-sw-(size>=90?size*.05:1), C=2*Math.PI*r, p=L.pct/100;
  let ticks="";
  if (size>=90) for (let k=0;k<40;k++){ const an=k/40*2*Math.PI-Math.PI/2, r1=r+sw*.95, r2=r1+size*.02;
    ticks+=`<line x1="${(h+r1*Math.cos(an)).toFixed(1)}" y1="${(h+r1*Math.sin(an)).toFixed(1)}" x2="${(h+r2*Math.cos(an)).toFixed(1)}" y2="${(h+r2*Math.sin(an)).toFixed(1)}" stroke="${k/40<p?a:"rgba(255,255,255,.12)"}" stroke-width="1.4" stroke-linecap="round"/>`; }
  const circ=extra=>`<circle cx="${h}" cy="${h}" r="${r.toFixed(1)}" fill="none" stroke-width="${sw.toFixed(1)}" ${extra}/>`;
  const arc=`stroke="url(#${id})" stroke-linecap="round" stroke-dasharray="${(C*p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${h} ${h})"`;
  const av=Math.round(2*r-sw-size*.04);
  return `<span class="lring${opt.cls?" "+opt.cls:""}" style="width:${size}px;height:${size}px;${lvVars(L.i)}">
    <svg width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    ${ticks}${circ('stroke="rgba(255,255,255,.09)"')}${p>0?circ(`class="lglow" ${arc}`)+circ(arc):""}
    ${L.i===LEVELS.length-1?`<g class="lshine">${circ(`stroke="#fff" stroke-opacity=".85" stroke-linecap="round" stroke-dasharray="${(C*.035).toFixed(1)} ${C.toFixed(1)}" style="stroke-width:${(sw*.4).toFixed(1)}px"`)}</g>`:""}</svg>
    <span class="lava" style="width:${av}px;height:${av}px;font-size:${Math.round(av*.38)}px">${avaInner(m)}</span>
    ${opt.badge===false?"":`<span class="lnum" style="--s:${Math.max(18,Math.round(size*.24))}px">${L.n}</span>`}</span>`;
}
function donut(P, size){
  const tot=MIX.reduce((s,[k])=>s+(P[k]||0),0), h=size/2, r=h-8, C=2*Math.PI*r, n=MIX.filter(([k])=>P[k]).length;
  let off=0, seg="";
  if (tot) MIX.forEach(([k,,c])=>{ const v=P[k]||0; if (!v) return; const len=v/tot*C;
    seg+=`<circle cx="${h}" cy="${h}" r="${r.toFixed(1)}" fill="none" stroke="${c}" stroke-width="12" stroke-dasharray="${Math.max(.5,len-(n>1?3:0)).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${h} ${h})"/>`; off+=len; });
  return `<svg class="donut" width="${size}" height="${size}" aria-hidden="true"><circle cx="${h}" cy="${h}" r="${r.toFixed(1)}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="12"/>${seg}
    <text x="50%" y="48%" text-anchor="middle" class="dn">${fmtN(tot)}</text><text x="50%" y="64%" text-anchor="middle" class="du">XP</text></svg>`;
}
function mixRow(P, mine){
  const top=MIX.filter(([k])=>P[k]).sort((x,y)=>P[y[0]]-P[x[0]])[0];
  const say=!top ? (mine?"Sammle deine ersten XP mit dem Hook des Tages.":"Noch keine XP gesammelt.")
    : `${mine?"Du wächst":"Wächst"} vor allem durch <b>${MIX_SAY[top[0]]}</b>.`;
  return `<div class="mixrow">${donut(P,96)}<div class="mixr"><div class="legend">${MIX.map(([k,l,c])=>`<span><i style="background:${c}"></i>${l} <b>${fmtN(P[k])}</b></span>`).join("")}</div><div class="typeline">${say}</div></div></div>`;
}
function lvHero(email, mine){
  const xp=xpOf(email), L=levelOf(xp), nx=LV_STYLE[L.i+1];
  return `<div class="lvhero" style="${lvVars(L.i)}">
    <div class="lvtop"><button class="ringbtn" data-lvsheet="${esc(email)}" aria-label="Level-Details">${lvRing(email,116)}</button>
      <div class="lvtxt"><span class="eyebrow">Stufe ${L.n} von ${LEVELS.length}</span><b class="lvname">${esc(L.name)}</b>
      <small><b>${fmtN(xp)}</b> XP${L.next!=null?` · noch ${fmtN(L.next-xp)} bis ${esc(L.nextName)}`:" · höchste Stufe"}</small></div></div>
    ${nx?`<div class="nextun">${lvHex(L.i+1,30)}<div>Als Nächstes: <b>${esc(nx.rw)}</b><small>bei ${esc(L.nextName)}</small></div></div>`:""}
    ${mixRow(xpParts(email), mine)}
    <button class="lnk lvmore" data-lvsheet="${esc(email)}">${mine?"Wie bekomme ich mehr XP?":"Alle Stufen ansehen"} ›</button>
  </div>`;
}
function lvPill(email){
  const L=levelOf(xpOf(email));
  return `<button class="lvpill" data-lvsheet="${esc(email)}" style="${lvVars(L.i)}">${ic(LV_STYLE[L.i].ic)} Stufe ${L.n} · ${esc(L.name)}</button>`;
}
function openLvSheet(email){
  const mine=email===S.me.email && S.me.role==="creator", m=member(email)||S.me;
  const xp=xpOf(email), L=levelOf(xp);
  const ways=[["i-check","Täglich reinschauen","5 XP pro Tag"],["i-spark","Hook des Tages öffnen","10 XP pro Tag"],["i-bulb","Impuls der Woche","20 XP + 10 je richtige Antwort"],
    ["i-cal","Kampagne durchlesen","15 XP je Kampagne"],["i-play","Akademie-Inhalt ansehen","15 XP je Inhalt"],["i-quiz","Quiz machen","50 XP je Quiz"],
    ["i-fire","Live gehen","10 XP je gültigem Live-Tag im Monat"],["i-trophy","Top 10 der Agentur","bis 300 XP im Monat"],["i-star","Monatsziel erreichen","250 XP"],["i-rocket","Streamer einladen","300 XP + Money Gun je neuem Streamer"]];
  if (inBootcamp(m)) ways.push(["i-learn","Bootcamp","50 XP je Abgabe, 200 XP fürs Bestehen"]);
  sheet(`<div class="sh lvsh" style="${lvVars(L.i)}">${lvRing(email,92)}<div><span class="eyebrow">Stufe ${L.n} · ${esc(L.name)}</span><h2>${fmtN(xp)} XP</h2>
      <small class="muted">${L.next!=null?`noch ${fmtN(L.next-xp)} bis ${esc(L.nextName)}`:"höchste Stufe erreicht"}</small></div></div>
    <div class="sec"><span>Woher ${mine?"deine":"die"} XP kommen</span></div>
    ${mixRow(xpParts(email), mine)}
    <div class="sec"><span>So ${mine?"bekommst du":"gibt es"} mehr XP</span></div>
    <div class="ways">${ways.map(([i,t,x])=>`<div class="way"><span class="wic">${ic(i)}</span><div><b>${t}</b><small>${x}</small></div></div>`).join("")}</div>
    <div class="sec"><span>${mine?"Dein":"Der"} Weg</span><small>${LEVELS.length} Stufen</small></div>
    <div class="lvpath">${LEVELS.map((_,i)=>i).reverse().map(i=>{ const s=i<L.i?"done":i===L.i?"now":"locked";
      return `<div class="lst ${s}" style="${lvVars(i)}">${lvHex(i,44,s==="locked")}<div><b>${esc(LEVELS[i][1])}${s==="now"?` <em>${mine?"Du bist hier":"Aktuell"}</em>`:""}</b><small>ab ${fmtN(LEVELS[i][0])} XP · ${esc(LV_STYLE[i].rw)}</small></div></div>`; }).join("")}</div>`);
}
async function shrinkImage(file, max=320){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("Bild konnte nicht gelesen werden.")); i.src=url; });
    const s=Math.min(img.naturalWidth,img.naturalHeight), c=document.createElement("canvas"); c.width=c.height=Math.min(max,s);
    c.getContext("2d").drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(r,"image/jpeg",.85));
  } finally { URL.revokeObjectURL(url); }
}
async function avatarUpload(f){
  if (!f) return;
  if (!/^image\//.test(f.type)) return toast("Bitte ein Bild auswählen.");
  if (S.viewAs || S.me.preview || window.__DEMO) return toast("In der Vorschau wird nichts gespeichert.");
  try{
    toast("Profilbild wird gespeichert …");
    const blob=await shrinkImage(f), e=S.me.email, path=`${e}/avatar-${Date.now()}.jpg`;
    const u=await sb.storage.from("profilbilder").upload(path, blob, { contentType:"image/jpeg" }); if (u.error) throw u.error;
    const r=await sb.rpc("set_avatar",{ p:path }); if (r.error) throw r.error;
    const old=S.me.avatar; [S.me, S.real, member(e)].forEach(x=>{ if (x && x.email===e) x.avatar=path; });
    if (old && old!==path) sb.storage.from("profilbilder").remove([old]).catch(()=>{});
    render(true); toast("Profilbild gespeichert.");
  } catch(err){ fail(err); }
}
async function hydrateAvatars(){
  const imgs=[...document.querySelectorAll("img[data-avatar]:not([src])")]; if (!imgs.length) return;
  const need=[...new Set(imgs.map(i=>i.dataset.avatar))].filter(p=>!AVURL[p]);
  if (need.length){ const { data }=await sb.storage.from("profilbilder").createSignedUrls(need, 6*3600); (data||[]).forEach(d=>{ if (d.signedUrl) AVURL[d.path]=d.signedUrl; }); }
  imgs.forEach(i=>{ if (AVURL[i.dataset.avatar]) i.src=AVURL[i.dataset.avatar]; });
}

/* ---------- Streamer einladen, Recruiter-Programm, Merch ---------- */
const INVITE_URL = () => S.settings.invite_link || "https://www.tiktok.com/t/ZMh3ga66v/";
const MERCH_URL = () => S.settings.merch_link || "https://teamschlauchishapeshifter.myspreadshop.de";
const REC_LEVELS = [[1,"Talent-Scout"],[3,"Recruiter"],[6,"Headhunter"],[10,"Star-Recruiter"]];
const REC_XP = 300;
const recOf = email => S.refs.filter(r=>r.recruiter_email===email);
const recOk = email => recOf(email).filter(r=>r.status==="ok").length;
function recLevel(n){
  let cur=null, next=REC_LEVELS[0]; REC_LEVELS.forEach((l,i)=>{ if (n>=l[0]){ cur=l; next=REC_LEVELS[i+1]||null; } });
  return { cur, next, idx: cur ? REC_LEVELS.indexOf(cur)+1 : 0 };
}
function inviteBar(){
  return `<button class="invbar" id="inv-open"><span class="invic">${ic("i-rocket")}</span><span><b>Streamer einladen</b><small>Pro neuem Streamer: Money Gun + ${REC_XP} XP</small></span><span class="invgo">Link teilen</span></button>`;
}
function recCard(email, mine){
  if (S.noUpd11) return "";
  const list=recOf(email), n=recOk(email), open=list.filter(r=>r.status==="offen").length, L=recLevel(n), guns=list.filter(r=>r.status==="ok").length;
  if (!mine && !list.length) return "";
  const pct=L.next ? Math.round((n-(L.cur?.[0]||0))/(L.next[0]-(L.cur?.[0]||0))*100) : 100;
  return `<div class="panel reccard">
    <div class="rechead"><span class="rechx">${ic("i-people")}<b>${L.idx||"–"}</b></span>
      <div><span class="eyebrow">Recruiter-Stufe</span><b class="recname">${L.cur?esc(L.cur[1]):"Noch kein Recruiter"}</b>
      <small class="muted">${n} ${n===1?"Streamer":"Streamer"} geworben${open?` · ${open} wartet auf Bestätigung`:""}</small></div></div>
    <span class="lvbar"><i style="width:${pct}%"></i></span>
    <small class="muted">${L.next?`Noch ${L.next[0]-n} bis ${esc(L.next[1])}`:"Höchste Recruiter-Stufe erreicht"} · ${guns} Money ${guns===1?"Gun":"Guns"} verdient</small>
    ${list.length?`<div class="reclist">${list.map(r=>`<span class="recp ${r.status}">@${esc(r.recruit_handle)}<i>${r.status==="ok"?(r.gun_sent?"Money Gun verschickt":"bestätigt"):r.status==="nein"?"nicht bestätigt":"wartet"}</i></span>`).join("")}</div>`:""}
    ${mine?`<button class="btn small" id="inv-open2">${ic("i-rocket")} Streamer einladen</button>`:""}
  </div>`;
}
function openInvite(){
  const url=INVITE_URL(), creator=S.me.role==="creator";
  sheet(`<div class="sh"><span class="eyebrow">LIVEdream Agency</span><h2>Streamer einladen</h2></div>
    <p class="soft">Schick diesen Link an Streamer, die zu uns passen. Wer über dich zur Agentur kommt, bringt dir eine <b>Money Gun</b> und <b>${REC_XP} XP</b>, sobald wir es bestätigt haben.</p>
    <div class="invlink"><code>${esc(url)}</code></div>
    <div class="actions"><button class="btn" id="inv-share">${ic("i-rocket")} Link teilen</button><button class="btn ghost" id="inv-copy">Kopieren</button></div>
    ${creator && !S.noUpd11 && !S.viewAs ? `<div class="sec"><span>Jemand ist über dich gekommen?</span></div>
      <p class="muted" style="margin:0">Trag den TikTok-Namen ein. Die Agenturleitung bestätigt es.</p>
      <div class="actions"><input id="ref-h" type="text" autocapitalize="none" autocomplete="off" placeholder="@tiktokname" style="flex:1;min-width:0"><button class="btn small" id="ref-send">Melden</button></div>` : ""}
    ${creator?recCard(S.me.email,false):""}`);
}
async function shareInvite(){
  const url=INVITE_URL(), text="Werde Teil der LIVEdream Agency! Hier kannst du dich bewerben:";
  if (navigator.share){ try{ await navigator.share({ title:"LIVEdream Agency", text, url }); return; }catch(e){ if (e?.name==="AbortError") return; } }
  copyInvite();
}
async function copyInvite(){
  try{ await navigator.clipboard.writeText(INVITE_URL()); toast("Link kopiert."); }
  catch{ const c=$(".invlink code"); if (c){ const r=document.createRange(); r.selectNodeContents(c); const s=getSelection(); s.removeAllRanges(); s.addRange(r); } toast("Link markiert. Jetzt kopieren."); }
}
async function reportRef(){
  const h=($("#ref-h")?.value||"").trim(); if (!h) return toast("Bitte einen TikTok-Namen eintragen.");
  const { data, error }=await sb.rpc("report_referral",{ rh:h }); if (error) return fail(error);
  const msg={ ok:"Gemeldet. Die Agenturleitung bestätigt es.", exists:"Diesen Streamer hat schon jemand gemeldet.", self:"Das bist du selbst 😉", invalid:"Das ist kein gültiger TikTok-Name.", no_access:"Kein Zugang." }[data]||"Gemeldet.";
  toast(msg); if (data==="ok"){ await refresh(); openInvite(); }
}
/* Leitung: Recruiting-Übersicht */
function recruitView(){
  if (S.noUpd11) return `<div class="panel"><p class="err">Für das Recruiter-Programm zuerst update-11.sql in Supabase ausführen.</p></div>`;
  const open=S.refs.filter(r=>r.status==="offen"), ok=S.refs.filter(r=>r.status==="ok"), who=e=>{ const m=member(e); return m?esc(label(m)):esc(e); };
  const creators=S.members.filter(m=>m.role==="creator").sort((a,b)=>label(a).localeCompare(label(b)));
  const board=[...new Set(ok.map(r=>r.recruiter_email))].map(e=>[e,recOk(e)]).sort((a,b)=>b[1]-a[1]);
  return `<div class="stack"><span class="eyebrow">Agenturleitung</span><h1>Recruiting</h1><p class="muted">Gemeldete Streamer bestätigen, Money Guns abhaken.</p></div>
  ${inviteBar()}
  <div class="sec"><span>Wartet auf Bestätigung</span><small>${open.length}</small></div>
  ${open.length?`<div class="list">${open.map(r=>`<div class="row"><div class="head"><b>@${esc(r.recruit_handle)}</b><span class="muted">${r.source==="registrierung"?"bei Registrierung":"gemeldet"} · ${fmtDate(r.created_at.slice(0,10))}</span></div>
    <span class="muted">geworben von ${who(r.recruiter_email)}</span>
    <div class="actions"><button class="btn small gold" data-refok="${esc(r.recruit_handle)}">Bestätigen</button><button class="btn small ghost" data-refno="${esc(r.recruit_handle)}">Ablehnen</button></div></div>`).join("")}</div>`:`<div class="panel"><p class="muted">Nichts offen.</p></div>`}
  <div class="sec"><span>Bestätigt</span><small>${ok.length}</small></div>
  ${ok.length?`<div class="list">${ok.map(r=>`<div class="row"><div class="head"><b>@${esc(r.recruit_handle)}</b><span class="muted">von ${who(r.recruiter_email)}</span></div>
    <label class="qopt" style="font-size:13px"><input type="checkbox" data-refgun="${esc(r.recruit_handle)}" ${r.gun_sent?"checked":""}> Money Gun verschickt</label></div>`).join("")}</div>`:""}
  ${board.length?`<div class="sec"><span>Recruiter-Bestenliste</span></div><div class="panel"><ol class="recboard">${board.map(([e,n],i)=>`<li><b>${i+1}. ${who(e)}</b><span>${n} · ${esc(recLevel(n).cur?.[1]||"")}</span></li>`).join("")}</ol></div>`:""}
  <div class="sec"><span>Selbst eintragen</span></div>
  <div class="panel stack"><label class="f" for="rf-rec">Geworben von<select id="rf-rec">${creators.map(c=>`<option value="${esc(c.email)}">${esc(label(c))}</option>`).join("")}</select></label>
    <label class="f" for="rf-h">Neuer Streamer (TikTok-Name)<input id="rf-h" type="text" autocapitalize="none" placeholder="@tiktokname"></label>
    <button class="btn small" id="rf-add">Als bestätigt eintragen</button></div>`;
}
async function refDecide(h, status){
  const { error }=await sb.from("referrals").update({ status, decided_at:new Date().toISOString() }).eq("recruit_handle",h); if (error) return fail(error);
  await refresh(); render(true); toast(status==="ok"?"Bestätigt. XP sind gutgeschrieben.":"Abgelehnt.");
}
async function refGun(h, v){ const { error }=await sb.from("referrals").update({ gun_sent:v }).eq("recruit_handle",h); if (error) return fail(error); const r=S.refs.find(x=>x.recruit_handle===h); if (r) r.gun_sent=v; toast(v?"Money Gun abgehakt.":"Haken entfernt."); }
async function refAdd(){
  const rec=$("#rf-rec").value, h=lc($("#rf-h").value.trim().replace(/^@/,""));
  if (!rec || !/^[a-z0-9._]{1,40}$/.test(h)) return toast("Bitte Recruiter und gültigen TikTok-Namen angeben.");
  const { error }=await sb.from("referrals").upsert({ recruit_handle:h, recruiter_email:rec, status:"ok", source:"leitung", decided_at:new Date().toISOString() }); if (error) return fail(error);
  await refresh(); render(true); toast("Eingetragen.");
}
/* ---------- Zofys TikTok-Tippvideos (Vorschau, Klick führt zu TikTok) ---------- */
const ttVideos = () => S.extras.filter(x=>x.kind==="tiktok" && x.link).sort((a,b)=>(a.sort??0)-(b.sort??0) || String(b.created_at||"").localeCompare(String(a.created_at||"")));
function ttCard(x){
  const cover=x.path && x.path!=="tiktok";
  return `<a class="ttcard" href="${esc(x.link)}" target="_blank" rel="noopener" data-tt="${esc(x.id)}">
    <span class="ttimg ${cover?"":"nocov"}" ${cover?"":`data-ttfix="${esc(x.id)}"`}>${cover?`<img data-tcover="${esc(x.path)}" alt="">`:`<em>${esc(x.title)}</em>`}<span class="ttplay">${ic("i-play")}</span></span>
    <b>${esc(x.title)}</b><small>Auf TikTok ansehen ›</small></a>`
    + (S.me?.role==="lead" && !S.viewAs ? `<div class="ttedit"><label class="chip" for="ttq-${esc(x.id)}">${ic("i-cam")} Bild<input id="ttq-${esc(x.id)}" data-ttcover="${esc(x.id)}" type="file" accept="image/*" hidden></label><button class="chip" data-ttdel="${esc(x.id)}">${S.confirmDelete==="tt"+x.id?"Sicher?":"Löschen"}</button></div>` : "");
}
function ttStrip(max, head="Tipps von uns auf TikTok"){
  const xs=ttVideos().slice(0,max||99); if (!xs.length) return "";
  return `<div class="sec"><span>${esc(head)}</span><small>+15 XP je Video</small></div><div class="ttrow">${xs.map(x=>`<div class="ttcol">${ttCard(x)}</div>`).join("")}</div>`;
}
function ttAdmin(){
  return `<div class="panel stack"><h2>TikTok-Tippvideo hinzufügen</h2>
    <p class="muted" style="margin:0">In der App erscheint nur das Vorschaubild. Wer tippt, landet beim echten Video auf TikTok.</p>
    <label class="f" for="tt-link">Link zum TikTok-Video<input id="tt-link" type="url" placeholder="https://www.tiktok.com/@zofyb/video/…"></label>
    <label class="f" for="tt-title">Titel<input id="tt-title" type="text" placeholder="z. B. 3 Fehler beim ersten Live"></label>
    <label class="f" for="tt-cover">Vorschaubild (Screenshot vom Video, optional, geht auch später)<input id="tt-cover" type="file" accept="image/*"></label>
    <button class="btn small" id="tt-add">Hinzufügen</button>
    ${ttVideos().length?`<div class="sec" style="margin-top:6px"><span>Deine TikTok-Videos</span><small>${ttVideos().length}</small></div>
    <div class="ttlist" data-sortable>${ttVideos().map(x=>{ const cover=x.path && x.path!=="tiktok";
      return `<div class="ttli" data-sid="${esc(x.id)}"><span class="drag" aria-label="Ziehen zum Sortieren">⠿</span><span class="ttmini">${cover?`<img data-tcover="${esc(x.path)}" alt="">`:""}</span><div><b>${esc(x.title)}</b><small>${cover?"Mit Vorschaubild":"Ohne Vorschaubild"}</small></div>
        <label class="chip" for="ttc-${esc(x.id)}">${ic("i-cam")} Bild<input id="ttc-${esc(x.id)}" data-ttcover="${esc(x.id)}" type="file" accept="image/*" hidden></label>
        <button class="chip" data-ttdel="${esc(x.id)}">${S.confirmDelete==="tt"+x.id?"Wirklich löschen?":"Löschen"}</button></div>`; }).join("")}</div>`:""}</div>`;
}
async function ttSetCover(id, f){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const x=S.extras.find(y=>y.id===id); if (!x || !f) return;
  try{
    toast("Bild wird hochgeladen …");
    const blob=await shrinkCover(f), path=`tiktok-${Date.now()}.jpg`;
    const u=await sb.storage.from("unterlagen").upload(path,blob,{ contentType:"image/jpeg" }); if (u.error) throw u.error;
    const r=await sb.from("extras").update({ path }).eq("id",id); if (r.error) throw r.error;
    if (x.path && x.path!=="tiktok") sb.storage.from("unterlagen").remove([x.path]).catch(()=>{});
    await refresh(); render(true); toast("Vorschaubild gespeichert ✓");
  } catch(e){ fail(e); }
}
async function ttDelete(id){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (S.confirmDelete!=="tt"+id){ S.confirmDelete="tt"+id; return render(true); }
  S.confirmDelete=null; const x=S.extras.find(y=>y.id===id);
  const r=await sb.from("extras").delete().eq("id",id); if (r.error) return fail(r.error);
  if (x?.path && x.path!=="tiktok") sb.storage.from("unterlagen").remove([x.path]).catch(()=>{});
  await refresh(); render(true); toast("Video gelöscht.");
}
async function shrinkCover(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("Bild konnte nicht gelesen werden.")); i.src=url; });
    const W=360, H=640, sc=Math.max(W/img.naturalWidth, H/img.naturalHeight), w=img.naturalWidth*sc, h=img.naturalHeight*sc;
    const c=document.createElement("canvas"); c.width=W; c.height=H; c.getContext("2d").drawImage(img,(W-w)/2,(H-h)/2,w,h);
    return await new Promise(r=>c.toBlob(r,"image/jpeg",.82));
  } finally { URL.revokeObjectURL(url); }
}
async function addTikTok(){
  const link=$("#tt-link").value.trim(), title=$("#tt-title").value.trim(), f=$("#tt-cover").files[0];
  if (!/^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//.test(link)) return toast("Bitte einen TikTok-Link einfügen (https://www.tiktok.com/…).");
  if (!title) return toast("Bitte einen Titel eingeben.");
  try{
    $("#tt-add").disabled=true; let path="tiktok";
    const src=f || await ttThumb(link);
    if (src){ const blob=await shrinkCover(src); path=`tiktok-${Date.now()}.jpg`; const u=await sb.storage.from("unterlagen").upload(path,blob,{ contentType:"image/jpeg" }); if (u.error) throw u.error; }
    const r=await sb.from("extras").insert({ title, path, link, kind:"tiktok", audience:"all", category:"TikTok-Tipps", sort:Math.min(0,...ttVideos().map(x=>x.sort??0))-1 }); if (r.error) throw r.error;
    await refresh(); render(true); toast("TikTok-Video hinzugefügt.");
  } catch(e){ fail(e); render(true); }
}
/* Vorschaubild automatisch von TikTok holen (nur im Browser der Leitung, beim Hinzufügen oder einmal nachträglich) */
async function ttThumb(link){
  try{
    const j=await (await fetch("https://www.tiktok.com/oembed?url="+encodeURIComponent(link))).json();
    if (!j?.thumbnail_url) return null;
    const r=await fetch(j.thumbnail_url); if (!r.ok) return null;
    const b=await r.blob(); return /^image\//.test(b.type) ? b : null;
  } catch(e){ console.warn("TikTok-Vorschau", e); return null; }
}
const ttTried=new Set();
async function ttBackfill(){
  if (S.me?.role!=="lead" || S.viewAs || window.__DEMO) return;
  let changed=false;
  for (const el of document.querySelectorAll("[data-ttfix]")){
    const x=S.extras.find(y=>y.id===el.dataset.ttfix); if (!x || ttTried.has(x.id)) continue; ttTried.add(x.id);
    const src=await ttThumb(x.link); if (!src) continue;
    try{ const blob=await shrinkCover(src), path=`tiktok-${Date.now()}.jpg`;
      const u=await sb.storage.from("unterlagen").upload(path,blob,{ contentType:"image/jpeg" }); if (u.error) throw u.error;
      const r=await sb.from("extras").update({ path }).eq("id",x.id); if (r.error) throw r.error; x.path=path; changed=true; }
    catch(e){ console.warn("TikTok-Vorschau", e); }
  }
  if (changed) render(true);
}
async function hydrateCovers(){
  ttBackfill().catch(console.error);
  const imgs=[...document.querySelectorAll("img[data-tcover]:not([src])")]; if (!imgs.length) return;
  const need=[...new Set(imgs.map(i=>i.dataset.tcover))].filter(p=>!AVURL["u:"+p]);
  if (need.length){ const { data }=await sb.storage.from("unterlagen").createSignedUrls(need, 6*3600); (data||[]).forEach(d=>{ if (d.signedUrl) AVURL["u:"+d.path]=d.signedUrl; }); }
  imgs.forEach(i=>{ const u=AVURL["u:"+i.dataset.tcover]; if (u) i.src=u; });
}

/* ---------- Betreuungsleitfaden (Manager/Leitung pro Creator) ---------- */
const GUIDE = () => window.LDA_GUIDE || [];
const gIds = () => GUIDE().flatMap(c=>c.items.map(x=>x[0]));
const gStat = (email,id) => S.gchk.find(x=>x.creator_email===email && x.item===id)?.status;
function guideCount(email){ const all=gIds(); return [all.filter(id=>gStat(email,id)).length, all.length]; }
function guideChip(email){ if (S.noUpd13 || !GUIDE().length) return ""; const [d,n]=guideCount(email); return `<span class="chip">${ic("i-list")} Leitfaden ${d}/${n}</span>`; }
function guideBlock(email){
  if (S.noUpd13) return S.me.role==="lead" ? `<div class="panel"><p class="err">Für den Betreuungsleitfaden zuerst update-13-leitfaden.sql in Supabase ausführen.</p></div>` : "";
  if (!GUIDE().length) return "";
  const [d,n]=guideCount(email), pct=n?Math.round(d/n*100):0;
  return `<div class="panel guide"><div class="ghead"><div><span class="eyebrow">Betreuungsleitfaden</span><h2>${d} von ${n} besprochen</h2></div><span class="gpct">${pct} %</span></div>
    <span class="lvbar"><i style="width:${pct}%"></i></span>
    <p class="muted" style="margin:0;font-size:12.5px">✓ = besprochen · ★ = wusste es schon · ${ic("i-learn")} = im Bootcamp abgegeben. Nochmal tippen nimmt den Haken weg.</p>
    ${GUIDE().map(c=>{ const ids=c.items.map(x=>x[0]), dc=ids.filter(id=>gStat(email,id)).length;
      const sub=c.area && S.subs.some(s=>s.creator_email===email && s.area===c.area);
      const note=S.gnote.find(x=>x.creator_email===email && x.chapter===c.id)?.note||"";
      return `<details class="gch" data-gch="${c.id}" ${S.gOpen.has(c.id)?"open":""}><summary><span class="gic">${ic(c.icon)}</span><b>${esc(c.title)}</b>${sub?`<span class="gbc" title="Im Bootcamp abgegeben" aria-label="Im Bootcamp abgegeben">${ic("i-learn")}</span>`:""}${note?`<span class="gnoted" title="Notiz vorhanden">✎</span>`:""}<span class="gcnt ${dc===ids.length?"full":""}">${dc}/${ids.length}</span></summary>
        <div class="gitems">${c.items.map(([id,t])=>{ const st=gStat(email,id);
          return `<div class="gi ${st||""}"><span>${esc(t)}</span><span class="gbtns"><button class="gb ${st==="done"?"on":""}" data-gset="${id}" data-gst="done" data-who="${esc(email)}" aria-label="besprochen" title="besprochen">✓</button><button class="gb k ${st==="known"?"on":""}" data-gset="${id}" data-gst="known" data-who="${esc(email)}" aria-label="wusste es schon" title="wusste es schon">★</button></span></div>`; }).join("")}</div>
        <label class="f gnote">Notiz zu diesem Kapitel<textarea data-gnote="${c.id}" data-who="${esc(email)}" rows="2" placeholder="z. B. beim nächsten Gespräch nochmal Licht anschauen">${esc(note)}</textarea></label></details>`; }).join("")}
  </div>`;
}
async function guideSet(email, id, st){
  if (S.viewAs && S.real.role!=="lead") return;
  const cur=gStat(email,id);
  if (cur===st){ const { error }=await sb.from("guide_checks").delete().eq("creator_email",email).eq("item",id); if (error) return fail(error);
    S.gchk=S.gchk.filter(x=>!(x.creator_email===email && x.item===id)); }
  else { const row={ creator_email:email, item:id, status:st, by_email:S.real.email, at:new Date().toISOString() };
    const { error }=await sb.from("guide_checks").upsert(row); if (error) return fail(error);
    S.gchk=S.gchk.filter(x=>!(x.creator_email===email && x.item===id)).concat([row]); }
  render(true);
}
async function guideNote(email, ch, text){
  const note=String(text||"").trim().slice(0,2000);
  const r = note ? await sb.from("guide_notes").upsert({ creator_email:email, chapter:ch, note, by_email:S.real.email, at:new Date().toISOString() })
                 : await sb.from("guide_notes").delete().eq("creator_email",email).eq("chapter",ch);
  if (r.error) return fail(r.error);
  S.gnote=S.gnote.filter(x=>!(x.creator_email===email && x.chapter===ch)).concat(note?[{ creator_email:email, chapter:ch, note }]:[]);
  toast("Notiz gespeichert.");
}
document.addEventListener("toggle", e=>{ const d=e.target; if (d.matches?.("details.gch")) { if (d.open) S.gOpen.add(d.dataset.gch); else S.gOpen.delete(d.dataset.gch); } }, true);

/* Hook des Tages */
const HOOKS = () => window.LDA_HOOKS || [];
const NICHE_WORD = { alltag:"deinem Alltag", humor:"deinen Sketchen", beauty:"Make-up", kreativ:"deinem Hobby", gaming:"Gaming", wissen:"deinen Tipps", fitness:"Sport", liebe:"Beziehungen", tiere:"deinem Haustier", reisen:"Reisen" };
function dayIndex(n){ const d=new Date(); return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY) % n; }
function hookToday(){ const xs=HOOKS(); return xs.length ? xs[dayIndex(xs.length)] : null; }
function hookFill(t, email){
  const r=qzRes(email,"nische"), w=r && NICHE_WORD[r.result];
  return esc(t).replace(/\{thema\}/g, w ? `<mark>${esc(w)}</mark>` : `<mark>[dein Thema]</mark>`);
}
function openHook(){
  const h=hookToday(); if (!h) return;
  const e=S.me.email, done=S.xp.some(x=>x.creator_email===e && x.kind==="hook" && x.ref===todayKey());
  sheet(`<div class="sh"><span class="eyebrow">Hook des Tages · ${esc(h.trig||"")}</span><h2>Dein Einstieg <em>für heute</em></h2></div>
    <div class="hookcard"><p class="hooktxt">„${hookFill(h.t, e)}“</p>${h.tip?`<small class="muted">${esc(h.tip)}</small>`:""}</div>
    <p class="muted">Pass das markierte Wort an dein Thema an. Der Hook gehört in die ersten 2 Sekunden, als Text oben im Bild und gesprochen.</p>
    <button class="btn" id="hook-copy" data-txt="${esc(h.t.replace(/\{thema\}/g, NICHE_WORD[qzRes(e,"nische")?.result] || "[dein Thema]"))}">${ic("i-check")} Kopieren</button>`);
  if (!done) award("hook", todayKey()).then(n=>{ if(n) render(true); });
}

/* Impuls der Woche */
const IMPULSE = () => window.LDA_IMPULSE || [];
function impulsNow(){ const xs=IMPULSE(); if (!xs.length) return null; const base=Date.UTC(2026,10,23), w=Math.max(0,Math.floor((Date.now()-base)/(7*DAY))); return xs[w % xs.length]; }
function openImpuls(){
  const im=impulsNow(); if (!im) return;
  const e=S.me.email, wk=weekKey(), A=S.impAns?.[wk]||{};
  sheet(`<div class="sh"><span class="eyebrow">Impuls der Woche${im.src?` · ${esc(im.src)}`:""}</span><h2>${esc(im.title)}</h2></div>
    <div class="impbody">${im.text.map(p=>`<p>${esc(p)}</p>`).join("")}</div>
    ${im.note?`<p class="muted small">${esc(im.note)}</p>`:""}
    <div class="wkh"><span>3 FRAGEN</span><small class="muted">je 10 XP</small></div>
    ${im.q.map((q,i)=>`<div class="impq"><b>${esc(q.q)}</b><div class="qa">${q.a.map((a,j)=>{ const st=A[i]; const cls=st==null?"":j===q.ok?"right":st===j?"wrong":"";
      return `<button class="iqopt ${cls}" data-iq="${i}" data-ia="${j}" ${st!=null?"disabled":""}>${esc(a)}</button>`; }).join("")}</div>
      ${A[i]!=null?`<small class="${A[i]===q.ok?"ok":"muted"}">${A[i]===q.ok?"Richtig!":"Leider nicht. Richtig ist: "+esc(q.a[q.ok])}</small>`:""}</div>`).join("")}`);
  award("impuls", wk).then(n=>{ if(n) render(true); });
}
function answerImpuls(i, j){
  const im=impulsNow(), wk=weekKey(); S.impAns ||= {}; const A=(S.impAns[wk] ||= {});
  if (A[i]!=null) return; A[i]=j; storeSet("ldb-imp-"+S.me.email, S.impAns);
  const y=$("#sheet .sheetwrap")?.scrollTop; openImpuls(); const sw=$("#sheet .sheetwrap"); if (sw && y!=null) sw.scrollTop=y;
  if (j===im.q[i].ok) award("iq"+(i+1), wk).then(n=>{ if(n) render(true); });
}

/* Top 5 aus der Backstage-Liste */
function topLists(){
  if (!S.bsTop.length) return "";
  const m=S.bsTop[0].month, L=k=>S.bsTop.filter(x=>x.list===k).sort((a,b)=>a.place-b.place);
  const medal=["🥇","🥈","🥉","4","5"], col=(t,i,xs)=>`<div class="tl5"><span class="tl5h">${ic(i)} ${t}</span><ol>${xs.map(x=>`<li><span class="pl">${medal[x.place-1]||x.place}</span><b>@${esc(String(x.handle).replace(/^@/,""))}</b></li>`).join("")}</ol></div>`;
  return `<div class="sec"><span>Top 5 · ${esc(ymLabel(m))}</span><small>Agentur</small></div>
    <div class="panel top2">${col("Diamanten","i-gem",L("d"))}${col("Fleißigste","i-fire",L("t"))}</div>`;
}

/* Monatsziel */
const goalOf = (email, ym=ymNow()) => S.goals.find(g=>g.creator_email===email && g.month===ym);
function goalCard(email, mine){
  const g=goalOf(email); if (!g) return "";
  const pct=g.target ? Math.min(100, Math.round((g.current||0)/g.target*100)) : 0;
  return `<div class="panel goal ${g.done?"done":""}"><div class="gh"><span class="gic">${ic(g.done?"i-trophy":"i-star")}</span><span><small class="muted">Monatsziel ${esc(ymLabel(g.month))}</small><b>${esc(g.title)}</b></span>${g.done?`<span class="tag gold">Geschafft · 250 XP</span>`:""}</div>
    ${g.target?`<span class="lvbar"><i style="width:${pct}%"></i></span><small class="muted">${fmtN(g.current)} von ${fmtN(g.target)} ${esc(g.unit||"")} · ${pct} %</small>`:""}
    ${mine && !g.done && !readOnly() && !S.me.preview ? `<div class="grow"><input id="gl-cur" type="number" inputmode="numeric" min="0" placeholder="Dein Stand" value="${g.current||""}"><button class="btn small" id="gl-save">Stand speichern</button></div>` : ""}</div>`;
}
function goalAdmin(email){
  if (S.noUpd9) return "";
  const g=goalOf(email), ym=ymNow();
  if (g) return `<div class="panel stack"><h2>Monatsziel</h2>${goalCard(email,false)}
    <div class="actions">${!g.done?`<button class="btn small" data-goaldone="${esc(email)}">Erreicht bestätigen</button>`:`<button class="btn small ghost" data-goalundo="${esc(email)}">Doch nicht erreicht</button>`}
    <button class="btn small ghost" data-goaldel="${esc(email)}">${S.confirmDelete==="goal"+email?"Wirklich löschen?":"Löschen"}</button></div></div>`;
  if (!S.goalOpen) return `<button class="panel kkcard" data-goalnew="${esc(email)}"><span class="ic">${ic("i-star")}</span><span><b>Monatsziel vereinbaren</b><small class="muted">Freiwillig, z. B. eine Diamanten-Challenge für ${esc(ymLabel(ym))}</small></span><span class="go">Anlegen</span></button>`;
  return `<div class="panel stack"><h2>Monatsziel für ${esc(ymLabel(ym))}</h2>
    <label class="f" for="g-title">Ziel<input id="g-title" type="text" placeholder="z. B. 50.000 Diamanten im Dezember"></label>
    <div class="grid2"><label class="f" for="g-target">Zielwert (optional, für den Balken)<input id="g-target" type="number" inputmode="numeric" min="1" placeholder="50000"></label>
    <label class="f" for="g-unit">Einheit<input id="g-unit" type="text" value="Diamanten"></label></div>
    <div class="actions"><button class="btn small" data-goalsave="${esc(email)}">Ziel speichern</button><button class="btn small ghost" id="g-cancel">Abbrechen</button></div></div>`;
}
async function goalSave(email){
  const title=$("#g-title").value.trim(), target=+$("#g-target").value||null, unit=$("#g-unit").value.trim()||null;
  if (!title) return toast("Bitte das Ziel eintragen.");
  const r=await sb.from("goals").upsert({ creator_email:email, month:ymNow(), title, target, unit, set_by:S.real.email, updated_at:new Date().toISOString() },{ onConflict:"creator_email,month" });
  if (r.error) return fail(r.error);
  S.goalOpen=false; await refresh(); render(true); toast("Monatsziel gespeichert.");
}
async function goalSet(email, patch){
  const r=await sb.from("goals").update({ ...patch, updated_at:new Date().toISOString() }).eq("creator_email",email).eq("month",ymNow());
  if (r.error) return fail(r.error); await refresh(); render(true);
}
async function goalDelete(email){
  if (S.confirmDelete!=="goal"+email){ S.confirmDelete="goal"+email; return render(true); }
  S.confirmDelete=null; const r=await sb.from("goals").delete().eq("creator_email",email).eq("month",ymNow()); if (r.error) return fail(r.error);
  await refresh(); render(true); toast("Gelöscht.");
}
async function goalProgress(){
  const v=+$("#gl-cur").value; if (!(v>=0)) return toast("Bitte eine Zahl eintragen.");
  const r=await sb.rpc("goal_progress",{ m:ymNow(), val:v }); if (r.error) return fail(r.error);
  const g=goalOf(S.me.email); if (g) g.current=v; render(true); toast("Stand gespeichert.");
}

/* Freischaltungen */
function unlocksBlock(email){
  const xs=S.extras.filter(x=>x.level!=null).sort((a,b)=>a.level-b.level); if (!xs.length) return "";
  const L=levelOf(xpOf(email)).n, own=email===S.me.email;
  return `<div class="sec"><span>Freischaltungen</span><small>${xs.filter(x=>L>=x.level).length} von ${xs.length}</small></div>
  <div class="extras">${xs.map(x=> L>=x.level && own ? extraCard(x,null)
    : `<div class="doc locked"><span class="lockic">${ic("i-lock")}</span><span><b>${esc(x.title)}</b><small class="muted">ab Stufe ${x.level} · ${esc(LEVELS[x.level-1]?.[1]||"")}</small></span></div>`).join("")}</div>`;
}
function liveStand(email){
  const b=bsRows(email)[0]; if (!b) return "";
  return `<div class="sec"><span>Live · letzte 30 Tage</span><small>Stand ${esc(ymLabel(b.month))}</small></div>
  <div class="stats"><div><b>${fmtN(b.days)}</b><small>Live-Tage</small></div><div><b>${fmtN(Math.round(b.hours))}</b><small>Stunden</small></div><div><b>${b.rank_t&&b.rank_t<=10?"#"+b.rank_t:"–"}</b><small>Fleiß-Platz</small></div></div>`;
}

/* Backstage-Liste hochladen (nur Leitung) */
async function readXlsx(file){
  const buf=new Uint8Array(await file.arrayBuffer()), dv=new DataView(buf.buffer), td=new TextDecoder();
  let e=buf.length-22; while (e>=0 && dv.getUint32(e,true)!==0x06054b50) e--;
  if (e<0) throw new Error("Das ist keine Excel-Datei (.xlsx).");
  const n=dv.getUint16(e+10,true), files={}; let p=dv.getUint32(e+16,true);
  for (let i=0;i<n;i++){ const fl=dv.getUint16(p+28,true), xl=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true);
    files[td.decode(buf.subarray(p+46,p+46+fl))]={ m:dv.getUint16(p+10,true), csz:dv.getUint32(p+20,true), off:dv.getUint32(p+42,true) }; p+=46+fl+xl+cl; }
  const get=async name=>{ const f=files[name]; if (!f) return null; const o=f.off+30+dv.getUint16(f.off+26,true)+dv.getUint16(f.off+28,true), d=buf.subarray(o,o+f.csz);
    if (f.m===0) return td.decode(d); return await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text(); };
  const P=x=>new DOMParser().parseFromString(x,"application/xml"), ss=[];
  const sx=await get("xl/sharedStrings.xml"); if (sx) for (const si of P(sx).getElementsByTagName("si")) ss.push([...si.getElementsByTagName("t")].map(t=>t.textContent).join(""));
  const sheetName=Object.keys(files).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  const doc=P(await get(sheetName)||""), rows=[];
  for (const r of doc.getElementsByTagName("row")){ const row=[];
    for (const c of r.getElementsByTagName("c")){ const ref=c.getAttribute("r")||"", col=[...ref.replace(/\d+/g,"")].reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1, t=c.getAttribute("t");
      const v=c.getElementsByTagName("v")[0]?.textContent ?? "", val = t==="s" ? ss[+v] : t==="inlineStr" ? [...c.getElementsByTagName("t")].map(x=>x.textContent).join("") : v;
      row[col<0?row.length:col]=val; }
    rows.push(row); }
  return rows;
}
function parseBackstage(rows){
  const hi=rows.findIndex(r=>r && r.some(x=>/Anmeldename/i.test(x||""))); if (hi<0) throw new Error("Spalte „Anmeldename“ nicht gefunden. Ist das der Export „Creator*innen verwalten“?");
  const H=rows[hi].map(x=>String(x||"").replace(/\s+/g," ")), col=rx=>H.findIndex(x=>rx.test(x));
  const cH=col(/Anmeldename/i), cD=col(/^Diamanten in den letzten 30/i), cT=col(/G.ltige LIVE-Gehen-Tage/i), cL=col(/LIVE-Dauer/i);
  if (cD<0 || cT<0) throw new Error("Spalten für Diamanten oder Live-Tage fehlen im Export.");
  const num=v=>{ const x=parseFloat(String(v??"").replace(/\s/g,"").replace(",",".")); return isFinite(x)?x:0; };
  const out=rows.slice(hi+1).filter(r=>r && r[cH]).map(r=>({ handle:hnorm(r[cH]), diamonds:Math.round(num(r[cD])), days:Math.round(num(r[cT])), hours:cL>=0?Math.round(num(r[cL])*100)/100:0 }));
  const by=(k,k2)=>out.filter(x=>x[k]>0).sort((a,b)=>b[k]-a[k] || (k2?b[k2]-a[k2]:0));
  by("diamonds").forEach((x,i)=>x.rank_d=i+1); by("days","hours").forEach((x,i)=>x.rank_t=i+1);
  return out;
}
function backstagePanel(){
  if (S.noUpd9) return `<div class="panel"><p class="err">Für die Backstage-Liste zuerst update-9.sql in Supabase ausführen.</p></div>`;
  const P=S.bsPrev, d=new Date(), def=d.getDate()<=10 ? new Date(d.getFullYear(), d.getMonth()-1, 1) : d, months=[...new Set(S.bs.map(b=>b.month))].sort().reverse();
  const known=new Set(S.members.filter(m=>m.role==="creator").map(m=>hnorm(m.handle)));
  return `<div class="panel stack"><h2>Backstage-Liste</h2>
    <p class="muted">Export „Creator*innen verwalten“ aus dem LIVE Backstage hochladen. Die Zahlen gelten für die letzten 30 Tage, also am besten am 1. des Monats für den Vormonat. Daraus kommen die XP für Live-Tage, die Plätze und die zwei Top-5-Listen.${months.length?` Hochgeladen: ${months.map(ymLabel).join(", ")}.`:""}</p>
    <div class="grid2"><label class="f" for="bs-month">Monat<input id="bs-month" type="month" value="${P?.month||`${def.getFullYear()}-${pad(def.getMonth()+1)}`}"></label>
    <label class="f" for="bs-file">Excel-Datei (.xlsx)<input id="bs-file" type="file" accept=".xlsx"></label></div>
    ${P?`<div class="bsprev"><p><b>${P.rows.length} Creator</b> erkannt, davon ${P.rows.filter(r=>known.has(r.handle)).length} mit Konto in der App.</p>
      <div class="top2">${[["Diamanten","rank_d"],["Fleißigste","rank_t"]].map(([t,k])=>`<div class="tl5"><span class="tl5h">${t}</span><ol>${P.rows.filter(r=>r[k]&&r[k]<=5).sort((a,b)=>a[k]-b[k]).map(r=>`<li><span class="pl">${r[k]}</span><b>@${esc(r.handle)}</b><small class="muted">${k==="rank_d"?fmtN(r.diamonds)+" 💎":r.days+" Tage"}</small></li>`).join("")}</ol></div>`).join("")}</div>
      <div class="actions"><button class="btn small" id="bs-save">Für ${esc(ymLabel(P.month))} speichern</button><button class="btn small ghost" id="bs-cancel">Abbrechen</button></div></div>`:""}</div>`;
}
async function backstageRead(){
  const f=$("#bs-file").files[0]; if (!f) return;
  try{ const rows=parseBackstage(await readXlsx(f)); S.bsPrev={ month:$("#bs-month").value, rows }; render(true); }
  catch(e){ toast(e.message||String(e)); }
}
async function backstageSave(){
  const P=S.bsPrev; if (!P) return; P.month=$("#bs-month").value||P.month;
  if (!/^\d{4}-\d{2}$/.test(P.month)) return toast("Bitte den Monat wählen.");
  $("#bs-save").disabled=true;
  let r=await sb.from("backstage").delete().eq("month",P.month); if (r.error) return fail(r.error);
  r=await sb.from("backstage").insert(P.rows.map(x=>({ month:P.month, handle:x.handle, days:x.days, hours:x.hours, diamonds:x.diamonds, rank_d:x.rank_d||null, rank_t:x.rank_t||null })));
  if (r.error) return fail(r.error);
  S.bsPrev=null; await refresh(); render(true); toast("Backstage-Liste gespeichert.");
}

/* ---------- Sag's uns (anonym) ---------- */
const KK_KINDS = [["frage","❓ Frage"],["kritik","💬 Kritik"],["wunsch","✨ Wunsch"]];
const kkLabel = k => (KK_KINDS.find(x=>x[0]===(k||"frage"))||KK_KINDS[0])[1];
function fab(){ $("#kk-fab")?.remove(); }
function fabOld(){
  let b=$("#kk-fab");
  if (!b){ b=document.createElement("button"); b.id="kk-fab"; b.className="fab"; b.setAttribute("aria-label","Anonyme Nachricht schreiben");
    b.innerHTML=`<span class="ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg></span><span class="tx"><b>Sag's uns</b><small>anonym</small></span>`; document.body.appendChild(b); }
  const show = S.me && S.me.role==="creator" && !S.noUpd5 && !S.openArea && !S.qz;
  if (show && !S.viewAs && !storeGet("ldb-fabtip") && !$("#fab-tip")){ storeSet("ldb-fabtip",1);
    const tip=document.createElement("div"); tip.id="fab-tip"; tip.className="fabtip"; tip.textContent="Fragen, Kritik, Wünsche? Hier anonym. 💜"; document.body.appendChild(tip);
    setTimeout(()=>tip.classList.add("show"),1200); setTimeout(()=>{ tip.classList.remove("show"); setTimeout(()=>tip.remove(),500); },7500); }
  b.hidden = !show;
}
function openKK(){
  const ro=readOnly()||S.me.preview, k=S.kkKind||"frage", pub=S.questions.filter(q=>q.published);
  sheet(`<div class="sh"><span class="eyebrow">Anonym</span><h2>Sag's <em>uns</em></h2></div>
    <p class="kk-safe">🔒 Dein Name wird nicht gespeichert. Niemand sieht, von wem die Nachricht ist.</p>
    <div class="seg" role="group" aria-label="Art der Nachricht">${KK_KINDS.map(([v,l])=>`<button data-kk="${v}" aria-pressed="${k===v}">${l}</button>`).join("")}</div>
    <textarea id="qbox" maxlength="1000" placeholder="${k==="kritik"?"Was stört dich? Sag es ehrlich.":k==="wunsch"?"Was wünschst du dir von der Agentur?":"Was willst du wissen?"}">${esc(S.kkDraft||"")}</textarea>
    <button class="btn" id="qsend" ${ro?"disabled":""}>Anonym abschicken</button>
    ${pub.length?`<div class="wkh"><span>ANTWORTEN</span><small class="muted">Fragen, die schon beantwortet sind</small></div><div class="list">${pub.map(q=>`<div class="row"><b>${esc(q.body)}</b>${q.answer?`<p class="feedback">${esc(q.answer)}</p>`:""}</div>`).join("")}</div>`:""}`);
}
async function sendQuestion(){
  const body=($("#qbox").value||"").trim(); if (body.length<3) return toast("Schreib bitte ein paar Worte.");
  const row={ body }; if (!S.noUpd7) row.kind=S.kkKind||"frage";
  const r=await sb.from("questions").insert(row); if (r.error) return fail(r.error);
  S.kkDraft=""; closeSheet(); toast("Danke! Deine Nachricht ist anonym angekommen. 💜");
}

/* ---------- Fenster (Sheet) ---------- */
function sheet(html){
  let w=$("#sheet");
  if (!w){ w=document.createElement("div"); w.id="sheet"; w.className="sheetwrap"; document.body.appendChild(w); }
  w.innerHTML=`<div class="sheet panel stack" role="dialog" aria-modal="true"><button class="x" id="sheet-x" aria-label="Schließen">✕</button>${html}</div>`;
  requestAnimationFrame(()=>w.classList.add("show")); document.body.classList.add("noscroll");
  hydrate().catch(console.error);
}
function closeSheet(){ const w=$("#sheet"); if (w){ w.classList.remove("show"); document.body.classList.remove("noscroll"); } }

/* ---------- Kalender ---------- */
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const KIND = { tiktok:"TikTok-Kampagne", livedream:"LIVEdream-Kampagne", termin:"Termin" };
const pd = s => { const [y,m,d]=String(s).slice(0,10).split("-").map(Number); return new Date(y,m-1,d); };
const fmtDate = s => { const d=pd(s); return `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()}`; };
const fmtRange = c => c.starts===c.ends ? fmtDate(c.starts) : `${fmtDate(c.starts)} bis ${fmtDate(c.ends)}`;
const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,"<br>");
const isDraft = c => c.status==="draft";
function calItems(scope){
  const live=S.cal.filter(c=>!isDraft(c));
  if (scope==="lead") return live.filter(c=>c.audience==="lead" || (S.calShowCamp!==false && c.audience==="all"));
  return live.filter(c=>c.audience==="all");
}
function calDrafts(){
  const ds=S.cal.filter(isDraft).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  if (!ds.length) return "";
  return `<div class="panel stack drafts"><div class="wkh"><span>NEU AUS LARK · ZUR FREIGABE</span><small class="muted">${ds.length}</small></div>
    <p class="muted" style="margin:0">Der Lark-Bot hat diese Kampagnen erkannt. Kurz prüfen, dann freigeben. Erst danach sehen die Creator sie.</p>
    ${ds.map(c=>`<div class="draft">${calCard(c)}<div class="actions"><button class="btn small gold" data-calok="${esc(c.id)}">Freigeben</button><button class="btn small ghost" data-caledit="${esc(c.id)}">Bearbeiten</button></div></div>`).join("")}</div>`;
}
async function calApprove(id){
  const r=await sb.from("calendar").update({ status:"live" }).eq("id",id); if (r.error) return fail(r.error);
  closeSheet(); await refresh(); render(true); toast("Freigegeben. Die Creator sehen die Kampagne jetzt.");
}
function calMonth(){ if (!S.calMonth){ const n=new Date(); S.calMonth=new Date(n.getFullYear(), n.getMonth(), 1); } return S.calMonth; }
function calGrid(items){
  const m0=calMonth(), y=m0.getFullYear(), mo=m0.getMonth();
  const first=new Date(y,mo,1), start=new Date(first); start.setDate(1-((first.getDay()+6)%7));
  const today=isoDay(new Date());
  let h=`<div class="cal"><div class="calhead"><button class="chip" data-calnav="-1" aria-label="Vorheriger Monat">‹</button><b>${MONTHS[mo]} ${y}</b><button class="chip" data-calnav="1" aria-label="Nächster Monat">›</button></div>
    <div class="caldow">${["Mo","Di","Mi","Do","Fr","Sa","So"].map(d=>`<span>${d}</span>`).join("")}</div>`;
  for (let w=0; w<6; w++){
    const ws=new Date(start); ws.setDate(start.getDate()+w*7);
    if (w>3 && ws.getMonth()!==mo) break;
    const we=new Date(ws); we.setDate(ws.getDate()+6);
    const segs=items.filter(c=>pd(c.starts)<=we && pd(c.ends)>=ws).sort((a,b)=>a.starts.localeCompare(b.starts)||b.ends.localeCompare(a.ends));
    const lanes=[]; const placed=segs.map(c=>{
      const s=Math.max(0,Math.round((pd(c.starts)-ws)/DAY)), e=Math.min(6,Math.round((pd(c.ends)-ws)/DAY));
      let l=lanes.findIndex(end=>end<s); if (l<0){ l=lanes.length; lanes.push(e); } else lanes[l]=e;
      return { c, s, e, l };
    });
    const shown=placed.filter(p=>p.l<3), more=Array(7).fill(0); placed.filter(p=>p.l>=3).forEach(p=>{ for(let i=p.s;i<=p.e;i++) more[i]++; });
    h += `<div class="calweek" style="--lanes:${Math.min(3,lanes.length)}">`;
    for (let i=0;i<7;i++){ const d=new Date(ws); d.setDate(ws.getDate()+i);
      h += `<span class="calday ${d.getMonth()!==mo?"out":""} ${isoDay(d)===today?"today":""}" style="grid-column:${i+1}">${d.getDate()}${more[i]?`<small>+${more[i]}</small>`:""}</span>`; }
    h += shown.map(p=>`<button class="calbar k-${p.c.kind} ${pd(p.c.starts)<ws?"cont":""} ${pd(p.c.ends)>we?"goes":""}" style="grid-column:${p.s+1}/${p.e+2};grid-row:${p.l+2}" data-cal="${esc(p.c.id)}" title="${esc(p.c.title)}">${esc(p.c.title)}</button>`).join("");
    h += `</div>`;
  }
  return h + `</div>`;
}
function calCard(c){
  return `<button class="doc calitem" data-cal="${esc(c.id)}">${c.image?`<img class="thumb" data-cimg="${esc(c.image)}" alt="">`:`<span class="thumb k-${c.kind}"></span>`}
    <span><b>${esc(c.title)}</b><small class="muted">${KIND[c.kind]||""} · ${esc(fmtRange(c))}${c.at_time?" · "+esc(c.at_time):""}</small></span></button>`;
}
function calLists(items){
  const t=isoDay(new Date()), now=items.filter(c=>c.starts<=t && c.ends>=t), soon=items.filter(c=>c.starts>t).sort((a,b)=>a.starts.localeCompare(b.starts)), past=items.filter(c=>c.ends<t).sort((a,b)=>b.ends.localeCompare(a.ends));
  const blk=(l,xs,sub)=>xs.length?`<div class="wkh"><span>${l}</span><small class="muted">${sub}</small></div><div class="extras">${xs.map(calCard).join("")}</div>`:"";
  return blk("LÄUFT GERADE",now,`${now.length}`) + blk("KOMMT BALD",soon,`${soon.length}`)
    + (past.length?`<details class="past"><summary>Vorbei (${past.length})</summary><div class="extras">${past.slice(0,30).map(calCard).join("")}</div></details>`:"")
    + (!items.length?`<div class="panel"><p class="muted">Noch keine Einträge.</p></div>`:"");
}
function calForm(scope){
  const e=S.calEdit && S.cal.find(c=>c.id===S.calEdit), d=e||S.calDraft||{}, termin=scope==="lead";
  if (!S.calOpen && !e) return `<button class="btn small" id="cal-new">${termin?"＋ Termin eintragen":"＋ Kampagne eintragen"}</button>`;
  return `<div class="panel stack calform"><h2>${e?"Eintrag bearbeiten":termin?"Neuer Termin":"Neue Kampagne"}</h2>
    ${!e&&!termin?`<label class="f" for="cf-paste">Nachricht aus Lark einfügen (optional)<textarea id="cf-paste" placeholder="Einfach die ganze Nachricht hier reinkopieren. Titel, Daten und Link werden erkannt."></textarea></label>
    <button class="btn small ghost" id="cf-parse">Erkennen</button>`:""}
    <div class="grid2"><label class="f" for="cf-title">Titel<input id="cf-title" type="text" maxlength="200" value="${esc(d.title||"")}"></label>
    <label class="f" for="cf-kind">Art<select id="cf-kind">${(termin?["termin","tiktok","livedream"]:["tiktok","livedream","termin"]).map(k=>`<option value="${k}" ${(d.kind||(termin?"termin":"tiktok"))===k?"selected":""}>${KIND[k]}</option>`).join("")}</select></label>
    <label class="f" for="cf-start">Von<input id="cf-start" type="date" value="${esc(d.starts||"")}"></label>
    <label class="f" for="cf-end">Bis<input id="cf-end" type="date" value="${esc(d.ends||"")}"></label>
    ${true?`<label class="f" for="cf-time">Uhrzeit (optional)<input id="cf-time" type="text" placeholder="z. B. 14:00" value="${esc(d.at_time||"")}"></label>`:""}
    <label class="f" for="cf-link">Link (optional)<input id="cf-link" type="url" value="${esc(d.link||"")}"></label></div>
    <label class="f" for="cf-body">Infos${termin?"":" für die Creator"}<textarea id="cf-body" maxlength="8000">${esc(d.body||"")}</textarea></label>
    <label class="f" for="cf-img">Bild (optional)${e?.image?" · ein Bild ist schon da":""}<input id="cf-img" type="file" accept="image/*"></label>
    <input type="hidden" id="cf-aud" value="${termin?(e?.audience||"lead"):"all"}">
    ${termin?`<label class="qopt" style="font-size:13px;color:var(--soft)"><input type="checkbox" id="cf-public" ${(e?.audience||"lead")==="all"?"checked":""}> Auch für alle Creator im Kalender zeigen</label>`:""}
    <div class="actions">${e&&isDraft(e)?`<button class="btn small gold" id="cf-saveok">Speichern + freigeben</button>`:""}<button class="btn small ${e&&isDraft(e)?"ghost":"gold"}" id="cf-save">Speichern</button><button class="btn small ghost" id="cf-cancel">Abbrechen</button>
    ${e?`<button class="btn small danger" id="cf-del">${S.confirmDelete==="cal:"+e.id?"Wirklich löschen?":"Löschen"}</button>`:""}</div></div>`;
}
function calendarView(){
  const lead=S.me.role==="lead", items=calItems("all");
  let h=`<div class="stack"><span class="eyebrow">LIVEdream Academy</span><h1>Kampagnen-<em>Kalender</em></h1>
    <p class="muted">Alle TikTok- und LIVEdream-Kampagnen auf einen Blick. Tipp auf eine Kampagne für alle Infos.</p></div>`;
  h += termTeaser();
  if (S.noUpd7) return h + `<div class="panel"><p class="err">${lead?"Zuerst update-7.sql in Supabase ausführen.":"Der Kalender kommt bald."}</p></div>`;
  h += `<div class="legend"><span><i class="k-tiktok"></i>TikTok</span><span><i class="k-livedream"></i>LIVEdream</span></div>`;
  if (lead) h += calDrafts() + calForm("all");
  return h + calGrid(items) + calLists(items);
}
function openCal(id){
  const c=S.cal.find(x=>x.id===id); if (!c) return;
  if (c.audience==="all" && !isDraft(c)) award("camp", String(c.id)).then(n=>{ if(n) render(true); });
  const lead=S.me.role==="lead" && !S.viewAs;
  sheet(`${c.image?`<a data-chref="${esc(c.image)}" target="_blank" rel="noopener"><img class="calimg" data-cimg="${esc(c.image)}" alt=""></a>`:""}
    <div class="sh"><span class="eyebrow">${KIND[c.kind]||""}${c.audience==="lead"?" · nur Führung":""}${isDraft(c)?" · Entwurf aus Lark":""}</span><h2>${esc(c.title)}</h2></div>
    <p class="caldates">📅 ${esc(fmtRange(c))}${c.at_time?` · ${esc(c.at_time)}`:""}</p>
    ${c.body?`<div class="legaltext">${linkify(c.body)}</div>`:""}
    ${c.link?`<a class="btn" href="${esc(c.link)}" target="_blank" rel="noopener">Zur Kampagne</a>`:""}
    ${lead&&isDraft(c)?`<button class="btn small gold" data-calok="${esc(c.id)}">Freigeben</button>`:""}
    ${lead?`<button class="btn small ghost" data-caledit="${esc(c.id)}">Bearbeiten</button>`:""}`);
}
const MONTH_RX = { jan:0, januar:0, feb:1, februar:1, "mär":2, maerz:2, "märz":2, mar:2, march:2, apr:3, april:3, mai:4, may:4, jun:5, juni:5, june:5, jul:6, juli:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, okt:9, oct:9, oktober:9, october:9, nov:10, november:10, dez:11, dec:11, dezember:11, december:11 };
function parseLark(text){
  const t=String(text||""), out={ body:t.trim() };
  const link=t.match(/https?:\/\/[^\s)\]>]+/); if (link) out.link=link[0];
  const lines=t.split(/\n/).map(l=>l.replace(/[*#_`【】\[\]]/g,"").replace(/^[^\p{L}\p{N}]+/u,"").trim()).filter(l=>l && !/^https?:/.test(l));
  const skip=/^(hi|hallo|hey|liebe|hello)\b|neue kampagne|new campaign|^(start|end)datum|^zeitraum|^für wen|^from\b/i, tl=lines.find(l=>!skip.test(l)&&l.length>2)||lines[0];
  if (tl) out.title=tl.replace(/\s*[:：]\s*$/,"").slice(0,120);
  const now=new Date(), ds=[];
  const add=(y,m,d)=>{ if (m<0||m>11||d<1||d>31) return; let yy=y?(y<100?2000+y:y):now.getFullYear(); let dt=new Date(yy,m,d); if (!y && dt<new Date(now.getFullYear(),now.getMonth()-2,1)) dt=new Date(yy+1,m,d); ds.push({ dt, i:ds.length }); };
  let mm; const rx=/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?|(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]{3,9})\.?(?:\s+(\d{4}))?|([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?|(\d{4})\/(\d{1,2})\/(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  while ((mm=rx.exec(t))){
    if (mm[1]) add(+mm[1],+mm[2]-1,+mm[3]);
    else if (mm[4]) add(mm[6]?+mm[6]:0,+mm[5]-1,+mm[4]);
    else if (mm[7]){ const k=MONTH_RX[mm[8].toLowerCase()]; if (k!==undefined) add(mm[9]?+mm[9]:0,k,+mm[7]); }
    else if (mm[10]){ const k=MONTH_RX[mm[10].toLowerCase()]; if (k!==undefined) add(mm[12]?+mm[12]:0,k,+mm[11]); }
    else if (mm[13]) add(+mm[13],+mm[14]-1,+mm[15]);
    else if (mm[16]) add(+mm[18],+mm[17]-1,+mm[16]);
  }
  if (ds.length){ const s=ds.map(x=>x.dt).sort((a,b)=>a-b); out.starts=isoDay(s[0]); out.ends=isoDay(s[s.length-1]); }
  out.kind=/livedream|agentur intern|unsere eigene/i.test(t)?"livedream":"tiktok";
  return out;
}
function calRead(){
  const g=id=>($("#"+id)?.value||"").trim();
  return { title:g("cf-title"), kind:g("cf-kind"), starts:g("cf-start"), ends:g("cf-end")||g("cf-start"), at_time:g("cf-time")||null, link:g("cf-link")||null, body:g("cf-body")||null,
    audience: $("#cf-public") ? ($("#cf-public").checked?"all":"lead") : g("cf-aud") };
}
async function calSave(approve){
  const row=calRead(), f=$("#cf-img")?.files?.[0]; if (approve) row.status="live";
  if (!row.title) return toast("Bitte einen Titel eingeben.");
  if (!row.starts) return toast("Bitte das Startdatum eintragen.");
  if (row.ends<row.starts) return toast("„Bis“ liegt vor „Von“.");
  if (row.link && !/^https?:\/\//.test(row.link)) row.link="https://"+row.link;
  try{
    $("#cf-save").disabled=true;
    if (f){ if (f.size>MAX_FILE) throw new Error("Das Bild ist größer als 50 MB.");
      const p=`kalender-${Date.now()}-${f.name.normalize("NFKD").replace(/[^\w.\-]+/g,"_").slice(-50)}`;
      const u=await sb.storage.from("unterlagen").upload(p,f,{ contentType:f.type||undefined }); if (u.error) throw u.error; row.image=p; }
    const r = S.calEdit ? await sb.from("calendar").update(row).eq("id",S.calEdit) : await sb.from("calendar").insert({ ...row, created_by:S.real.email });
    if (r.error) throw r.error;
    S.calEdit=null; S.calOpen=false; S.calDraft=null; S.calMonth=new Date(pd(row.starts).getFullYear(), pd(row.starts).getMonth(), 1);
    await refresh(); render(true); toast(approve?"Gespeichert und freigegeben.":"Gespeichert.");
  } catch(err){ const b=$("#cf-save"); if(b) b.disabled=false; fail(err); }
}
async function calDelete(){
  const id=S.calEdit, k="cal:"+id; if (S.confirmDelete!==k){ S.calDraft=calRead(); S.confirmDelete=k; return render(true); }
  S.confirmDelete=null; const c=S.cal.find(x=>x.id===id);
  const r=await sb.from("calendar").delete().eq("id",id); if (r.error) return fail(r.error);
  if (c?.image) sb.storage.from("unterlagen").remove([c.image]).catch(()=>{});
  S.calEdit=null; S.calDraft=null; await refresh(); render(true); toast("Gelöscht.");
}

/* ---------- Führung: To-dos + Kalender ---------- */
const PRIO = { 1:["Hoch","err"], 2:["Mittel","gold"], 3:["Niedrig",""] };
const leads = () => S.members.filter(m=>m.role==="lead");
function taskRow(t){
  const today=isoDay(new Date()), late=t.due && !t.done_at && t.due<today, o=member(t.owner_email);
  return `<div class="row task ${t.done_at?"done":""}"><div class="head"><button class="tick" data-tdone="${esc(t.id)}" aria-pressed="${!!t.done_at}" aria-label="Erledigt">${t.done_at?"✓":""}</button>
    <b>${esc(t.title)}</b><span class="tag ${PRIO[t.priority]?.[1]||""}">${PRIO[t.priority]?.[0]||""}</span></div>
    <small class="muted">${o?"👤 "+esc(firstName(o)):"👤 offen"}${t.due?` · <span class="${late?"late":""}">📅 ${esc(fmtDate(t.due))}${late?" (überfällig)":""}</span>`:""}${t.done_at?` · erledigt ${fmtAgo(t.done_at)}`:""}</small>
    ${t.note?`<p class="feedback">${linkify(t.note)}</p>`:""}
    <div class="actions"><button class="chip" data-tedit="${esc(t.id)}">Bearbeiten</button><button class="chip" data-tdel="${esc(t.id)}">${S.confirmDelete==="t:"+t.id?"Wirklich löschen?":"Löschen"}</button></div></div>`;
}
function taskForm(){
  const e=S.taskEdit && S.tasks.find(t=>t.id===S.taskEdit), d=e||{};
  if (!S.taskOpen && !e) return `<button class="btn small" id="t-new">＋ Aufgabe</button>`;
  const areas=[...new Set(S.tasks.map(t=>t.area).concat(["Allgemein","Creator","Manager","Kampagnen","Finanzen","Website","Academy"]))];
  return `<div class="panel stack"><h2>${e?"Aufgabe bearbeiten":"Neue Aufgabe"}</h2>
    <label class="f" for="t-title">Was ist zu tun?<input id="t-title" type="text" maxlength="300" value="${esc(d.title||"")}"></label>
    <div class="grid2"><label class="f" for="t-area">Themenbereich<input id="t-area" type="text" list="t-areas" value="${esc(d.area||S.taskArea||"Allgemein")}"><datalist id="t-areas">${areas.map(a=>`<option value="${esc(a)}">`).join("")}</datalist></label>
    <label class="f" for="t-owner">Verantwortlich<select id="t-owner"><option value="">–</option>${leads().map(m=>`<option value="${esc(m.email)}" ${(d.owner_email||(!e?S.real.email:""))===m.email?"selected":""}>${esc(m.name||m.email)}</option>`).join("")}</select></label>
    <label class="f" for="t-due">Bis wann?<input id="t-due" type="date" value="${esc(d.due||"")}"></label>
    <label class="f" for="t-prio">Priorität<select id="t-prio">${[1,2,3].map(p=>`<option value="${p}" ${(d.priority||2)===p?"selected":""}>${PRIO[p][0]}</option>`).join("")}</select></label></div>
    <label class="f" for="t-note">Notiz (optional)<textarea id="t-note" maxlength="4000">${esc(d.note||"")}</textarea></label>
    <div class="actions"><button class="btn small gold" id="t-save">Speichern</button><button class="btn small ghost" id="t-cancel">Abbrechen</button></div></div>`;
}
function leadView(){
  let h=`<div class="stack"><span class="eyebrow">Nur Geschäftsführung</span><h1><em>Führung</em></h1><p class="muted">Eure Aufgaben und Termine. Sehen nur Zofy, Schlauchi und Nik.</p></div>`;
  if (S.noUpd7) return h + `<div class="panel"><p class="err">Zuerst update-7.sql in Supabase ausführen.</p></div>`;
  const f=S.taskFilter||"offen", me=S.real.email, today=isoDay(new Date());
  const open=S.tasks.filter(t=>!t.done_at);
  const xs=S.tasks.filter(t=> f==="erledigt" ? t.done_at : !t.done_at && (f!=="meine" || t.owner_email===me))
    .sort((a,b)=> f==="erledigt" ? String(b.done_at).localeCompare(String(a.done_at)) : (a.priority-b.priority) || String(a.due||"9").localeCompare(String(b.due||"9")));
  h += `<div class="score"><div class="panel stat"><b>${open.length}</b><small>offen</small></div><div class="panel stat"><b>${open.filter(t=>t.owner_email===me).length}</b><small>für mich</small></div><div class="panel stat"><b class="${open.some(t=>t.due&&t.due<today)?"late":""}">${open.filter(t=>t.due&&t.due<today).length}</b><small>überfällig</small></div></div>
    <div class="sh"><span class="eyebrow">To-dos</span><h2>Aufgaben</h2></div>
    <div class="seg" role="group">${[["offen","Alle offenen"],["meine","Meine"],["erledigt","Erledigt"]].map(([v,l])=>`<button data-tfilter="${v}" aria-pressed="${f===v}">${l}</button>`).join("")}</div>
    ${taskForm()}`;
  const groups={}; xs.forEach(t=>{ (groups[t.area||"Allgemein"] ||= []).push(t); });
  const keys=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  h += keys.length ? keys.map(k=>`<div class="wkh"><span>${esc(k.toUpperCase())}</span><small class="muted">${groups[k].length}</small></div><div class="list">${groups[k].map(taskRow).join("")}</div>`).join("")
    : `<div class="panel"><p class="muted">${f==="erledigt"?"Noch nichts erledigt.":"Keine offenen Aufgaben. 🎉"}</p></div>`;
  const items=calItems("lead");
  h += `<div class="sh" style="margin-top:12px"><span class="eyebrow">Nur Führung</span><h2>Termine</h2></div>
    <label class="qopt" style="font-size:13px;color:var(--soft)"><input type="checkbox" id="cal-showcamp" ${S.calShowCamp!==false?"checked":""}> Kampagnen mit anzeigen</label>
    <div class="legend"><span><i class="k-termin"></i>Termin</span><span><i class="k-tiktok"></i>TikTok</span><span><i class="k-livedream"></i>LIVEdream</span></div>
    ${calForm("lead")}${calGrid(items)}${calLists(items.filter(c=>c.audience==="lead"))}`;
  return h;
}
async function taskSave(){
  const g=id=>($("#"+id)?.value||"").trim();
  const row={ title:g("t-title"), area:g("t-area")||"Allgemein", owner_email:g("t-owner")||null, due:g("t-due")||null, priority:+g("t-prio")||2, note:g("t-note")||null };
  if (!row.title) return toast("Bitte die Aufgabe eintragen.");
  const r = S.taskEdit ? await sb.from("tasks").update(row).eq("id",S.taskEdit) : await sb.from("tasks").insert({ ...row, created_by:S.real.email });
  if (r.error) return fail(r.error);
  S.taskEdit=null; S.taskOpen=false; S.taskArea=row.area; await refresh(); render(true); toast("Gespeichert.");
}
async function taskToggle(id){
  const t=S.tasks.find(x=>x.id===id); if (!t) return;
  const r=await sb.from("tasks").update({ done_at: t.done_at?null:new Date().toISOString() }).eq("id",id); if (r.error) return fail(r.error);
  await refresh(); render(true); if (!t.done_at) toast("Erledigt ✓");
}
async function taskDelete(id){
  const k="t:"+id; if (S.confirmDelete!==k){ S.confirmDelete=k; return render(true); }
  S.confirmDelete=null; const r=await sb.from("tasks").delete().eq("id",id); if (r.error) return fail(r.error);
  await refresh(); render(true); toast("Gelöscht.");
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
  let h = `<div class="stack"><span class="eyebrow">Agenturleitung</span><h1><em>Teilnehmer</em></h1></div>${backstagePanel()}${rosterPanel()}
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
    ${S.extras.filter(x=>audOf(x)==="bootcamp").length?`<div class="list">${S.extras.filter(x=>audOf(x)==="bootcamp").map(x=>`<div class="row"><div class="head"><b>${x.kind==="reward"?"🎁":isVid(x.path)?"🎬":"📄"} ${esc(x.title)}${x.area?` <span class="muted">· Thema ${x.area}</span>`:""}</b><span class="actions"><a class="chip" data-handout="${esc(x.path)}" target="_blank" rel="noopener" style="text-decoration:none">Öffnen</a>${isVid(x.path)?vCoverBtn(x.path):""}<button class="chip" data-delextra="${esc(x.id)}">${S.confirmDelete===x.id?"Wirklich löschen?":"Löschen"}</button></span></div>${x.note?`<span class="muted">${esc(x.note)}</span>`:""}</div>`).join("")}</div>`:""}
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
  ${a.video_url && !/^https?:/.test(a.video_url) ? `<div class="video"><video data-video="${esc(a.video_url)}" controls playsinline preload="metadata"></video></div><div class="actions">${vCoverBtn(a.video_url)}</div>` : ""}
  <label class="f" for="ae-vfile">Lehrvideo hochladen (MP4, max. 50 MB)<input id="ae-vfile" type="file" accept="video/mp4,video/*"></label>
  <label class="f" for="ae-handout">Handout (PDF) ${a.handout_path?`· <a data-handout="${esc(a.handout_path)}" target="_blank" rel="noopener">aktuelles öffnen</a>`:"· noch keins"}<input id="ae-handout" type="file" accept="application/pdf"></label>
  <button class="btn" id="ae-save">Thema speichern</button></div>`;
  return h;
}
async function addExtra(pre="ex"){
  const q=id=>$(`#${pre}-${id}`);
  const title=q("title").value.trim(), note=q("note").value.trim()||null, f=q("file").files[0], ytRaw=q("yt")?.value.trim()||"";
  if (ytRaw && !ytId(ytRaw)) return toast("Das ist kein gültiger YouTube-Link.");
  if (ytRaw && !f){
    const audience=q("aud")?.value||null, category=q("cat")?.value.trim()||null, level=+(q("level")?.value)||null;
    if (!title) return toast("Bitte einen Titel eingeben.");
    const r=await sb.from("extras").insert(Object.assign({ title, note, path:"youtube", link:ytRaw, sort:S.extras.length }, audience?{audience, category}:{}, level?{level, category:"Freischaltungen"}:{}));
    if (r.error) return fail(r.error);
    await refresh(); render(true); return toast("Video hinzugefügt.");
  }
  if (!title || !f) return toast("Bitte Titel und Datei auswählen.");
  const vid=/^video\//.test(f.type)||isVid(f.name), ext=(f.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]||(vid?"mp4":"pdf")).toLowerCase(), area=+(q("area")?.value)||null, kind=q("kind")?.value||"extra", audience=q("aud")?.value||null, category=q("cat")?.value.trim()||null, level=+(q("level")?.value)||null;
  if (f.size>MAX_FILE) return toast("Die Datei ist größer als 50 MB.");
  try{
    q("add").disabled=true; q("add").textContent="Wird hochgeladen …";
    const path=`extra-${Date.now()}.${ext}`; let r=await sb.storage.from("unterlagen").upload(path,f,{contentType:f.type||"application/octet-stream"}); if(r.error) throw r.error;
    if (vid){ q("add").textContent="Vorschaubild …"; const ou=URL.createObjectURL(f); await savePoster(path, ou); URL.revokeObjectURL(ou); }
    r=await sb.from("extras").insert(Object.assign({ title, note, path, area, sort:S.extras.length }, ytRaw?{ link:ytRaw }:{}, kind==="reward"?{kind}:{}, audience?{audience, category}:{}, level?{level, category:"Freischaltungen"}:{})); if(r.error) throw r.error;
    await refresh(); render(true); toast("Extra hinzugefügt.");
  } catch(e){ fail(e); render(true); }
}
async function delExtra(id){
  if (S.confirmDelete!==id){ S.confirmDelete=id; return render(true); }
  const x=S.extras.find(y=>y.id===id); S.confirmDelete=null;
  const r=await sb.from("extras").delete().eq("id",id); if(r.error) return fail(r.error);
  if (x) await sb.storage.from("unterlagen").remove(isVid(x.path)?[x.path,posterOf(x.path)]:[x.path]).catch(()=>{});
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
      const path=`video-${n}-${Date.now()}.mp4`; const {error}=await sb.storage.from("unterlagen").upload(path,vf,{contentType:vf.type||"video/mp4"}); if(error) throw error; row.video_url=path;
      $("#ae-save").textContent="Vorschaubild …"; const ou=URL.createObjectURL(vf); await savePoster(path, ou); URL.revokeObjectURL(ou); }
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
<p>Die LIVEdream Academy ist eine Schulungsplattform für Creator und Manager der LIVEdream Agency. Sie stellt Lehrvideos, Handouts, Quizze und Aufgaben bereit, ermöglicht Abgaben, Bewertungen und Rückmeldungen und zeigt mit einem Level-System, Monatszielen und Ranglisten deinen Fortschritt.</p>
<h2>3. Welche Daten wir verarbeiten</h2>
<ul>
<li><b>Konto:</b> E-Mail-Adresse, Name, TikTok-Name, Rolle (Creator, Manager, Agenturleitung) und zugeordneter Manager.</li>
<li><b>Anmeldung:</b> Beim Login schicken wir dir einen Link oder Code per E-Mail. Dabei werden technisch nötige Daten wie Zeitpunkt und IP-Adresse kurz verarbeitet.</li>
<li><b>Lernfortschritt:</b> ob du Video, Quiz und Handout eines Themas abgeschlossen hast, an welchen Tagen du die App geöffnet hast (für die Streak-Anzeige) und deine Abzeichen.</li>
<li><b>Abgaben:</b> die Dateien, die du hochlädst (Fotos, Videos, PDFs), deine Nachricht an deinen Manager, Punkte und Rückmeldungen. Dazu deine Vorher-Nachher-Screenshots, falls du welche hochlädst.</li>
<li><b>Profilbild:</b> falls du eins hochlädst. Es wird vorher auf eine kleine Größe verkleinert.</li>
<li><b>Quizze:</b> deine Ergebnisse (z. B. Streamer-Typ und Nische), die als Titel in deinem Profil erscheinen.</li>
<li><b>Level und XP:</b> welche Aktionen dir XP gebracht haben (z. B. Einloggen, Hook des Tages, Impuls der Woche, gelesene Kampagnen) und deine Stufe.</li>
<li><b>Live-Daten aus dem TikTok-Backstage:</b> Die Agentur lädt monatlich die Backstage-Liste hoch. Daraus speichern wir zu deinem TikTok-Namen die gültigen Live-Tage, die Live-Stunden und die Diamanten der letzten 30 Tage sowie deine Plätze in den Agentur-Ranglisten.</li>
<li><b>Monatsziel:</b> das Ziel, das du mit deinem Manager vereinbarst, und dein eingetragener Stand.</li>
<li><b>Recruiter-Programm:</b> welche Streamer du geworben hast bzw. wer dich eingeladen hat, ob wir es bestätigt haben und ob deine Belohnung verschickt wurde.</li>
<li><b>Sag's uns:</b> Nachrichten werden ohne Namen und ohne E-Mail-Adresse gespeichert.</li>
<li><b>Umfrage:</b> deine Antworten. Sie sieht nur die Agenturleitung.</li>
<li><b>Ranglisten:</b> In den Top 5 (Bootcamp, Diamanten, Fleißigste) erscheint nur dein TikTok-Name mit Platz, ohne Zahlen.</li>
<li><b>Match-Börse und Erfolge-Wand (freiwillig):</b> Wenn du ein Inserat erstellst, „Bin dabei“ tippst, einen Erfolg teilst oder mit einem Emoji reagierst, speichern wir das mit deinem TikTok-Namen und Namen. Inserate verschwinden nach Ablauf aus der Liste. Du kannst deine Beiträge jederzeit löschen.</li>
</ul>
<h2>4. Wer sieht was?</h2>
<p>Du siehst deine eigenen Daten. Dein Manager sieht die Daten seiner Creator. Die Agenturleitung sieht alle Daten. Andere Creator sehen deine Daten nicht, nur deinen TikTok-Namen mit Platz, wenn du in einer Top-5-Liste stehst. Was du selbst in der Match-Börse oder auf der Erfolge-Wand teilst, sehen alle in der App mit deinem TikTok-Namen.</p>
<h2>5. Rechtsgrundlagen</h2>
<p>Wir verarbeiten deine Daten, um dir die Schulung im Rahmen deiner Zusammenarbeit mit der LIVEdream Agency anzubieten (Art. 6 Abs. 1 lit. b DSGVO). Level-System, Live-Daten aus dem Backstage, Ranglisten, Streak-Anzeige und Umfrage dienen unserem berechtigten Interesse, die Schulung motivierend zu gestalten und zu verbessern (Art. 6 Abs. 1 lit. f DSGVO).</p>
<h2>6. Dienstleister</h2>
<ul>
<li><b>Supabase</b> (Supabase Inc., USA) speichert Datenbank, Login und Dateien. Die Server stehen in Frankfurt am Main (EU). Es besteht ein Vertrag zur Auftragsverarbeitung mit EU-Standardvertragsklauseln.</li>
<li><b>Netlify</b> (Netlify Inc., USA) stellt die Webseite bereit. Beim Aufruf werden technisch nötige Daten wie IP-Adresse und Zeitpunkt verarbeitet. Eine Übermittlung in die USA ist möglich. Sie ist durch EU-Standardvertragsklauseln bzw. das EU-US Data Privacy Framework abgesichert.</li>
<li><b>Login-E-Mails</b> werden über den E-Mail-Dienst WEB.DE (1&amp;1 Mail &amp; Media GmbH, Deutschland) verschickt.</li>
</ul>
<p>Schriften und Programmbibliotheken liegen direkt auf unserem Server. Ausnahme sind Schulungsvideos, die wir über <b>YouTube</b> (Google Ireland Ltd.) im erweiterten Datenschutzmodus einbinden: Beim Anzeigen des Vorschaubilds und beim Abspielen werden technische Daten wie deine IP-Adresse an YouTube übertragen. Wir nutzen keine Werbe- oder Analyse-Cookies und kein Tracking. Links zu TikTok-Videos und zum Merch-Shop und zu unseren Partnern öffnen die Seiten dieser Anbieter. Erst dann gelten deren Datenschutzbestimmungen.</p>
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
/* ---------- Match-Börse + Erfolge-Wand ---------- */
const EMOJIS = ["🔥","👏","😍","💪","🎉"];
const cleanH = h => String(h||"").replace(/^@/,"");
const whoOf = (h,email) => { const m=S.members.find(x=>x.email===email), hh=cleanH(h||m?.handle); return hh ? "@"+hh : (m?.name || "Jemand"); };
const whoLink = (h,email,cls="") => { const m=S.members.find(x=>x.email===email), hh=cleanH(h||m?.handle);
  return hh ? `<a class="${cls}" href="https://www.tiktok.com/@${encodeURIComponent(hh)}" target="_blank" rel="noopener">@${esc(hh)}</a>` : `<span class="${cls}">${esc(whoOf(h,email))}</span>`; };
const WDS = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const mpUntil = p => p.until ? +new Date(p.until) : +new Date(p.live_at)+(p.days?.length?7*DAY:3*36e5);
function nextAt(p){
  const base=new Date(p.live_at); if (!p.days?.length) return base;
  const start=new Date(base); start.setHours(0,0,0,0);
  for (let i=-1;i<=8;i++){ const d=new Date(); d.setDate(d.getDate()+i); d.setHours(base.getHours(),base.getMinutes(),0,0);
    if (d>=start && p.days.includes(isoDow(d)) && +d+3*36e5>Date.now() && +d<=mpUntil(p)) return d; }
  return null;
}
const daysTxt = ds => ds.length===7 ? "Jeden Tag" : ds.length===5 && !ds.includes(6) && !ds.includes(7) ? "Mo bis Fr" : [...ds].sort().map(x=>WDS[x-1]).join(", ");
const openMatches = () => S.mp.filter(p=>mpUntil(p)>Date.now() && nextAt(p)).sort((a,b)=>nextAt(a)-nextAt(b));
const likesOf = id => S.ml.filter(l=>l.post_id===id);
const dayWord = d => { const x=isoDay(d); return x===isoDay(new Date())?"Heute":x===isoDay(new Date(Date.now()+DAY))?"Morgen":fmtDayS(d); };
const agoTxt = d => { const m=Math.round((Date.now()-new Date(d))/6e4); return m<1?"gerade eben":m<60?`vor ${m} Min.`:m<1440?`vor ${Math.round(m/60)} Std.`:`vor ${Math.round(m/1440)} Tg.`; };
function matchDot(){
  if (S.noUpd16) return 0;
  const seen=storeGet("ldb-mseen-"+S.me.email)||0, open=openMatches();
  return open.filter(p=>p.author_email!==S.me.email && +new Date(p.created_at)>seen).length
       + S.ml.filter(l=>l.email!==S.me.email && +new Date(l.created_at)>seen && open.some(p=>p.id===l.post_id && p.author_email===S.me.email)).length;
}
function winDot(){ if (S.noUpd16) return 0; const seen=storeGet("ldb-wseen-"+S.me.email)||0; return S.wins.filter(w=>w.author_email!==S.me.email && +new Date(w.created_at)>seen).length; }
const soonUpd16 = (a,b) => `<div class="stack"><span class="eyebrow">LIVEdream</span><h1>${a} <em>${b}</em></h1><p class="muted">Kommt mit dem nächsten Update.</p></div>`;

function matchView(){
  if (S.noUpd16) return soonUpd16("Match-","Börse");
  if (!S.viewAs) storeSet("ldb-mseen-"+S.me.email, Date.now());
  const list=openMatches(), def=new Date(Date.now()+36e5), now=new Date();
  return `<div class="stack"><span class="eyebrow">Zusammen live</span><h1>Match-<em>Börse</em></h1>
    <p class="muted">Sag Bescheid, wann du live bist und Lust auf ein Match hast. Wer auch Lust hat, tippt „Bin dabei“. Dann folgt euch auf TikTok und legt los.</p></div>
    ${S.mpForm ? `<div class="panel stack">
      <h2>Neues Inserat</h2>
      <div class="two"><label class="f" for="mp-day">Tag<input id="mp-day" type="date" value="${isoDay(def)}" min="${isoDay(now)}" max="${isoDay(new Date(Date.now()+13*DAY))}"></label>
      <label class="f" for="mp-time">Uhrzeit<input id="mp-time" type="time" value="${pad(def.getHours())}:00"></label></div>
      <div class="f"><span>An mehreren Tagen? (optional)</span><div class="mdays">${WDS.map((w,i)=>`<button type="button" class="chip" data-mpday="${i+1}">${w}</button>`).join("")}</div><small class="muted">Wähle die Tage, an denen du zur gleichen Uhrzeit live bist. Das Inserat läuft 1 Woche, danach einfach neu einstellen.</small></div>
      <label class="f" for="mp-rules">Regeln<input id="mp-rules" type="text" maxlength="200" placeholder="z. B. 3 Runden, wer verliert, macht eine Strafe"></label>
      <label class="f" for="mp-note">Noch was? (optional)<input id="mp-note" type="text" maxlength="300" placeholder="z. B. Ich bin neu und freue mich über jede Runde"></label>
      <div class="btns"><button class="btn small" id="mp-add">Veröffentlichen</button><button class="btn ghost small" id="mp-cancel">Abbrechen</button></div></div>`
    : `<button class="btn" id="mp-new">Inserat erstellen</button>`}
    <div class="sec"><span>Wer hat Lust?</span><small>${list.length}</small></div>
    ${list.length ? `<div class="mlist">${list.map(matchCard).join("")}</div>` : `<p class="muted">Gerade gibt es kein Inserat. Mach den Anfang!</p>`}`;
}
function matchCard(p){
  const d=nextAt(p)||new Date(p.live_at), mine=p.author_email===S.me.email, likes=likesOf(p.id), iLike=likes.some(l=>l.email===S.me.email);
  const live=d<=new Date(), canDel=mine || S.me.role==="lead";
  return `<div class="mcard ${mine?"mine":""}">
    <div class="mtop"><span class="mwhen ${live?"live":""}">${live?"Jetzt live":`${dayWord(d)}, ${fmtTime(d)} Uhr`}</span>${whoLink(p.handle,p.author_email,"mwho")}</div>
    ${p.days?.length?`<p class="mrep">🔁 ${daysTxt(p.days)} um ${fmtTime(new Date(p.live_at))} Uhr</p>`:""}
    ${p.rules?`<p class="mrules">${ic("i-sword")}<span>${esc(p.rules)}</span></p>`:""}
    ${p.note?`<p class="mnote">${esc(p.note)}</p>`:""}
    <div class="mact">${mine?`<span class="chip">Dein Inserat</span>`:`<button class="chip mlike ${iLike?"on":""}" data-mlike="${esc(p.id)}">${iLike?"✓ Bin dabei":"Bin dabei"}</button>`}
      ${canDel?`<button class="chip" data-mdel="${esc(p.id)}">${S.confirmDelete==="mp"+p.id?"Wirklich löschen?":"Löschen"}</button>`:""}</div>
    ${likes.length?`<div class="mlikes"><small>Dabei:</small>${likes.map(l=>whoLink(l.handle,l.email,"chip")).join("")}</div>`:""}
  </div>`;
}
async function mpAdd(){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const day=$("#mp-day").value, tm=$("#mp-time").value, rules=$("#mp-rules").value.trim(), note=$("#mp-note").value.trim();
  if (!day || !tm) return toast("Bitte Tag und Uhrzeit wählen.");
  const at=new Date(`${day}T${tm}`);
  if (isNaN(at) || +at < Date.now()-36e5) return toast("Dieser Zeitpunkt liegt in der Vergangenheit.");
  if (+at > Date.now()+14*DAY) return toast("Bitte höchstens 2 Wochen im Voraus.");
  if (!rules) return toast("Schreib kurz deine Regeln dazu.");
  const days=[...document.querySelectorAll("[data-mpday].on")].map(b=>+b.dataset.mpday);
  $("#mp-add").disabled=true;
  const r=await sb.from("match_posts").insert({ author_email:S.me.email, handle:S.me.handle||null, name:S.me.name, live_at:at.toISOString(), days:days.length?days:null, until:new Date(+at+(days.length?7*DAY:3*36e5)).toISOString(), rules, note:note||null });
  if (r.error){ $("#mp-add").disabled=false; return /3 offene/.test(r.error.message)?toast("Du hast schon 3 offene Inserate."):fail(r.error); }
  S.mpForm=false; await refresh(); render(true); toast("Inserat ist online.");
}
async function mpLike(id){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const on=likesOf(id).some(l=>l.email===S.me.email);
  const r = on ? await sb.from("match_likes").delete().eq("post_id",id).eq("email",S.me.email)
               : await sb.from("match_likes").insert({ post_id:id, email:S.me.email, handle:S.me.handle||null });
  if (r.error) return fail(r.error);
  await refresh(); render(true); if (!on) toast("Super! Folge der Person auf TikTok und schreib ihr.");
}
async function mpDel(id){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (S.confirmDelete!=="mp"+id){ S.confirmDelete="mp"+id; return render(true); }
  S.confirmDelete=null; const r=await sb.from("match_posts").delete().eq("id",id); if (r.error) return fail(r.error);
  await refresh(); render(true); toast("Inserat gelöscht.");
}

function winsView(){
  if (S.noUpd16) return soonUpd16("Erfolge-","Wand");
  if (!S.viewAs) storeSet("ldb-wseen-"+S.me.email, Date.now());
  const ws=[...S.wins].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return `<div class="stack"><span class="eyebrow">Gemeinsam feiern</span><h1>Erfolge-<em>Wand</em></h1>
    <p class="muted">Neuer Rekord, erstes Geschenk, Top 5 im Match? Teil deinen Erfolg mit einem Screenshot und feier die anderen mit.</p></div>
    ${S.wForm ? `<div class="panel stack">
      <h2>Erfolg teilen</h2>
      <label class="f" for="w-text">Was hast du geschafft?<textarea id="w-text" maxlength="300" placeholder="z. B. Heute zum ersten Mal 10.000 Diamanten in einem Live!"></textarea></label>
      <label class="f" for="w-img">Screenshot (optional)<input id="w-img" type="file" accept="image/*"></label>
      <div class="btns"><button class="btn small" id="w-add">Teilen</button><button class="btn ghost small" id="w-cancel">Abbrechen</button></div></div>`
    : `<button class="btn" id="w-new">Erfolg teilen</button>`}
    ${ws.length ? `<div class="wlist">${ws.map(winCard).join("")}</div>` : `<p class="muted">Noch keine Erfolge. Sei die erste Person!</p>`}`;
}
function winCard(w){
  const rs=S.wr.filter(r=>r.win_id===w.id), canDel=w.author_email===S.me.email || S.me.role==="lead";
  return `<div class="wcard">
    <div class="wtop">${whoLink(w.handle,w.author_email,"mwho")}<small>${agoTxt(w.created_at)}</small></div>
    <p class="wtext">${esc(w.body)}</p>
    ${w.path?`<img class="wimg" data-win="${esc(w.path)}" alt="Screenshot von ${esc(whoOf(w.handle,w.author_email))}">`:""}
    <div class="wre">${EMOJIS.map(e=>{ const n=rs.filter(r=>r.emoji===e).length, me=rs.some(r=>r.emoji===e && r.email===S.me.email);
      return `<button class="wemo ${me?"on":""}" data-wreact="${esc(w.id)}" data-emo="${e}" aria-label="${e} ${n}">${e}${n?`<b>${n}</b>`:""}</button>`; }).join("")}
      ${canDel?`<button class="chip wdel" data-wdel="${esc(w.id)}">${S.confirmDelete==="wi"+w.id?"Wirklich löschen?":"Löschen"}</button>`:""}</div>
  </div>`;
}
async function shrinkShot(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error("Bild konnte nicht gelesen werden.")); i.src=url; });
    const sc=Math.min(1, 1080/Math.max(img.naturalWidth, img.naturalHeight)), w=Math.round(img.naturalWidth*sc), h=Math.round(img.naturalHeight*sc);
    const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
    for (const q of [.82,.7,.55,.4]){ const b=await new Promise(r=>c.toBlob(r,"image/jpeg",q)); if (b && b.size<580000) return b; }
    throw new Error("Bild ist zu groß.");
  } finally { URL.revokeObjectURL(url); }
}
async function wAdd(){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const body=$("#w-text").value.trim(), f=$("#w-img").files[0];
  if (!body) return toast("Schreib kurz, was du geschafft hast.");
  $("#w-add").disabled=true;
  try{
    let path=null;
    if (f){ toast("Bild wird hochgeladen …"); const blob=await shrinkShot(f); path=`${S.me.email}/${Date.now()}.jpg`;
      const u=await sb.storage.from("erfolge").upload(path,blob,{ contentType:"image/jpeg" }); if (u.error) throw u.error; }
    const r=await sb.from("wins").insert({ author_email:S.me.email, handle:S.me.handle||null, name:S.me.name, path, body });
    if (r.error){ if (path) sb.storage.from("erfolge").remove([path]).catch(()=>{}); throw r.error; }
    S.wForm=false; await refresh(); render(true); toast("Geteilt! 🎉");
  } catch(e){ $("#w-add") && ($("#w-add").disabled=false); /5 Erfolge/.test(e?.message||"")?toast("Heute hast du schon 5 Erfolge geteilt."):fail(e); }
}
async function wReact(id, emo){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  const on=S.wr.some(r=>r.win_id===id && r.emoji===emo && r.email===S.me.email);
  const r = on ? await sb.from("win_reacts").delete().eq("win_id",id).eq("email",S.me.email).eq("emoji",emo)
               : await sb.from("win_reacts").insert({ win_id:id, email:S.me.email, emoji:emo });
  if (r.error) return fail(r.error);
  await refresh(); render(true);
}
async function wDel(id){
  if (S.viewAs) return toast("In der Vorschau wird nichts gespeichert.");
  if (S.confirmDelete!=="wi"+id){ S.confirmDelete="wi"+id; return render(true); }
  S.confirmDelete=null; const w=S.wins.find(x=>x.id===id);
  const r=await sb.from("wins").delete().eq("id",id); if (r.error) return fail(r.error);
  if (w?.path) sb.storage.from("erfolge").remove([w.path]).catch(()=>{});
  await refresh(); render(true); toast("Gelöscht.");
}
async function hydrateWins(){
  const imgs=[...document.querySelectorAll("img[data-win]:not([src])")]; if (!imgs.length) return;
  const need=[...new Set(imgs.map(i=>i.dataset.win))].filter(p=>!AVURL["w:"+p]);
  if (need.length){ const { data }=await sb.storage.from("erfolge").createSignedUrls(need, 6*3600); (data||[]).forEach(d=>{ if (d.signedUrl) AVURL["w:"+d.path]=d.signedUrl; }); }
  imgs.forEach(i=>{ const u=AVURL["w:"+i.dataset.win]; if (u) i.src=u; });
}

document.addEventListener("click", async e => {
  if (e.target.closest("#cert-png")) { dl(S._cert.url, S._cert.base+".png"); return; }
  if (e.target.closest("#cert-pdf")) { certPdf(); return; }
  if (e.target.closest("#win")) { $("#win").classList.remove("show","keep"); return; }
  if (e.target.id==="sheet" || e.target.closest("#sheet-x")) { closeSheet(); return; }
  const t = e.target.closest("button,a"); if (!t) return;
  if (t.id==="legal-back"){ history.replaceState(null,"",location.pathname+location.search); return showLegal(); }
  if (t.id==="send-link") return sendLink();
  if (t.id==="verify") return verifyCode();
  if (t.id==="restart") return loginView();
  if (t.id==="register") return register();
  if (t.id==="to-register"){ S._loginMode="register"; return loginView($("#email")?.value||""); }
  if (t.id==="to-login"){ S._loginMode="login"; return loginView($("#email")?.value||""); }
  if (t.id==="logout"){ await sb.auth.signOut({ scope:"local" }); Object.assign(S,{me:null,real:null,viewAs:"",tab:null,creator:null,openArea:null,ringShown:false,localProg:{}}); return loginView(); }
  if (t.dataset.tab){ closeSheet(); S.qz=null; S.tab=t.dataset.tab; if (t.dataset.learn) S.learn=t.dataset.learn; S.creator=null; S.pend=null; S.editMember=null; return render(); }
  if (t.dataset.area){
    const st=t.dataset.state;
    if (st==="lock") return toast("Gib zuerst das Thema davor ab.");
    if (st==="time") return toast("Diese Woche öffnet am Montag um 0 Uhr.");
    if (S.me.role==="creator"){ S.tab="lernen"; S.learn="bootcamp"; }
    S.openArea=+t.dataset.area; return render();
  }
  if (t.id==="cert") return certificate();
  if (t.id==="intro-go") return introFinish();
  if (t.id==="intro-again"){ S.showIntro=true; return render(); }
  if (t.id==="qsend") return sendQuestion();
  if (t.id==="kk-fab" || t.id==="kk-open") return openKK();
  if (t.dataset.qz){ const r=S.me.role==="creator" && qzRes(S.me.email,t.dataset.qz); if (r){ const q=QZ().find(x=>x.id===t.dataset.qz); return sheet(quizResult(q, r.result, false, r.scores?._second)); } return quizStart(t.dataset.qz); }
  if (t.dataset.qzAgain){ closeSheet(); return quizStart(t.dataset.qzAgain); }
  if (t.dataset.lvsheet) return openLvSheet(t.dataset.lvsheet);
  if (t.dataset.gset) return guideSet(t.dataset.who, t.dataset.gset, t.dataset.gst);
  if (t.id==="inv-open" || t.id==="inv-open2") return openInvite();
  if (t.id==="an-new" || t.id==="an-new2") return openAniForm();
  if (t.id==="an-send") return aniSend();
  if (t.id==="an-wa-save") return aniWaSave();
  if (t.dataset.remhide){ const k=t.dataset.remkey, l=storeGet(k)||[]; l.push(t.dataset.remhide); storeSet(k,l); return render(true); }
  if (t.id==="inv-share") return shareInvite();
  if (t.id==="inv-copy") return copyInvite();
  if (t.id==="ref-send") return reportRef();
  if (t.dataset.refok) return refDecide(t.dataset.refok,"ok");
  if (t.dataset.refno) return refDecide(t.dataset.refno,"nein");
  if (t.id==="rf-add") return refAdd();
  if (t.id==="tt-add") return addTikTok();
  if (t.id==="share-app") return openShare();
  if (t.id==="sh-copy") return copyTxt($("#sh-text").value, "Text kopiert ✓");
  if (t.id==="sh-link") return copyTxt(APP_URL(), "Link kopiert ✓");
  if (t.id==="sh-wa"){ const u="https://wa.me/?text="+encodeURIComponent($("#sh-text").value); window.open(u,"_blank","noopener") || (location.href=u); return; }
  if (t.id==="sh-native"){ navigator.share({ title:"LIVEdream Academy", text:$("#sh-text").value }).catch(()=>{}); return; }
  if (t.dataset.partner) return openPartner(t.dataset.partner);
  if (t.id==="pt-save") return savePartner(t.dataset.pk);
  if (t.dataset.ttdel) return ttDelete(t.dataset.ttdel);
  if (t.id==="mp-new"){ S.mpForm=true; return render(true); }
  if (t.id==="mp-cancel"){ S.mpForm=false; return render(true); }
  if (t.id==="mp-add") return mpAdd();
  if (t.dataset.mpday){ t.classList.toggle("on"); return; }
  if (t.dataset.mlike) return mpLike(t.dataset.mlike);
  if (t.dataset.mdel) return mpDel(t.dataset.mdel);
  if (t.id==="w-new"){ S.wForm=true; return render(true); }
  if (t.id==="w-cancel"){ S.wForm=false; return render(true); }
  if (t.id==="w-add") return wAdd();
  if (t.dataset.wreact) return wReact(t.dataset.wreact, t.dataset.emo);
  if (t.dataset.wdel) return wDel(t.dataset.wdel);
  if (t.id==="av-add") return addRule();
  if (t.id==="sl-book") return bookSlot();
  if (t.dataset.tnav){ const m=tMonth(); S.tMonth=new Date(m.getFullYear(), m.getMonth()+ +t.dataset.tnav, 1); return render(true); }
  if (t.dataset.tday){ if (t.dataset.tab2){ S.tab=t.dataset.tab2; S.creator=null; } S.tDay = t.dataset.tday; const d=new Date(t.dataset.tday+"T00:00"); S.tMonth=new Date(d.getFullYear(), d.getMonth(), 1); render(true); return $(".tdayv")?.scrollIntoView({ behavior:"smooth", block:"nearest" }); }
  if (t.dataset.tbook) return openBook(t.dataset.tbook);
  if (t.dataset.bkcancel) return cancelMine(t.dataset.bkcancel);
  if (t.dataset.avdel) return delRule(t.dataset.avdel);
  if (t.dataset.avoff) return toggleOff(t.dataset.avoff);
  if (t.dataset.bkfree) return freeBooking(t.dataset.bkfree);
  if (t.dataset.tt){ award("extra", t.dataset.tt); return; }
  if (t.dataset.qzshow){ const q=QZ().find(x=>x.id===t.dataset.qzshow), r=qzRes(t.dataset.who||S.me.email, q?.id); if (q&&r) return sheet(quizResult(q, r.result, false, r.scores?._second)); return; }
  if (t.dataset.learn){ S.learn=t.dataset.learn; S.qz=null; return render(); }
  if (t.id==="rw-open") return sheet(`<div class="stack">${rewardsBlock(S.me.email)}</div>`);
  if (t.dataset.qza) return quizAnswer(+t.dataset.qza);
  if (t.id==="qz-quit"){ S.qz=null; return render(); }
  if (t.id==="hook-open") return openHook();
  if (t.id==="hook-copy"){ navigator.clipboard?.writeText(t.dataset.txt).then(()=>toast("Kopiert. Viel Erfolg mit deinem Video!"),()=>toast("Kopieren ging nicht, bitte markieren.")); return; }
  if (t.id==="imp-open") return openImpuls();
  if (t.dataset.iq) return answerImpuls(+t.dataset.iq, +t.dataset.ia);
  if (t.id==="gl-save") return goalProgress();
  if (t.dataset.goalnew){ S.goalOpen=true; return render(true); }
  if (t.id==="g-cancel"){ S.goalOpen=false; return render(true); }
  if (t.dataset.goalsave) return goalSave(t.dataset.goalsave);
  if (t.dataset.goaldone) return goalSet(t.dataset.goaldone,{ done:true });
  if (t.dataset.goalundo) return goalSet(t.dataset.goalundo,{ done:false });
  if (t.dataset.goaldel) return goalDelete(t.dataset.goaldel);
  if (t.id==="bs-save") return backstageSave();
  if (t.id==="bs-cancel"){ S.bsPrev=null; return render(true); }
  if (t.dataset.kk){ S.kkDraft=$("#qbox")?.value||""; S.kkKind=t.dataset.kk; return openKK(); }
  if (t.dataset.cal){ return openCal(t.dataset.cal); }
  if (t.dataset.calnav){ const m=calMonth(); S.calMonth=new Date(m.getFullYear(), m.getMonth()+ +t.dataset.calnav, 1); return render(true); }
  if (t.dataset.caledit){ closeSheet(); S.calEdit=t.dataset.caledit; S.calDraft=null; render(true); $(".calform")?.scrollIntoView({behavior:"smooth",block:"start"}); return; }
  if (t.dataset.calok){ t.disabled=true; return calApprove(t.dataset.calok); }
  if (t.id==="cal-new"){ S.calOpen=true; S.calEdit=null; S.calDraft=null; return render(true); }
  if (t.id==="cf-cancel"){ S.calOpen=false; S.calEdit=null; S.calDraft=null; S.confirmDelete=null; return render(true); }
  if (t.id==="cf-parse"){ const p=parseLark($("#cf-paste").value); if (!p.body) return toast("Bitte zuerst die Nachricht einfügen.");
    const keep=calRead(); S.calDraft={ ...keep, ...Object.fromEntries(Object.entries(p).filter(([,v])=>v)) }; if (!p.ends && p.starts) S.calDraft.ends=p.starts; render(true);
    toast(p.starts?"Erkannt. Bitte kurz prüfen und speichern.":"Titel übernommen. Daten bitte selbst eintragen."); return; }
  if (t.id==="cf-save") return calSave();
  if (t.id==="cf-saveok") return calSave(true);
  if (t.id==="cf-del") return calDelete();
  if (t.id==="t-new"){ S.taskOpen=true; S.taskEdit=null; return render(true); }
  if (t.id==="t-cancel"){ S.taskOpen=false; S.taskEdit=null; return render(true); }
  if (t.id==="t-save") return taskSave();
  if (t.dataset.tedit){ S.taskEdit=t.dataset.tedit; render(true); return; }
  if (t.dataset.tdone) return taskToggle(t.dataset.tdone);
  if (t.dataset.tdel) return taskDelete(t.dataset.tdel);
  if (t.dataset.tfilter){ S.taskFilter=t.dataset.tfilter; return render(true); }
  if (t.dataset.star){ keepSurveyDraft(); S.survDraft.rating=+t.dataset.star; return render(true); }
  if (t.id==="sv-send") return sendSurvey();
  if (t.dataset.qpub) return answerQ(t.dataset.qpub, true);
  if (t.dataset.qsave) return answerQ(t.dataset.qsave, null);
  if (t.dataset.qdel) return delQ(t.dataset.qdel);
  if (t.id==="home"){ S.openArea=null; return render(); }
  if (t.dataset.quiz) return answerQuiz(+t.dataset.quiz, +t.dataset.j);
  if (t.dataset.seen) return markStep(+t.dataset.seen,"video_at");
  if (t.dataset.yt){ const x=S.extras.find(y=>y.id===t.dataset.ytx);
    sheet(`<h2>${esc(x?.title||"Video")}</h2><div class="yt169"><iframe src="https://www.youtube-nocookie.com/embed/${esc(t.dataset.yt)}?rel=0&modestbranding=1&playsinline=1" title="${esc(x?.title||"Video")}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>${x?.note?`<p class="muted">${esc(x.note)}</p>`:""}${x?.path && x.path!=="youtube"?`<a class="btn ghost" data-handout="${esc(x.path)}" target="_blank" rel="noopener">Präsentation öffnen</a>`:""}`);
    hydrate().catch(console.error); award("extra", t.dataset.ytx);
    if (!S.viewAs){ const k="ldb-extras-"+S.me.email, seen=storeGet(k)||[]; if(!seen.includes(t.dataset.ytx)){ seen.push(t.dataset.ytx); storeSet(k,seen); } } return; }
  if (t.dataset.extra){ if (!t.href) { e.preventDefault(); toast("Lädt noch, bitte gleich nochmal tippen."); return; }
    award("extra", t.dataset.extra);
    if (!S.viewAs){ const k="ldb-extras-"+S.me.email, seen=storeGet(k)||[]; if(!seen.includes(t.dataset.extra)){ seen.push(t.dataset.extra); storeSet(k,seen); setTimeout(()=>render(true),400); } } return; }
  if (t.dataset.handout && t.dataset.n){ if (!t.href) { e.preventDefault(); toast("Handout lädt noch, bitte gleich nochmal tippen."); return; } setTimeout(()=>markStep(+t.dataset.n,"handout_at"),300); return; }
  if (t.dataset.unpend){ const n=+t.dataset.unpend; (S.pending[n]||[]).splice(+t.dataset.i,1); $("#pend").innerHTML=pendList(n); return; }
  if (t.id==="submit") return submitArea(+t.dataset.n);
  if (t.dataset.creator){ S.creator=t.dataset.creator; return render(); }
  if (t.id==="back"){ S.creator=null; S.pend=null; return render(); }
  if (t.dataset.pend){ S.pend=t.dataset.pend; S.creator=null; return render(); }
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
  if (e.target.dataset.vcover) return setVideoCover(e.target.dataset.vcover, e.target.files[0]);
  if (e.target.dataset.ttcover) return ttSetCover(e.target.dataset.ttcover, e.target.files[0]);
  if (e.target.dataset.up){
    const n=+e.target.dataset.up, fs=[...e.target.files], big=fs.filter(f=>f.size>MAX_FILE);
    if (big.length) toast(`${big.map(f=>f.name).join(", ")} ist größer als 50 MB. Bitte kürzer aufnehmen.`);
    S.pending[n]=[...(S.pending[n]||[]), ...fs.filter(f=>f.size<=MAX_FILE)];
    e.target.value=""; $("#pend").innerHTML=pendList(n);
  }
  if (e.target.id==="bs-file") return backstageRead();
  if (e.target.dataset.gnote) return guideNote(e.target.dataset.who, e.target.dataset.gnote, e.target.value);
  if (e.target.dataset.refgun) return refGun(e.target.dataset.refgun, e.target.checked);
  if (e.target.id==="av-file"){ const f=e.target.files[0]; e.target.value=""; return avatarUpload(f); }
  if (e.target.id==="viewas"){ S.viewAs=e.target.value; S.quiz={}; S.creator=null; S.pend=null; S.openArea=null; S.editMember=null; S.ringShown=false; S.localProg={}; applyView(); S.tab = S.me.role==="creator"?"start":"uebersicht"; return render(); }
  if (e.target.id==="ro-file"){ const f=e.target.files[0]; if(f) f.text().then(tx=>{ $("#ro-text").value=tx; toast("Datei eingelesen. Jetzt „Vorschau“ tippen."); }); return; }
  if (e.target.dataset.snap) return uploadSnap(e.target.dataset.snap, e.target.files[0]);
  if (e.target.id==="cal-showcamp"){ S.calShowCamp=e.target.checked; return render(true); }
  if (e.target.id==="ae-n"){ S.editArea=+e.target.value; render(true); }
});
document.addEventListener("input", e => { if (e.target.id==="note"){ const c=$("#cnt"); if(c) c.textContent=`${e.target.value.length} / 1000`; } });
document.addEventListener("keydown", e => {
  if (e.key==="Escape"){ $("#win").classList.remove("show"); closeSheet(); }
  if (e.key!=="Enter") return;
  if (e.target.id==="email") (S._loginMode==="register" ? register() : sendLink());
  if (e.target.id==="code") verifyCode();
  if (e.target.id==="an-wa") aniWaSave();
});

showLegal();
boot();
})();
