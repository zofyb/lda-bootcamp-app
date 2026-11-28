/* "App installieren": Android/Chrome installiert mit einem Tipp, iPhone und andere Browser bekommen eine kurze Anleitung. */
(function(){
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{}));
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/.test(ua);
  let deferred = null;
  const KEY = "lda_install_hide";
  const hiddenUntil = () => { try { return +localStorage.getItem(KEY) || 0; } catch(e) { return 0; } };
  const bar = document.getElementById("installbar");
  function show(){ if (bar && !standalone() && mobile && Date.now() > hiddenUntil()) bar.hidden = false; }
  function hide(days){ if (bar) bar.hidden = true; if (days) try { localStorage.setItem(KEY, String(Date.now() + days*864e5)); } catch(e) {} }
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; show(); });
  addEventListener("appinstalled", () => { deferred = null; hide(3650); });
  addEventListener("load", () => setTimeout(show, 1200));
  function guide(){
    const steps = ios
      ? `<ol class="inststeps"><li>Unten in Safari auf <b>Teilen</b> tippen (Quadrat mit Pfeil nach oben).</li><li><b>„Zum Home-Bildschirm“</b> wählen.</li><li>Oben rechts auf <b>„Hinzufügen“</b> tippen. Fertig!</li></ol>`
      : `<ol class="inststeps"><li>Oben oder unten rechts das <b>Menü</b> öffnen (⋮ oder ≡).</li><li><b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b> wählen (bei Samsung: „Seite hinzufügen zu“ → „Startbildschirm“).</li><li>Mit <b>„Installieren“</b> bzw. <b>„Hinzufügen“</b> bestätigen. Fertig!</li></ol>`;
    const html = `<div class="sh"><span class="eyebrow">App installieren</span><h2>LIVEdream Academy aufs Handy</h2></div>
      <p class="muted" style="margin:0">Danach findest du die App mit unserem Logo bei deinen anderen Apps. Sie öffnet sich im Vollbild, ganz ohne Browserleiste.</p>${steps}`;
    let w = document.getElementById("sheet");
    if (!w) { w = document.createElement("div"); w.id = "sheet"; w.className = "sheetwrap"; document.body.appendChild(w); }
    w.innerHTML = `<div class="sheet panel stack" role="dialog" aria-modal="true"><button class="x" id="inst-close" aria-label="Schließen">✕</button>${html}</div>`;
    requestAnimationFrame(() => w.classList.add("show")); document.body.classList.add("noscroll");
  }
  async function install(){
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice.catch(()=>null); deferred = null; if (r && r.outcome === "accepted") hide(3650); return; }
    guide();
  }
  document.addEventListener("click", e => {
    if (e.target.id === "inst-close" || (e.target.id === "sheet" && e.target.querySelector("#inst-close"))) {
      const w = document.getElementById("sheet"); w.classList.remove("show"); document.body.classList.remove("noscroll"); return;
    }
    const t = e.target.closest && e.target.closest("[data-install],#inst-go,#inst-x");
    if (!t) return;
    if (t.id === "inst-x") return hide(7);
    install();
  });
  window.ldaInstall = install;
})();
