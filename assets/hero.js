// Animated data network behind the home page hero.
// Adapted from the anot landing page: nodes drift on two waves, links are
// drawn between near neighbours (grid buckets keep the cost linear), and a
// few "active" nodes pulse. Colours come from CSS variables on the canvas.
(function () {
  const canvas = document.querySelector(".hero-net");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let field = null, palette = read(), frame = 0, onScreen = true;

  function read() {
    const s = getComputedStyle(canvas);
    const v = (n, f) => s.getPropertyValue(n).trim() || f;
    return { link: v("--net-link", "#7d8da3"), node: v("--net-node", "#94a3b8"),
             glow: v("--net-glow", "#ffb4ac") };
  }

  function build(w, h) {
    const count = Math.round(Math.min(120, Math.max(36, (w * h) / 11000)));
    const nodes = Array.from({ length: count }, () => ({
      x: w * Math.pow(Math.random(), 0.75),
      y: h * (0.1 + 0.9 * Math.random()),
      phase: Math.random() * Math.PI * 2,
      amp: 6 + Math.random() * 14,
      active: Math.random() < 0.12
    }));
    const dust = Array.from({ length: Math.round(count / 2) }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.5 + Math.random() * 1.1, phase: Math.random() * Math.PI * 2
    }));
    return { w, h, nodes, dust, d: Math.min(160, Math.max(90, w / 9)),
             x: new Float32Array(count), y: new Float32Array(count) };
  }

  function draw(time) {
    const { w, h, nodes, dust, d, x, y } = field;
    const t = time * 0.001;
    ctx.clearRect(0, 0, w, h);
    const cells = new Map();
    nodes.forEach((n, i) => {
      const wave = Math.sin(n.x * 0.006 + t * 0.6 + n.phase * 0.25);
      const swell = Math.sin(n.x * 0.013 - t * 0.35 + n.phase);
      x[i] = n.x + Math.cos(t * 0.4 + n.phase) * n.amp * 0.35;
      y[i] = n.y + (wave * 0.7 + swell * 0.3) * n.amp;
      const k = Math.floor(x[i] / d) + ":" + Math.floor(y[i] / d);
      (cells.get(k) || cells.set(k, []).get(k)).push(i);
    });
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = palette.link;
    for (let i = 0; i < nodes.length; i++) {
      const cx = Math.floor(x[i] / d), cy = Math.floor(y[i] / d);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const bucket = cells.get((cx + a) + ":" + (cy + b));
        if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const dist = Math.hypot(x[i] - x[j], y[i] - y[j]);
          if (dist >= d) continue;
          ctx.globalAlpha = (1 - dist / d) * 0.6;
          ctx.beginPath(); ctx.moveTo(x[i], y[i]); ctx.lineTo(x[j], y[j]); ctx.stroke();
        }
      }
    }
    nodes.forEach((n, i) => {
      if (n.active) {
        const p = 0.5 + 0.5 * Math.sin(t * 2 + n.phase);
        ctx.fillStyle = palette.glow; ctx.globalAlpha = 0.12 + 0.18 * p;
        ctx.beginPath(); ctx.arc(x[i], y[i], 7 + 4 * p, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = n.active ? palette.glow : palette.node;
      ctx.globalAlpha = n.active ? 1 : 0.8;
      ctx.beginPath(); ctx.arc(x[i], y[i], n.active ? 2.4 : 1.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = palette.node;
    for (const m of dust) {
      ctx.globalAlpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.phase));
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (field && field.w === w && field.h === h)) return;
    const r = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * r); canvas.height = Math.round(h * r);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    field = build(w, h);
    if (still) draw(0);
  }
  function tick(time) { frame = 0; if (field) draw(time); play(); }
  function play() { if (!still && !frame && onScreen && !document.hidden) frame = requestAnimationFrame(tick); }
  function pause() { if (frame) { cancelAnimationFrame(frame); frame = 0; } }

  resize();
  (window.ResizeObserver ? new ResizeObserver(resize).observe(canvas) : addEventListener("resize", resize));
  if (still) return;
  if (window.IntersectionObserver) new IntersectionObserver(e => {
    onScreen = e[e.length - 1].isIntersecting; onScreen ? play() : pause();
  }).observe(canvas);
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : play());
  play();
})();
