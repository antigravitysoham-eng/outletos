import { useEffect, useRef, useState } from 'react';
import { Palette, Sun, Moon, MoonStar, Check } from 'lucide-react';

export const PALETTES = [
  { id: 'crimson', name: 'Crimson', colors: ['#D92D3A', '#F97316'] },
  { id: 'saffron', name: 'Saffron', colors: ['#E8590C', '#F5B300'] },
  { id: 'olive', name: 'Olive Grove', colors: ['#3F7D3A', '#B5A33A'] },
  { id: 'ocean', name: 'Ocean', colors: ['#1565C0', '#06B6D4'] },
  { id: 'plum', name: 'Plum', colors: ['#7C3AED', '#EC4899'] },
  { id: 'espresso', name: 'Espresso', colors: ['#8B5A2B', '#D4A373'] },
];
const MODES = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['midnight', 'Midnight', MoonStar]];

const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(() => document.documentElement.dataset.theme || read('theme', 'light'));
  const [palette, setPalette] = useState(() => document.documentElement.dataset.palette || read('palette', 'crimson'));
  const ref = useRef(null);

  useEffect(() => { document.documentElement.dataset.theme = mode; write('theme', mode); }, [mode]);
  useEffect(() => { document.documentElement.dataset.palette = palette; write('palette', palette); }, [palette]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Theme" aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2 text-muted hover:text-ink">
        <Palette size={16} />
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: `linear-gradient(135deg, ${PALETTES.find((p) => p.id === palette)?.colors.join(',')})` }} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
          <div className="mb-2 text-xs font-bold tracking-wide text-muted uppercase">Mode</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {MODES.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setMode(id)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-semibold transition ${mode === id ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-ink'}`}>
                <Icon size={16} />{label}
              </button>
            ))}
          </div>
          <div className="mt-4 mb-2 text-xs font-bold tracking-wide text-muted uppercase">Theme collection</div>
          <div className="grid grid-cols-3 gap-2">
            {PALETTES.map((p) => (
              <button key={p.id} onClick={() => setPalette(p.id)}
                className={`relative rounded-xl border p-2 text-left transition ${palette === p.id ? 'border-primary ring-2 ring-primary/20' : 'border-line hover:border-faint'}`}>
                <span className="block h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.colors.join(',')})` }} />
                <span className="mt-1.5 block truncate text-[11px] font-semibold">{p.name}</span>
                {palette === p.id && <Check size={13} className="absolute top-3 right-3 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
