import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { api, clock } from '../lib/api.js';
import { Button, Badge, Select } from './ui.jsx';

// Real computer vision in the browser (TensorFlow.js COCO-SSD). Detections are turned into the
// same canonical vision events the edge agent sends, proving the CCTV pipeline end to end.
export default function WebcamLab({ outlets }) {
  const video = useRef(null);
  const overlay = useRef(null);
  const model = useRef(null);
  const stream = useRef(null);
  const loop = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | running | error
  const [error, setError] = useState('');
  const [outlet, setOutlet] = useState(outlets[0]?.id ?? 'r1');
  const [log, setLog] = useState([]);
  const [counts, setCounts] = useState({ person: 0, phone: 0 });
  const camForOutlet = `${outlet}-hotline`;
  const cfg = useRef({ outlet, cam: camForOutlet });
  cfg.current = { outlet, cam: camForOutlet };

  const post = async (type, ok, people, label) => {
    try {
      await api('/lab/vision', { method: 'POST', body: { outlet_id: cfg.current.outlet, camera_id: cfg.current.cam, type, ok, people, label, confidence: 0.9, force_alert: !ok && type !== 'station' } });
      setLog((l) => [{ ts: Date.now(), type, ok, label }, ...l].slice(0, 8));
    } catch (e) { setError(e.message); }
  };

  const stop = () => {
    clearInterval(loop.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setStatus('idle');
  };
  useEffect(() => stop, []);

  const start = async () => {
    setError(''); setStatus('loading');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: false });
      video.current.srcObject = stream.current;
      await video.current.play();
      if (!model.current) {
        const [, coco] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/coco-ssd')]);
        model.current = await coco.load({ base: 'lite_mobilenet_v2' });
      }
      setStatus('running');
      let lastStation = 0, lastPhone = 0, emptySince = null;
      loop.current = setInterval(async () => {
        const v = video.current;
        if (!v || v.readyState < 2) return;
        const preds = await model.current.detect(v);
        const ctx = overlay.current.getContext('2d');
        overlay.current.width = v.videoWidth; overlay.current.height = v.videoHeight;
        ctx.clearRect(0, 0, v.videoWidth, v.videoHeight);
        let person = 0, phone = 0;
        for (const p of preds) {
          if (p.score < 0.5) continue;
          if (p.class === 'person') person++;
          if (p.class === 'cell phone') phone++;
          const bad = p.class === 'cell phone';
          const [x, y, w, h] = p.bbox;
          ctx.strokeStyle = bad ? '#ec6b72' : '#56b98c'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
          ctx.font = '600 15px Inter, sans-serif';
          const tag = `${p.class} ${(p.score * 100).toFixed(0)}%`;
          ctx.fillStyle = bad ? '#ec6b72' : '#56b98c'; ctx.fillRect(x, y - 20, ctx.measureText(tag).width + 10, 20);
          ctx.fillStyle = '#0d0c0a'; ctx.fillText(tag, x + 5, y - 5);
        }
        setCounts({ person, phone });
        const now = Date.now();
        if (person === 0) emptySince ??= now; else emptySince = null;
        if (phone > 0 && now - lastPhone > 10000) { lastPhone = now; post('phone', false, person, 'Phone use on the line (webcam)'); }
        if (now - lastStation > 6000) {
          lastStation = now;
          if (person > 0) post('station', true, person, `Station staffed · ${person} detected`);
          else if (emptySince && now - emptySince > 8000) post('station', false, 0, 'Station unattended (webcam)');
        }
      }, 450);
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Camera permission was denied.' : e.message);
      stop(); setStatus('error');
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-feed">
        <video ref={video} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" muted playsInline />
        <canvas ref={overlay} className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        {status !== 'running' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">
            {status === 'loading' ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Loading model & camera…</span>
              : <span>Point your webcam at a “station”. Step away to trigger <em>unattended</em>; hold up a phone to trigger <em>phone on the line</em>.</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select label="Report as" value={outlet} onChange={setOutlet} options={outlets.map((o) => ({ value: o.id, label: `${o.name} · ${o.city}` }))} />
          {status === 'running'
            ? <Button onClick={stop}><CameraOff size={14} /> Stop</Button>
            : <Button variant="primary" onClick={start} disabled={status === 'loading'}><Camera size={14} /> Start webcam</Button>}
        </div>
        <div className="flex gap-2 text-xs">
          <Badge tone={counts.person ? 'ok' : 'muted'}>{counts.person} person</Badge>
          <Badge tone={counts.phone ? 'bad' : 'muted'}>{counts.phone} phone</Badge>
          <Badge tone="muted">→ {camForOutlet}</Badge>
        </div>
        {error && <div className="rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{error}</div>}
        <div>
          <div className="eyebrow mb-1">Events sent to the platform</div>
          <ul className="space-y-1 text-[12.5px]">
            {log.length === 0 && <li className="text-muted">None yet.</li>}
            {log.map((l) => (
              <li key={l.ts} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.ok ? 'var(--ok)' : 'var(--bad)' }} />
                <span className="flex-1 truncate">{l.label}</span>
                <span className="font-mono text-[11px] text-muted">{clock(l.ts)}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-auto text-[11px] leading-relaxed text-muted">Runs fully in your browser: video never leaves the device, only events are posted. The model weights download once from Google’s TF.js model host.</p>
      </div>
    </div>
  );
}
