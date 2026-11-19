import { useEffect, useState } from 'react';
import { BarChart3, Cctv, HeartHandshake, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from '../components/ui.jsx';

const ROLE_COLORS = { owner: '#D92D3A', area_manager: '#0BA5EC', branch_manager: '#12B76A', head_chef: '#FF8A3D', chef: '#F5B300', host: '#E8488A', auditor: '#2ED3B7', it_admin: '#667085' };
const DEMO_PASSWORD = 'demo1234'; // seeded local demo accounts only

export default function Login() {
  const { login } = useAuth();
  const [demo, setDemo] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/auth/demo-users').then(setDemo).catch(() => {}); }, []);

  const submit = async (u = username, p = password) => {
    setError(''); setBusy(u || 'form');
    try { await login(u, p); } catch (e) { setError(e.message); setBusy(null); }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-side p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl" style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }} />
        <div className="absolute -right-24 -bottom-40 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle, var(--primary-2), transparent 70%)' }} />
        <div className="relative flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-10 w-10" />
          <span className="text-xl font-extrabold tracking-tight">OutletOS</span>
        </div>
        <div className="relative mt-auto mb-auto max-w-lg">
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight">Every branch.<br /><span className="grad-text">One screen.</span></h1>
          <p className="mt-5 text-lg text-white/70">Sales, kitchen, cameras, staff, food safety and guests for all your restaurants, live.</p>
          <ul className="mt-10 grid gap-4 text-[15px]">
            {[[BarChart3, 'Online and offline sales, top dishes, busiest hours'], [Cctv, 'Vision intelligence on your existing CCTV'],
              [HeartHandshake, 'Recognise regulars and know exactly what they love'], [ShieldCheck, 'Role- and branch-level access for every team member']].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><Icon size={18} /></span>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><img src="/favicon.svg" alt="" className="h-9 w-9" /><span className="text-xl font-extrabold">OutletOS</span></div>
          <h2 className="text-2xl font-extrabold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your work account, or pick a demo role below.</p>
          <form className="mt-6 grid gap-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username"
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete="current-password"
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-primary" />
            {error && <div className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</div>}
            <button type="submit" disabled={!!busy || !username} className="grad-primary flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60">
              {busy === 'form' || busy === username ? <Loader2 size={16} className="animate-spin" /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          {demo.length > 0 && (
            <>
              <div className="mt-8 mb-3 flex items-center gap-3 text-xs font-semibold text-muted"><span className="h-px flex-1 bg-line" />DEMO ACCOUNTS · see what each role sees<span className="h-px flex-1 bg-line" /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {demo.map((d) => (
                  <button key={d.username} onClick={() => submit(d.username, DEMO_PASSWORD)} disabled={!!busy}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:-translate-y-0.5 hover:border-primary disabled:opacity-60">
                    {busy === d.username ? <Loader2 size={30} className="animate-spin text-primary" /> : <Avatar name={d.name} size={34} color={ROLE_COLORS[d.role]} />}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold">{d.roleLabel}</div>
                      <div className="truncate text-[11.5px] text-muted">{d.scope}{d.station ? ` · ${d.station}` : ''}</div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] text-faint">Demo password for all accounts: {DEMO_PASSWORD}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
