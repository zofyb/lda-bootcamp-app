/* Funkelnde Lichter im Hintergrund: schweben langsam, weichen Maus/Finger aus, Spur aus kleinen Funken */
(() => {
  const host = document.querySelector(".bg"); if (!host) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = document.createElement("canvas"); cv.className = "sparkles"; host.appendChild(cv);
  const cx = cv.getContext("2d");
  const COLORS = ["194,79,224", "155,47,201", "214,150,245", "170,90,230"];
  let W = 0, H = 0, dpr = 1, parts = [], trail = [], mouse = { x: -999, y: -999, on: false, t: 0, touch: false }, glow = { x: -999, y: -999, a: 0 }, lastScroll = -1e9, dim = 1;

  // vorgerenderte Leuchtpunkte je Farbe
  const sprites = COLORS.map(c => {
    const s = document.createElement("canvas"); s.width = s.height = 64; const g = s.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `rgba(240,215,255,.9)`); r.addColorStop(.18, `rgba(${c},.95)`); r.addColorStop(.45, `rgba(${c},.28)`); r.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return s;
  });

  const rnd = (a, b) => a + Math.random() * (b - a);
  function make(){
    const ci = Math.floor(rnd(0, COLORS.length)), big = Math.random() < .18;
    return { x: rnd(0, W), y: rnd(0, H), vx: rnd(-.12, .12), vy: rnd(-.18, -.03), ox: 0, oy: 0, s: big ? rnd(16, 26) : rnd(4, 12), ci, ph: rnd(0, 6.28), sp: rnd(.6, 1.8) };
  }
  function size(){
    dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(170, Math.max(60, W * H / 8500)) * (reduce ? .5 : 1));
    while (parts.length < n) parts.push(make()); parts.length = n;
  }
  size(); addEventListener("resize", size, { passive: true });

  // Beim Scrollen: Lichter abdunkeln, keine Spur und kein Ausweichen
  addEventListener("scroll", () => { lastScroll = performance.now(); if (mouse.touch) mouse.on = false; }, { passive: true });
  const move = (x, y) => {
    const now = performance.now();
    if (now - lastScroll < 300){ if (mouse.touch){ mouse.on = false; return; } }
    if (mouse.on && !reduce){ const d = Math.hypot(x - mouse.x, y - mouse.y), k = Math.min(6, Math.floor(d / 7));
      for (let i = 0; i < k; i++){ const f = i / k; trail.push({ x: mouse.x + (x - mouse.x) * f + rnd(-4, 4), y: mouse.y + (y - mouse.y) * f + rnd(-4, 4), vx: rnd(-.4, .4), vy: rnd(-.6, .2), l: 1, s: rnd(9, 20), ci: Math.floor(rnd(0, COLORS.length)) }); } }
    mouse.x = x; mouse.y = y; mouse.on = true; mouse.t = now;
    if (trail.length > 220) trail.splice(0, trail.length - 220);
  };
  addEventListener("pointermove", e => { mouse.touch = e.pointerType !== "mouse"; move(e.clientX, e.clientY); }, { passive: true });
  addEventListener("touchmove", e => { const t = e.touches[0]; mouse.touch = true; if (t) move(t.clientX, t.clientY); }, { passive: true });
  addEventListener("touchstart", e => { const t = e.touches[0]; mouse.touch = true; if (t){ mouse.on = false; move(t.clientX, t.clientY); glow.x = t.clientX; glow.y = t.clientY; } }, { passive: true });
  addEventListener("pointerdown", e => move(e.clientX, e.clientY), { passive: true });
  document.addEventListener("pointerleave", () => { mouse.on = false; });

  let last = performance.now(), run = true;
  document.addEventListener("visibilitychange", () => { run = !document.hidden; if (run){ last = performance.now(); requestAnimationFrame(frame); } });

  function frame(now){
    if (!run) return;
    const dt = Math.min(3, (now - last) / 16.7); last = now;
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = "lighter";
    // Leuchtfleck an Maus oder Finger: folgt weich, verblasst nach dem Loslassen
    const want = mouse.on && (mouse.touch ? now - mouse.t < 700 : true) ? 1 : 0;
    glow.a += (want - glow.a) * Math.min(1, .08 * dt);
    if (glow.x < -900){ glow.x = mouse.x; glow.y = mouse.y; }
    glow.x += (mouse.x - glow.x) * Math.min(1, .25 * dt); glow.y += (mouse.y - glow.y) * Math.min(1, .25 * dt);
    if (glow.a > .01){ const gr = cx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 170);
      gr.addColorStop(0, `rgba(194,79,224,${.38 * glow.a})`); gr.addColorStop(.4, `rgba(155,47,201,${.16 * glow.a})`); gr.addColorStop(1, "rgba(155,47,201,0)");
      cx.globalAlpha = 1; cx.fillStyle = gr; cx.fillRect(glow.x - 170, glow.y - 170, 340, 340); }
    dim += ((now - lastScroll < 450 ? .18 : 1) - dim) * Math.min(1, (dim > .5 ? .25 : .06) * dt);
    const active = mouse.on && now - mouse.t < 1500, R = 130;
    for (const p of parts){
      if (active){ const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R * R){ const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.4; p.ox += dx / d * f * dt; p.oy += dy / d * f * dt; } }
      p.ox *= Math.pow(.92, dt); p.oy *= Math.pow(.92, dt);
      p.x += (p.vx + p.ox) * dt; p.y += (p.vy + p.oy) * dt;
      if (p.y < -20){ p.y = H + 20; p.x = rnd(0, W); } if (p.y > H + 20) p.y = -20;
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      const tw = reduce ? .7 : .45 + .55 * Math.abs(Math.sin(now / 1000 * p.sp + p.ph)), s = p.s * (.75 + tw * .4);
      cx.globalAlpha = tw * .6 * dim; cx.drawImage(sprites[p.ci], p.x - s / 2, p.y - s / 2, s, s);
    }
    for (let i = trail.length - 1; i >= 0; i--){ const t = trail[i];
      t.l -= .018 * dt; if (t.l <= 0){ trail.splice(i, 1); continue; }
      t.x += t.vx * dt; t.y += t.vy * dt; t.vy += .01 * dt;
      const s = t.s * (.5 + t.l * .9); cx.globalAlpha = Math.min(1, t.l * 1.1); cx.drawImage(sprites[t.ci], t.x - s / 2, t.y - s / 2, s, s);
    }
    cx.globalAlpha = 1; cx.globalCompositeOperation = "source-over";
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
