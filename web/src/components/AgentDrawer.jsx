import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, X, Maximize2 } from 'lucide-react';
import { useLive } from '../lib/api.js';
import AgentChat from './AgentChat.jsx';

/** "Ask Maître" from any screen: a floating button that opens the orchestrator in a side drawer. */
export default function AgentDrawer() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { data: roster } = useLive('/agents', { interval: 300000 });
  if (pathname === '/agents' || !roster?.specialists.some((s) => s.available)) return null;
  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="grad-primary fixed right-5 bottom-5 z-40 inline-flex items-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(217,45,58,0.6)] hover:brightness-105">
          <Sparkles size={17} />Ask Maître
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line bg-surface shadow-2xl slide-in">
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <span className="grad-primary grid h-8 w-8 place-items-center rounded-lg text-white"><Sparkles size={16} /></span>
              <div className="flex-1 leading-tight"><div className="text-[14px] font-bold">Maître</div><div className="text-[11px] text-muted">Orchestrates {roster.specialists.filter((s) => s.available).length} specialist agents</div></div>
              <button onClick={() => { setOpen(false); nav('/agents'); }} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Open full agents page" title="Open full page"><Maximize2 size={15} /></button>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Close"><X size={16} /></button>
            </header>
            <AgentChat roster={roster} compact />
          </aside>
        </div>
      )}
    </>
  );
}
