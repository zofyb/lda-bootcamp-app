/* LIVEdream Creator Bootcamp – App (ohne Build-Schritt, läuft als statische Seite) */
(() => {
"use strict";
const CFG = window.BOOTCAMP_CONFIG || {};
const MAX_FILE = 50 * 1024 * 1024;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const view = $("#view"), who = $("#who"), tabsEl = $("#tabs");

let sb = null;
const S = { session:null, me:null, areas:[], members:[], subs:[], tab:null, openArea:null, creator:null, pending:{}, editMember:null, editArea:1, confirmDelete:null, busy:false, real:null, viewAs:"" };

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true,3200); }
function fail(e){ console.error(e); toast("Fehler: " + (e?.message || e)); }

/* ---------- Hilfen ---------- */
const lc = s => String(s||"").trim().toLowerCase();
const member = email => S.members.find(m => m.email === email);
const label = m => m ? (m.handle ? "@" + m.handle.replace(/^@/,"") : m.name) : "";
const subOf = (email, n) => S.subs.find(s => s.creator_email === email && s.area === n);
const total = email => S.subs.filter(s => s.creator_email === email).reduce((a,s)=>a+(s.points||0),0);
const fmtDate = d => { if(!d) return ""; const x=new Date(d+"T12:00:00"); return ["So.","Mo.","Di.","Mi.","Do.","Fr.","Sa."][x.getDay()]+" "+x.getDate()+"."+(x.getMonth()+1)+"."; };
const fmtAgo = ts => { const h=Math.round((Date.now()-new Date(ts))/36e5); return h<1?"gerade eben":h<24?`vor ${h} Std.`:`vor ${Math.round(h/24)} Tg.`; };
const weekLine = a => `Woche ${a.week}` + (a.deadline ? ` · bis ${fmtDate(a.deadline)}` : "");
const list = x => Array.isArray(x) ? x : [];
const creators = () => S.members.filter(m => m.role === "creator");
const myCreators = () => S.me.role === "lead" ? creators() : creators().filter(c => c.manager_email === S.me.email);

function dots(email){
  return '<div class="dots">' + S.areas.map(a => { const s=subOf(email,a.n);
    const c = !s ? "" : s.points==null ? "w" : "p"+s.points; return `<i class="${c}"></i>`; }).join("") + "</div>";
}
function areaState(n){
  const s = subOf(S.me.email, n);
  if (s && s.points != null) return "ok";
  if (s) return "wait";
  if (S.me.preview || n === S.areas[0]?.n || subOf(S.me.email, n-1)) return "open";
  return "lock";
}
function videoEmbed(url){
  if (!url) return `<div class="video empty">Das Lehrvideo kommt bald.</div>`;
  const m = url.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);
  if (m) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1" title="Lehrvideo" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  if (!/^https?:\/\//.test(url)) return `<div class="video"><video data-video="${esc(url)}" controls playsinline preload="metadata"></video></div>`;
  if (/^https:\/\//.test(url)) return `<div class="video"><video src="${esc(url)}" controls playsinline preload="metadata"></video></div>`;
  return `<div class="video empty">Video-Link ungültig.</div>`;
}
function fileLinks(files){
  return `<div class="files">${list(files).map(f=>`<a data-path="${esc(f.path)}" target="_blank" rel="noopener">${esc(f.name)}</a>`).join("") || '<span>Keine Dateien</span>'}</div>`;
}
async function hydrateLinks(){
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

/* ---------- Start ---------- */
async function boot(){
  if (!window.supabase || !CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes("DEIN-PROJEKT")) {
    view.innerHTML = `<h2>Fast fertig</h2><p class="lead-text">In <b>config.js</b> fehlen noch die Supabase-Adresse und der öffentliche Schlüssel.</p>`; return;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth:{ persistSession:true, detectSessionInUrl:true, flowType:"implicit" } });
  sb.auth.onAuthStateChange((_e, session) => { const changed = session?.user?.email !== S.session?.user?.email; S.session=session; if (changed) load(); });
  const { data } = await sb.auth.getSession(); S.session = data.session; load();
}

async function load(){
  if (!S.session) return loginView();
  const email = lc(S.session.user.email);
  view.innerHTML = `<p class="meta">Lädt …</p>`;
  try {
    const { data: me, error } = await sb.from("members").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    if (!me) { who.innerHTML = `${esc(email)}<br><button id="logout">Abmelden</button>`; view.innerHTML = `<h2>Kein Zugang</h2><p class="lead-text">Diese E-Mail-Adresse steht nicht auf der Teilnehmerliste. Bitte melde dich bei deinem Manager.</p>`; return; }
    S.real = me; S.me = me; S.viewAs = ""; await refresh();
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
  S.areas=a.data; S.members=m.data; S.subs=s.data;
}

/* ---------- Login ---------- */
function loginView(email="", sent=false, err=""){
  tabsEl.hidden = true; who.innerHTML = "";
  view.innerHTML = `<div class="login">
    <h2>${sent ? "Schau in dein Postfach" : "Willkommen im Bootcamp"}</h2>
    <p class="lead-text">${sent ? `Wir haben dir eine E-Mail an <b>${esc(email)}</b> geschickt. Tippe auf den Link darin oder gib den Code hier ein.<br><br><b style="color:var(--gold);font-weight:500">Keine Mail da?</b> Schau bitte im Spam-Ordner nach und markiere die Mail als „Kein Spam“. Dann kommt sie beim nächsten Mal normal an.` : "Melde dich mit der E-Mail-Adresse an, die du deinem Manager gegeben hast. Du bekommst einen Anmelde-Link, ganz ohne Passwort."}</p>
    ${sent ? `<label class="f" for="code">Code aus der E-Mail<input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label>
      <button class="btn" id="verify">Anmelden</button><button class="back" id="restart">Andere E-Mail-Adresse</button>`
    : `<label class="f" for="email">E-Mail-Adresse<input id="email" type="email" autocomplete="email" value="${esc(email)}"></label>
      <button class="btn" id="send-link">Anmelde-Link schicken</button>`}
    ${err ? `<p class="err">${esc(err)}</p>` : ""}
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
  lead:    [["uebersicht","Übersicht"],["bewerten","Zu bewerten"],["personen","Teilnehmer"],["themenedit","Themen"]]
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
  const ms=S.members.filter(m=>m.role==="manager"||(m.role==="lead"&&creators().some(c=>c.manager_email===m.email)&&m.email!==S.real.email));
  const opt=(v,l)=>`<option value="${esc(v)}" ${S.viewAs===v?"selected":""}>${esc(l)}</option>`;
  return `<label class="f viewas" for="viewas">Ansicht<select id="viewas">
    ${opt("","Agenturleitung (alles)")}
    <optgroup label="Manager">${ms.map(m=>opt(m.email,"Manager: "+m.name)).join("")}</optgroup>
    <optgroup label="Creator">${opt("__preview","Creator: Vorschau (alle Themen offen)")}${creators().map(c=>opt(c.email,"Creator: "+label(c))).join("")}</optgroup>
  </select></label>${S.viewAs?`<p class="viewnote">Du siehst die App gerade so wie ${S.viewAs==="__preview"?"ein Creator":esc(S.me.role==="creator"?label(S.me):S.me.name)}.${S.me.role==="creator"?" Abgeben ist in dieser Ansicht gesperrt.":""}</p>`:""}`;
}
function render(){
  applyView();
  const me=S.me, mgr = member(me.manager_email);
  $("#switch").innerHTML = switcher();
  who.innerHTML = `${esc(S.real.name)}<br>${me.role==="creator" && mgr ? "Manager: "+esc(mgr.name)+"<br>" : ""}<button id="logout">Abmelden</button>`;
  const t = TABS[me.role];
  tabsEl.hidden = t.length < 2;
  tabsEl.innerHTML = t.map(([k,l]) => `<button data-tab="${k}" aria-pressed="${S.tab===k}">${l}</button>`).join("");
  document.querySelector(".wrap").classList.toggle("wide", me.role !== "creator");
  if (S.creator) view.innerHTML = creatorDetail(S.creator);
  else view.innerHTML = ({ themen:creatorHome, bewerten:pendingView, creator:managerList, uebersicht:leadOverview, personen:peopleView, themenedit:areaEditor }[S.tab] || creatorHome)();
  hydrateLinks().catch(console.error);
}

/* ---------- Creator ---------- */
function creatorHome(){
  const e=S.me.email, t=total(e), done=S.subs.filter(s=>s.creator_email===e).length;
  let h = `<div class="score"><div class="stat"><b>${t}<span> / ${S.areas.length*2}</span></b><small>Punkte · ab 10 bestanden</small><div class="bar"><i style="width:${Math.min(100,t/16*100)}%"></i><em></em></div></div>
    <div class="stat"><b>${done}<span> / ${S.areas.length}</span></b><small>Themen abgegeben</small></div></div>
    <h2>Deine Themen</h2><div class="areas">`;
  for (const a of S.areas){
    const st=areaState(a.n), s=subOf(e,a.n);
    const lab={ok:`${s?.points} ${s?.points===1?"Punkt":"Punkte"}`,wait:"Wird geprüft",open:"Jetzt dran",lock:"Gesperrt"}[st];
    h += `<button class="area ${st==="lock"?"locked":""} ${st==="open"?"current":""}" data-area="${a.n}" ${st==="lock"?'aria-disabled="true"':""} aria-expanded="${S.openArea===a.n}">
      <span class="n">${a.n}</span><span><b>${esc(a.title)}</b><small>${esc(weekLine(a))}</small></span><span class="pill ${st}">${lab}</span></button>`;
    if (S.openArea===a.n && st!=="lock") h += areaDetail(a, st, s);
  }
  return h + `</div>` + (done===S.areas.length && t>=10 ? `<p class="feedback">Glückwunsch, du hast das Bootcamp bestanden.</p>` : "");
}
function taskBlock(a){
  return `${a.intro?`<p class="lead-text">${esc(a.intro)}</p>`:""}
    ${list(a.pre).length?`<h3>Zuerst</h3><ul class="task">${list(a.pre).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
    <div class="pts"><div><b>1 Punkt</b><ul>${list(a.p1).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><b>2 Punkte</b><p class="meta" style="margin-bottom:6px">zusätzlich</p><ul>${list(a.p2).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div>
    ${a.proof?`<p class="meta"><b style="color:var(--fg);font-weight:500">Nachweis:</b> ${esc(a.proof)}</p>`:""}`;
}
function areaDetail(a, st, s){
  const pend = S.pending[a.n] || [];
  let h = `<div class="detail">${videoEmbed(a.video_url)}
    ${a.handout_path?`<a data-handout="${esc(a.handout_path)}" target="_blank" rel="noopener">Handout öffnen (PDF)</a>`:""}
    <h3>Deine Aufgabe</h3>${taskBlock(a)}`;
  if (S.viewAs && S.me.role==="creator"){
    h += s ? `<h3>${s.points!=null?`Bewertet: ${s.points} von 2 Punkten`:`Abgegeben ${fmtAgo(s.submitted_at)}`}</h3>${fileLinks(s.files)}` : `<p class="meta">Hier lädt der Creator seinen Nachweis hoch und gibt ab.</p>`;
  } else if (st==="open" || st==="wait"){
    h += `${s?`<h3>Abgegeben ${fmtAgo(s.submitted_at)}</h3>${fileLinks(s.files)}${s.note?`<p class="feedback">${esc(s.note)}</p>`:""}<p class="meta">Dein Manager vergibt die Punkte. Bis dahin kannst du noch Dateien ergänzen.</p>`:""}
      <label class="drop" for="up-${a.n}"><strong>${s?"Weitere Datei hinzufügen":"Nachweis hochladen"}</strong>Screenshot oder Bildschirmaufnahme, je max. 50 MB<input id="up-${a.n}" data-up="${a.n}" type="file" accept="image/*,video/*,application/pdf" multiple></label>
      ${pend.length?`<div class="files">${pend.map(f=>`<span>${esc(f.name)}</span>`).join("")}</div>`:""}
      ${s?"":`<label class="f" for="note-${a.n}">Nachricht an deinen Manager (optional, z. B. Video-Links)<textarea id="note-${a.n}"></textarea></label>`}
      <button class="btn" data-submit="${a.n}" ${pend.length && !S.busy?"":"disabled"}>${S.busy?"Wird hochgeladen …":s?"Dateien ergänzen":"Abgeben und nächstes Thema freischalten"}</button>`;
  } else {
    h += `<h3>Bewertet: ${s.points} von 2 Punkten</h3>${s.feedback?`<p class="feedback">${esc(s.feedback)}</p>`:""}${fileLinks(s.files)}`;
  }
  return h + `</div>`;
}
async function submitArea(n){
  const files = S.pending[n] || []; if (!files.length) return;
  const e=S.me.email, existing=subOf(e,n), note=$(`#note-${n}`)?.value?.trim() || null;
  S.busy=true; render();
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
      ? await sb.from("submissions").update({ files:[...list(existing.files), ...up] }).eq("id", existing.id)
      : await sb.from("submissions").insert({ creator_email:e, area:n, note, files:up });
    if (res.error) throw res.error;
    S.pending[n]=[]; await refresh();
    if (!existing){ const nx=S.areas.find(a=>a.n===n+1); S.openArea = nx ? nx.n : null; toast(nx ? `Abgegeben. Thema ${nx.n} ist jetzt frei.` : "Abgegeben. Das war das letzte Thema."); }
    else toast("Dateien ergänzt.");
  } catch(err){ fail(err); }
  S.busy=false; render();
}

/* ---------- Manager / Geschäftsführung ---------- */
function rateBlock(s){
  return `<div class="rate" role="group" aria-label="Punkte">${[0,1,2].map(p=>`<button data-rate="${s.id}" data-p="${p}" aria-pressed="${s.points===p}">${p} ${p===1?"Punkt":"Punkte"}</button>`).join("")}</div>
    <label class="f" for="fb-${s.id}">Rückmeldung an den Creator (optional)<textarea id="fb-${s.id}">${esc(s.feedback||"")}</textarea></label>`;
}
function subCard(s, showCreator=true){
  const a=S.areas.find(x=>x.n===s.area), c=member(s.creator_email);
  return `<div class="row"><div class="head"><b>${showCreator?esc(label(c))+" · ":""}${a?a.n+" "+esc(a.title):""}</b><span class="pill ${s.points==null?"wait":"ok"}">${s.points==null?"Offen":s.points+" P"}</span></div>
    <div class="meta">Abgegeben ${fmtAgo(s.submitted_at)}${s.rated_at?` · bewertet von ${esc(member(s.rated_by)?.name||s.rated_by)}`:""}</div>
    ${s.note?`<p class="feedback">${esc(s.note)}</p>`:""}${fileLinks(s.files)}${rateBlock(s)}</div>`;
}
function pendingView(){
  const mine = new Set(myCreators().map(c=>c.email));
  const open = S.subs.filter(s=>s.points==null && mine.has(s.creator_email)).sort((a,b)=>new Date(a.submitted_at)-new Date(b.submitted_at));
  return `<h2>Zu bewerten</h2>${open.length ? `<div class="list">${open.map(s=>subCard(s)).join("")}</div>` : `<p class="lead-text">Gerade ist nichts offen.</p>`}`;
}
function creatorRow(c){
  const t=total(c.email);
  return `<button class="row" data-creator="${esc(c.email)}"><div class="head"><b>${esc(label(c))}</b><span class="pill ${t>=10?"ok":"lock"}">${t} / 16</span></div>${dots(c.email)}</button>`;
}
const LEGEND = `<div class="legend"><span><i style="background:var(--gold)"></i>2 Punkte</span><span><i style="background:rgba(255,255,255,.65)"></i>1 Punkt</span><span><i style="background:rgba(255,255,255,.25)"></i>0 Punkte</span><span><i style="background:var(--violet)"></i>wartet</span></div>`;
function managerList(){
  const cs=myCreators();
  return `<h2>Meine Creator</h2>${LEGEND}${cs.length?`<div class="list">${cs.map(creatorRow).join("")}</div>`:`<p class="lead-text">Dir sind noch keine Creator zugeordnet.</p>`}`;
}
function creatorDetail(email){
  const c=member(email); if(!c){ S.creator=null; return ""; }
  let h=`<button class="back" id="back">← Zurück</button><h2>${esc(label(c))}</h2><p class="meta">${esc(c.name)} · ${esc(c.email)} · ${total(email)} von 16 Punkten</p><div class="list">`;
  for (const a of S.areas){ const s=subOf(email,a.n);
    h += s ? subCard(s,false) : `<div class="row"><div class="head"><b>${a.n} ${esc(a.title)}</b><span class="pill lock">Nicht abgegeben</span></div></div>`; }
  return h+`</div>`;
}
function leadOverview(){
  const cs=creators(), pass=cs.filter(c=>total(c.email)>=10).length, open=S.subs.filter(s=>s.points==null).length;
  let h=`<div class="score"><div class="stat"><b>${cs.length}</b><small>Creator</small></div><div class="stat"><b>${pass}</b><small>ab 10 Punkten</small></div><div class="stat"><b>${open}</b><small>warten auf Bewertung</small></div></div>${LEGEND}`;
  const groups = {};
  for (const c of cs){ const k=c.manager_email||""; (groups[k] ||= []).push(c); }
  for (const [k,list_] of Object.entries(groups).sort((a,b)=>(member(a[0])?.name||"~").localeCompare(member(b[0])?.name||"~"))){
    h += `<div class="mgr">${esc(member(k)?.name || "Ohne Manager")}</div><div class="list">${list_.map(creatorRow).join("")}</div>`;
  }
  return h + `<button class="btn ghost" id="csv">Punkte als Excel-Datei (CSV) herunterladen</button>`;
}
function exportCsv(){
  const rows=[["Creator","Name","E-Mail","Manager",...S.areas.map(a=>"T"+a.n+" "+a.title),"Summe","Bestanden"]];
  for (const c of creators()){
    const pts=S.areas.map(a=>{const s=subOf(c.email,a.n); return !s?"":s.points==null?"offen":s.points;});
    const t=total(c.email); rows.push([label(c),c.name,c.email,member(c.manager_email)?.name||"",...pts,t,t>=10?"ja":"nein"]);
  }
  const csv="﻿"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";")).join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`Bootcamp-Punkte-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

/* ---------- Teilnehmer verwalten ---------- */
function peopleView(){
  const m = S.editMember ? member(S.editMember) : null;
  const managers = S.members.filter(x=>x.role!=="creator");
  const roleName = ROLE_NAME;
  let h = `<h2>${m?"Person bearbeiten":"Person hinzufügen"}</h2>
  <div class="grid2">
    <label class="f" for="pm-email">E-Mail-Adresse<input id="pm-email" type="email" value="${esc(m?.email||"")}"></label>
    <label class="f" for="pm-role">Rolle<select id="pm-role">${Object.entries(roleName).map(([k,v])=>`<option value="${k}" ${(m?.role||"creator")===k?"selected":""}>${v}</option>`).join("")}</select></label>
    <label class="f" for="pm-name">Name<input id="pm-name" type="text" value="${esc(m?.name||"")}"></label>
    <label class="f" for="pm-handle">TikTok-Name (nur Creator)<input id="pm-handle" type="text" value="${esc(m?.handle||"")}"></label>
    <label class="f" for="pm-mgr">Manager (nur Creator)<select id="pm-mgr"><option value="">–</option>${managers.map(x=>`<option value="${esc(x.email)}" ${m?.manager_email===x.email?"selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
  </div>
  <div class="actions"><button class="btn small" id="pm-save">${m?"Speichern":"Hinzufügen"}</button>${m?`<button class="btn small ghost" id="pm-cancel">Abbrechen</button><button class="btn small danger" id="pm-del">${S.confirmDelete===m.email?"Wirklich löschen? Auch alle Abgaben":"Löschen"}</button>`:""}</div>`;
  for (const r of ["lead","manager","creator"]){
    const ps=S.members.filter(x=>x.role===r); if(!ps.length) continue;
    h += `<div class="mgr">${roleName[r]} (${ps.length})</div><div class="list">${ps.map(p=>`<button class="row" data-edit="${esc(p.email)}"><div class="head"><b>${esc(r==="creator"?label(p):p.name)}</b><span class="meta">${r==="creator"?esc(member(p.manager_email)?.name||"ohne Manager"):""}</span></div><span class="meta">${esc(p.email)}</span></button>`).join("")}</div>`;
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

/* ---------- Themen bearbeiten ---------- */
function areaEditor(){
  const a=S.areas.find(x=>x.n===S.editArea)||S.areas[0]; if(!a) return `<p class="lead-text">Keine Themen gefunden.</p>`;
  const lines = x => esc(list(x).join("\n"));
  return `<h2>Themen bearbeiten</h2>
  <label class="f" for="ae-n">Thema<select id="ae-n">${S.areas.map(x=>`<option value="${x.n}" ${x.n===a.n?"selected":""}>${x.n} · ${esc(x.title)}</option>`).join("")}</select></label>
  <div class="grid2">
    <label class="f" for="ae-title">Titel<input id="ae-title" type="text" value="${esc(a.title)}"></label>
    <label class="f" for="ae-week">Woche<input id="ae-week" type="text" inputmode="numeric" value="${a.week}"></label>
    <label class="f" for="ae-deadline">Abgabe bis<input id="ae-deadline" type="date" value="${esc(a.deadline||"")}"></label>
    <label class="f" for="ae-video">Lehrvideo (YouTube-Link oder hochgeladen)<input id="ae-video" type="text" value="${esc(a.video_url||"")}"></label>
  </div>
  <label class="f" for="ae-intro">Kurze Einleitung<textarea id="ae-intro">${esc(a.intro||"")}</textarea></label>
  <label class="f" for="ae-pre">Zuerst (eine Zeile pro Punkt, darf leer sein)<textarea id="ae-pre">${lines(a.pre)}</textarea></label>
  <label class="f" for="ae-p1">Für 1 Punkt (eine Zeile pro Punkt)<textarea id="ae-p1">${lines(a.p1)}</textarea></label>
  <label class="f" for="ae-p2">Für 2 Punkte zusätzlich<textarea id="ae-p2">${lines(a.p2)}</textarea></label>
  <label class="f" for="ae-proof">Nachweis<input id="ae-proof" type="text" value="${esc(a.proof||"")}"></label>
  ${a.video_url && !/^https?:/.test(a.video_url) ? videoEmbed(a.video_url) : ""}
  <label class="f" for="ae-vfile">Lehrvideo hochladen (MP4, max. 50 MB)<input id="ae-vfile" type="file" accept="video/mp4,video/*"></label>
  <label class="f" for="ae-handout">Handout (PDF) ${a.handout_path?`· <a data-handout="${esc(a.handout_path)}" target="_blank" rel="noopener">aktuelles öffnen</a>`:"· noch keins"}<input id="ae-handout" type="file" accept="application/pdf"></label>
  <button class="btn" id="ae-save">Thema speichern</button>`;
}
async function saveArea(){
  const n=+$("#ae-n").value, split=id=>$(id).value.split("\n").map(s=>s.trim()).filter(Boolean);
  const row={ title:$("#ae-title").value.trim(), week:parseInt($("#ae-week").value,10)||1, deadline:$("#ae-deadline").value||null, video_url:$("#ae-video").value.trim()||null,
    intro:$("#ae-intro").value.trim()||null, pre:split("#ae-pre"), p1:split("#ae-p1"), p2:split("#ae-p2"), proof:$("#ae-proof").value.trim()||null };
  const f=$("#ae-handout").files[0], vf=$("#ae-vfile").files[0];
  if (vf && vf.size>MAX_FILE) return toast("Das Video ist größer als 50 MB.");
  try{
    if (vf){ $("#ae-save").disabled=true; $("#ae-save").textContent="Video wird hochgeladen …";
      const path=`video-${n}-${Date.now()}.mp4`; const {error}=await sb.storage.from("unterlagen").upload(path,vf,{contentType:vf.type||"video/mp4"}); if(error) throw error; row.video_url=path; }
    if (f){ const path=`handout-${n}-${Date.now()}.pdf`; const {error}=await sb.storage.from("unterlagen").upload(path,f,{contentType:"application/pdf"}); if(error) throw error; row.handout_path=path; }
    const {error}=await sb.from("areas").update(row).eq("n",n); if(error) throw error;
    await refresh(); render(); toast("Thema gespeichert.");
  } catch(e){ fail(e); render(); }
}

/* ---------- Ereignisse ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("button,a"); if (!t) return;
  if (t.id==="send-link") return sendLink();
  if (t.id==="verify") return verifyCode();
  if (t.id==="restart") return loginView();
  if (t.id==="logout"){ await sb.auth.signOut(); S.me=null; S.real=null; S.viewAs=""; S.tab=null; S.creator=null; return loginView(); }
  if (t.dataset.tab){ S.tab=t.dataset.tab; S.creator=null; S.editMember=null; return render(); }
  if (t.dataset.area){ if (t.getAttribute("aria-disabled")) return toast("Gib zuerst das Thema davor ab."); const n=+t.dataset.area; S.openArea = S.openArea===n?null:n; return render(); }
  if (t.dataset.submit) return submitArea(+t.dataset.submit);
  if (t.dataset.creator){ S.creator=t.dataset.creator; window.scrollTo(0,0); return render(); }
  if (t.id==="back"){ S.creator=null; return render(); }
  if (t.dataset.rate){
    const id=t.dataset.rate, fb=$(`#fb-${id}`)?.value||"";
    const { error } = await sb.rpc("rate_submission", { sub_id:id, pts:+t.dataset.p, fb });
    if (error) return fail(error);
    await refresh(); render(); return toast("Punkte gespeichert.");
  }
  if (t.id==="csv") return exportCsv();
  if (t.dataset.edit){ S.editMember=t.dataset.edit; S.confirmDelete=null; window.scrollTo(0,0); return render(); }
  if (t.id==="pm-save") return saveMember();
  if (t.id==="pm-cancel"){ S.editMember=null; S.confirmDelete=null; return render(); }
  if (t.id==="pm-del"){
    if (S.confirmDelete!==S.editMember){ S.confirmDelete=S.editMember; return render(); }
    const { error } = await sb.from("members").delete().eq("email", S.editMember); if (error) return fail(error);
    S.editMember=null; S.confirmDelete=null; await refresh(); render(); return toast("Gelöscht.");
  }
  if (t.id==="ae-save") return saveArea();
});
document.addEventListener("change", e => {
  if (e.target.dataset.up){
    const n=+e.target.dataset.up, fs=[...e.target.files], big=fs.filter(f=>f.size>MAX_FILE);
    if (big.length) toast(`${big.map(f=>f.name).join(", ")} ist größer als 50 MB. Bitte kürzer aufnehmen.`);
    S.pending[n]=[...(S.pending[n]||[]), ...fs.filter(f=>f.size<=MAX_FILE)]; render();
  }
  if (e.target.id==="viewas"){ S.viewAs=e.target.value; S.creator=null; S.openArea=null; S.editMember=null; applyView(); S.tab = S.me.role==="creator"?"themen":S.me.role==="manager"?"bewerten":"uebersicht"; window.scrollTo(0,0); return render(); }
  if (e.target.id==="ae-n"){ S.editArea=+e.target.value; render(); }
});
document.addEventListener("keydown", e => {
  if (e.key!=="Enter") return;
  if (e.target.id==="email") sendLink();
  if (e.target.id==="code") verifyCode();
});

boot();
})();
