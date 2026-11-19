import { useEffect, useRef, useState } from 'react';
import { useStream, clock } from '../lib/api.js';

// Overhead CCTV renderer. Detections come from real vision events (simulated or from the edge
// agent). Set a camera's stream_url (MP4/WebM/MJPEG) to show real footage instead.

const seeded = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); };
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const SKIN = ['#e8c1a0', '#c99a74', '#a8744f', '#7d5236', '#f1d3b8'];
const HAIR = ['#2b1d14', '#4a3222', '#16120f', '#6b4a2b', '#2e2a26'];
const SHIRTS = ['#4b5d7a', '#7a4b4b', '#4f6b52', '#6b5a7a', '#8a7350', '#3f6470', '#7a6a5a', '#5a4f63'];

const WAYPOINTS = {
  kitchen: [[.14, .33], [.28, .33], [.46, .33], [.6, .33], [.86, .33], [.3, .45], [.5, .45], [.7, .45], [.35, .73], [.65, .73], [.15, .85], [.85, .85]],
  pass: [[.2, .34], [.4, .34], [.6, .34], [.8, .34], [.25, .68], [.5, .7], [.75, .68], [.85, .86], [.15, .86]],
  storage: [[.5, .3], [.5, .55], [.5, .8], [.3, .5], [.7, .5]],
  front: [[.5, .2], [.5, .5], [.5, .82], [.2, .5], [.8, .5], [.35, .35], [.65, .65]],
  entrance: [[.5, .62], [.62, .5], [.42, .4], [.5, .2], [.25, .55]],
};

function drawScene(zone, w, h, rnd) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const wood = zone === 'front' || zone === 'entrance';
  // floor
  if (wood) {
    g.fillStyle = '#5d4330'; g.fillRect(0, 0, w, h);
    const ph = h / 14;
    for (let y = 0; y < h; y += ph) for (let x = -rnd() * 120; x < w; x += 90 + rnd() * 60) {
      g.fillStyle = `hsl(28, ${28 + rnd() * 10}%, ${24 + rnd() * 8}%)`; g.fillRect(x, y, 140, ph - 1);
    }
  } else {
    g.fillStyle = zone === 'storage' ? '#5b5e61' : '#6d7174'; g.fillRect(0, 0, w, h);
    const ts = Math.max(14, w / 26);
    for (let y = 0; y < h; y += ts) for (let x = 0; x < w; x += ts) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(x + 1, y + 1, ts - 2, ts - 2); }
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    for (let y = 0; y < h; y += ts) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += ts) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }
  const steel = (x, y, ww, hh) => {
    const gr = g.createLinearGradient(x, y, x, y + hh); gr.addColorStop(0, '#b9c0c5'); gr.addColorStop(0.5, '#d9dee1'); gr.addColorStop(1, '#9aa2a8');
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 3, y + 4, ww, hh);
    g.fillStyle = gr; g.fillRect(x, y, ww, hh); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeRect(x + .5, y + .5, ww - 1, hh - 1);
  };
  const plate = (x, y, r, food) => { g.fillStyle = '#f4f2ee'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = food; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill(); };
  const wall = () => { g.fillStyle = '#26282b'; g.fillRect(0, 0, w, h * 0.09); };

  if (zone === 'kitchen') {
    wall(); steel(w * .03, h * .09, w * .94, h * .16);
    g.fillStyle = '#232323'; g.fillRect(w * .06, h * .1, w * .3, h * .14);
    for (let i = 0; i < 4; i++) { g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.arc(w * (.1 + i * .075), h * .17, h * .035, 0, 7); g.stroke(); }
    g.fillStyle = '#2a2a2a'; g.fillRect(w * .4, h * .1, w * .13, h * .14); g.fillStyle = '#9b7a2a'; g.fillRect(w * .41, h * .115, w * .05, h * .11); g.fillRect(w * .47, h * .115, w * .05, h * .11);
    g.fillStyle = '#8c949a'; g.fillRect(w * .78, h * .11, w * .16, h * .12); g.fillStyle = '#5e666c'; g.fillRect(w * .8, h * .125, w * .12, h * .09);
    steel(w * .22, h * .52, w * .56, h * .13);
    g.fillStyle = '#b08a5c'; g.fillRect(w * .26, h * .545, w * .1, h * .08); g.fillRect(w * .58, h * .545, w * .1, h * .08);
    plate(w * .44, h * .585, h * .028, '#c0703a'); plate(w * .5, h * .585, h * .028, '#6f9a4a');
  } else if (zone === 'pass') {
    wall(); steel(w * .08, h * .44, w * .84, h * .11);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(255,190,90,0.18)'; g.fillRect(w * (.12 + i * .16), h * .43, w * .12, h * .13); }
    ['#c0703a', '#e0c070', '#6f9a4a', '#b04a3a', '#d8b48a', '#8a5a3a'].forEach((f, i) => plate(w * (.16 + i * .13), h * .495, h * .03, f));
    g.fillStyle = '#7a5a3a'; g.fillRect(w * .72, h * .78, w * .22, h * .14);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#b8935f'; g.fillRect(w * (.735 + i * .05), h * .8, w * .035, h * .09); }
  } else if (zone === 'storage') {
    g.fillStyle = '#26282b'; g.fillRect(0, 0, w, h * .1); g.fillStyle = '#9aa2a8'; g.fillRect(w * .4, h * .02, w * .2, h * .08);
    for (const x of [.04, .78]) {
      g.fillStyle = '#3a3d40'; g.fillRect(w * x, h * .14, w * .18, h * .8);
      for (let y = .16; y < .9; y += .09) { g.fillStyle = ['#8a6d4a', '#5d7a8a', '#a8a39a', '#7a8a5d'][Math.floor(rnd() * 4)]; g.fillRect(w * (x + .015), h * y, w * .15, h * .06); }
    }
  } else if (zone === 'front') {
    g.fillStyle = '#2b2522'; g.fillRect(0, 0, w, h * .07);
    for (let r = 0; r < 2; r++) for (let col = 0; col < 4; col++) {
      const x = w * (.16 + col * .225), y = h * (.33 + r * .38), rad = h * .075;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + 3, y + 4, rad, 0, 7); g.fill();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.fillStyle = '#2d2a28'; g.beginPath(); g.arc(x + Math.cos(a) * rad * 1.45, y + Math.sin(a) * rad * 1.45, rad * .38, 0, 7); g.fill(); }
      g.fillStyle = '#ece8e0'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      g.fillStyle = '#d8d2c6'; g.beginPath(); g.arc(x, y, rad * .2, 0, 7); g.fill();
    }
  } else if (zone === 'entrance') {
    g.fillStyle = '#2b2522'; g.fillRect(0, 0, w, h * .06);
    g.fillStyle = '#1f1d1b'; g.fillRect(0, h * .94, w * .38, h * .06); g.fillRect(w * .62, h * .94, w * .38, h * .06);
    g.fillStyle = '#3c3a38'; g.fillRect(w * .4, h * .8, w * .2, h * .12);
    g.fillStyle = '#4a3a2c'; g.fillRect(w * .7, h * .42, w * .12, h * .12); g.fillStyle = '#d9d2c4'; g.fillRect(w * .715, h * .44, w * .09, h * .04);
    g.fillStyle = '#3a3330'; g.fillRect(w * .05, h * .4, w * .08, h * .35);
  }
  return c;
}

function makeAgent(zone, rnd, role, x, y) {
  const wp = WAYPOINTS[zone];
  const [sx, sy] = x != null ? [x, y] : wp[Math.floor(rnd() * wp.length)];
  return { x: sx + (rnd() - .5) * .04, y: sy + (rnd() - .5) * .04, tx: sx, ty: sy, wait: rnd() * 3, angle: rnd() * 6.28, phase: rnd() * 6, speed: .07 + rnd() * .05,
    role, skin: SKIN[Math.floor(rnd() * SKIN.length)], hair: HAIR[Math.floor(rnd() * HAIR.length)], shirt: SHIRTS[Math.floor(rnd() * SHIRTS.length)],
    id: 10 + Math.floor(rnd() * 89), conf: .9, bx: null, by: null, ttl: Infinity, tag: null };
}

function initialAgents(zone, people, rnd) {
  if (zone === 'front') {
    const seats = [];
    for (let r = 0; r < 2; r++) for (let col = 0; col < 4; col++) for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      seats.push([.16 + col * .225 + Math.cos(a) * .075 * 1.45 * (9 / 16), .33 + r * .38 + Math.sin(a) * .075 * 1.45]);
    }
    const n = Math.min(seats.length, Math.max(4, people));
    const list = seats.sort(() => rnd() - .5).slice(0, n).map(([x, y]) => ({ ...makeAgent(zone, rnd, 'guest', x, y), seated: true, angle: Math.atan2(.5 - y, .5 - x) }));
    return [...list, makeAgent(zone, rnd, 'staff'), makeAgent(zone, rnd, 'staff')];
  }
  const n = zone === 'storage' ? (people > 0 ? 1 : 0) : zone === 'entrance' ? Math.max(1, Math.min(4, people)) : Math.max(2, Math.min(5, people || 3));
  return Array.from({ length: n }, () => makeAgent(zone, rnd, zone === 'entrance' ? (rnd() < .3 ? 'staff' : 'guest') : 'chef'));
}

function drawPerson(g, a, px, py, k, t) {
  g.save(); g.translate(px, py);
  g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(3 * k, 4 * k, 10 * k, 12 * k, 0, 0, 7); g.fill();
  g.rotate(a.angle);
  const moving = a.wait <= 0 && !a.seated;
  const swing = moving ? Math.sin(a.phase) * 3.2 * k : Math.sin(t / 300 + a.id) * .6 * k;
  const body = a.role === 'chef' ? '#ecebe6' : a.role === 'staff' ? '#23262d' : a.shirt;
  g.fillStyle = a.role === 'chef' ? '#cfcdc6' : 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(swing, -9.5 * k, 3 * k, 2.6 * k, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(-swing, 9.5 * k, 3 * k, 2.6 * k, 0, 0, 7); g.fill();
  g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 6.5 * k, 10 * k, 0, 0, 7); g.fill();
  if (a.role === 'chef') { g.fillStyle = '#3b3f46'; g.fillRect(-1 * k, -6 * k, 2.4 * k, 12 * k); }
  g.fillStyle = a.hair; g.beginPath(); g.arc(-1.2 * k, 0, 5.2 * k, 0, 7); g.fill();
  g.fillStyle = a.skin; g.beginPath(); g.arc(.8 * k, 0, 4.2 * k, 0, 7); g.fill();
  if (a.role === 'chef') { g.fillStyle = '#f7f7f4'; g.beginPath(); g.arc(-.6 * k, 0, 5.4 * k, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = k; g.stroke(); }
  g.restore();
}

export default function CameraFeed({ camera, index = 1, compact = false }) {
  const canvas = useRef(null), wrap = useRef(null);
  const [last, setLast] = useState(camera.last ?? null);
  const shared = useRef({ alert: null, spawn: [], people: camera.people || 3 });
  const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(camera.stream_url || '');
  const isImg = !isVideo && /^https?:/.test(camera.stream_url || '');

  useStream((e) => {
    if (e.outlet_id !== camera.outlet_id) return;
    if (e.type === 'vision' && e.camera_id === camera.id) {
      setLast(e);
      shared.current.people = e.people;
      if (!e.ok) shared.current.alert = { label: e.label, conf: e.confidence, until: performance.now() + 6000 };
    }
    if (e.type === 'guest' && camera.zone === 'entrance') shared.current.spawn.push({ tag: `${e.name} · ${e.tier}`, until: performance.now() + 9000 });
  });

  useEffect(() => {
    if (isVideo || isImg) return undefined;
    const c = canvas.current, g = c.getContext('2d');
    const rnd = seeded(camera.id);
    let bg = null, vignette = null, W = 0, H = 0, raf, visible = true, last = performance.now();
    const noise = Array.from({ length: 3 }, () => {
      const n = document.createElement('canvas'); n.width = 160; n.height = 90; const ng = n.getContext('2d'); const img = ng.createImageData(160, 90);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      ng.putImageData(img, 0, 0); return n;
    });
    let agents = initialAgents(camera.zone, shared.current.people, rnd);
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const build = () => {
      W = Math.max(1, Math.round(c.clientWidth * dpr)); H = Math.max(1, Math.round(c.clientHeight * dpr));
      c.width = W; c.height = H;
      bg = drawScene(camera.zone, W, H, seeded(camera.id + 'bg'));
      vignette = document.createElement('canvas'); vignette.width = W; vignette.height = H;
      const vg = vignette.getContext('2d'); const gr = vg.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)'); vg.fillStyle = gr; vg.fillRect(0, 0, W, H);
    };
    build();
    const ro = new ResizeObserver(build); ro.observe(c);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }); io.observe(wrap.current);
    const wp = WAYPOINTS[camera.zone];
    let frame = 0;

    const draw = (t) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!visible || !bg) return;
      frame++;
      const k = H / 210;
      // spawn recognised guests at the door
      while (shared.current.spawn.length) {
        const s = shared.current.spawn.shift();
        const a = makeAgent('entrance', Math.random, 'guest', .5, .97);
        a.tx = .5; a.ty = .62; a.wait = 0; a.tag = s.tag; a.ttl = s.until; a.angle = -Math.PI / 2;
        agents.push(a);
      }
      if (camera.zone === 'entrance' && agents.length < Math.min(5, Math.max(1, shared.current.people)) && Math.random() < dt * .3) {
        const a = makeAgent('entrance', Math.random, 'guest', .5, .97); a.tx = .5; a.ty = .62; a.wait = 0; a.ttl = t + 25000; agents.push(a);
      }
      agents = agents.filter((a) => a.ttl > t);

      for (const a of agents) {
        if (a.seated) continue;
        if (a.wait > 0) { a.wait -= dt; a.angle += Math.sin(t / 500 + a.id) * dt * .4; continue; }
        const dx = (a.tx - a.x) * W, dy = (a.ty - a.y) * H, dist = Math.hypot(dx, dy);
        if (dist < 3 * k) {
          a.wait = camera.zone === 'kitchen' || camera.zone === 'pass' ? 2 + Math.random() * 6 : 1 + Math.random() * 4;
          const [nx, ny] = wp[Math.floor(Math.random() * wp.length)]; a.tx = nx + (Math.random() - .5) * .03; a.ty = ny + (Math.random() - .5) * .03;
          if (a.tag && camera.zone === 'entrance') { a.tx = .5; a.ty = .12; }
          continue;
        }
        const sp = a.speed * W * dt;
        a.x += (dx / dist) * sp / W; a.y += (dy / dist) * sp / H;
        a.angle += angDiff(a.angle, Math.atan2(dy, dx)) * Math.min(1, dt * 7);
        a.phase += dt * 9;
      }

      g.drawImage(bg, 0, 0);
      if (camera.zone === 'kitchen') {
        for (let i = 0; i < 4; i++) {
          const fl = .55 + .45 * Math.sin(t / 90 + i * 1.7) * Math.sin(t / 230 + i);
          g.strokeStyle = `rgba(255,${120 + fl * 60},40,${.5 + fl * .4})`; g.lineWidth = 2.5 * k;
          g.beginPath(); g.arc(W * (.1 + i * .075), H * .17, H * .026, 0, 7); g.stroke();
        }
        g.fillStyle = `rgba(255,255,255,${.04 + .03 * Math.sin(t / 700)})`; g.beginPath(); g.ellipse(W * .2, H * .16, W * .09, H * .05, 0, 0, 7); g.fill();
      }
      const sorted = [...agents].sort((a, b) => a.y - b.y);
      for (const a of sorted) drawPerson(g, a, a.x * W, a.y * H, k, t);

      // tracker boxes (lag slightly behind like a real tracker)
      const alert = shared.current.alert && shared.current.alert.until > t ? shared.current.alert : null;
      const target = alert ? sorted.find((a) => a.role !== 'guest') || sorted[0] : null;
      g.font = `600 ${Math.max(9, 10 * k)}px "JetBrains Mono", monospace`;
      for (const a of sorted) {
        const px = a.x * W, py = a.y * H;
        a.bx = a.bx == null ? px : lerp(a.bx, px, Math.min(1, dt * 9)); a.by = a.by == null ? py : lerp(a.by, py, Math.min(1, dt * 9));
        if (frame % 20 === 0) a.conf = Math.max(.82, Math.min(.99, a.conf + (Math.random() - .5) * .04));
        const bw = 26 * k, bh = 30 * k, x0 = a.bx - bw / 2, y0 = a.by - bh / 2;
        const isAlert = a === target, isTag = !!a.tag;
        const col = isAlert ? `rgba(240,68,56,${.75 + .25 * Math.sin(t / 120)})` : isTag ? '#a594ff' : 'rgba(50,213,131,.95)';
        g.strokeStyle = col; g.lineWidth = isAlert || isTag ? 2 : 1.4;
        const L = 6 * k;
        g.beginPath();
        g.moveTo(x0, y0 + L); g.lineTo(x0, y0); g.lineTo(x0 + L, y0); g.moveTo(x0 + bw - L, y0); g.lineTo(x0 + bw, y0); g.lineTo(x0 + bw, y0 + L);
        g.moveTo(x0 + bw, y0 + bh - L); g.lineTo(x0 + bw, y0 + bh); g.lineTo(x0 + bw - L, y0 + bh); g.moveTo(x0 + L, y0 + bh); g.lineTo(x0, y0 + bh); g.lineTo(x0, y0 + bh - L);
        g.stroke();
        if (!compact || isAlert || isTag) {
          const text = isAlert ? `${alert.label} ${alert.conf.toFixed(2)}` : isTag ? `Recognised: ${a.tag}` : `#${a.id} ${a.role === 'chef' ? 'chef' : a.role} ${a.conf.toFixed(2)}`;
          const tw = g.measureText(text).width + 8, th = 13 * k;
          g.fillStyle = isAlert ? 'rgba(240,68,56,.9)' : isTag ? 'rgba(123,109,255,.92)' : 'rgba(12,30,20,.72)';
          const ly = Math.max(26 * k + th, y0 - 2); // keep labels clear of the camera name / timestamp bar
          g.fillRect(x0, ly - th, tw, th);
          g.fillStyle = isAlert || isTag ? '#fff' : '#7ff0b4'; g.fillText(text, x0 + 4, ly - 3.5);
        }
      }

      // CCTV look: tint, grain, vignette, OSD
      g.fillStyle = 'rgba(20,40,34,0.12)'; g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.07; g.drawImage(noise[frame % 3], 0, 0, W, H); g.globalAlpha = 1;
      g.drawImage(vignette, 0, 0);
      g.font = `600 ${Math.max(10, 11 * k)}px "JetBrains Mono", monospace`;
      g.fillStyle = 'rgba(255,255,255,.88)'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 3;
      g.fillText(`CAM-0${index}  ${camera.name.toUpperCase()}`, 10, 18 * k + 4);
      const d = new Date();
      const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${d.toLocaleTimeString([], { hour12: false })}`;
      g.fillText(ts, W - g.measureText(ts).width - 10, 18 * k + 4);
      g.shadowBlur = 0;
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [camera.id, camera.zone, camera.name, compact, index, isVideo, isImg]);

  const tone = last ? (last.ok ? 'var(--ok)' : last.severity === 'high' ? 'var(--bad)' : 'var(--warn)') : 'var(--faint)';
  return (
    <figure ref={wrap} className="overflow-hidden rounded-2xl border border-line bg-black shadow-card">
      <div className="relative aspect-video">
        {isVideo ? <video src={camera.stream_url} className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline />
          : isImg ? <img src={camera.stream_url} alt={camera.name} className="absolute inset-0 h-full w-full object-cover" />
          : <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`Camera ${camera.name}`} />}
        <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />{camera.stream_url ? 'LIVE' : 'REC'}
        </span>
      </div>
      {!compact && (
        <figcaption className="flex items-center justify-between gap-2 bg-surface px-3 py-2.5 text-xs">
          <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} /><span className="truncate font-semibold">{last?.label ?? 'Monitoring'}</span></span>
          <span className="shrink-0 text-muted">{last ? clock(last.ts) : ''}{camera.compliance != null && <b className="ml-2" style={{ color: camera.compliance < 0.9 ? 'var(--warn)' : 'var(--ok)' }}>{Math.round(camera.compliance * 100)}%</b>}</span>
        </figcaption>
      )}
    </figure>
  );
}
