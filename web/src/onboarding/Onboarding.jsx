import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Rocket, Building2, Globe2, Store, LayoutGrid, UtensilsCrossed, Users, Boxes, Plug, ClipboardCheck, Loader2, Copy, CloudCheck, Eye, EyeOff, Sparkles, ShieldCheck, AlertTriangle, CircleDashed, PartyPopper } from 'lucide-react';
import { api, setToken } from '../lib/api.js';
import { ReceiptPreview, FloorPreview, SummaryCard, fmtMoney } from './previews.jsx';
import { StepBusiness, StepCompliance, StepOutlets, StepTables, StepMenu, StepTeam, StepModules, StepIntegrations, newOutlet, priceFactor, validId, Field, Input, inputCls } from './steps.jsx';

const STEPS = [
  { id: 'business', label: 'Business', icon: Building2, title: 'Tell us about your business', sub: 'Thirty seconds that shape every default after this.' },
  { id: 'compliance', label: 'Country & tax', icon: Globe2, title: 'Country, currency and compliance', sub: 'Pick a country and we configure tax, receipts, fiscal year and formats for you.' },
  { id: 'outlets', label: 'Outlets', icon: Store, title: 'Add your outlets', sub: 'One or two hundred: cards for a few, a spreadsheet grid for many.' },
  { id: 'tables', label: 'Floors & tables', icon: LayoutGrid, title: 'Floors and tables', sub: 'Every outlet is different. Build each floor plan, or copy one to all.' },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed, title: 'Your menu', sub: 'Start from a costed template, import a spreadsheet, or build it here.' },
  { id: 'team', label: 'Team & roles', icon: Users, title: 'Team, rosters and access', sub: 'Rosters per outlet and logins scoped to role and outlet.' },
  { id: 'modules', label: 'Modules & targets', icon: Boxes, title: 'Modules and targets', sub: 'Switch on what you need. Set the numbers we hold you to.' },
  { id: 'integrations', label: 'Integrations', icon: Plug, title: 'Your existing systems', sub: 'POS, delivery, payments, accounting, CCTV and attendance, ready to connect.' },
  { id: 'review', label: 'Review & launch', icon: ClipboardCheck, title: 'Review and launch', sub: 'A readiness check per area. Fix now or after launch.' },
];

function strength(pw = '') { let s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return Math.min(4, s); }

/** First screen of a brand-new workspace: create the owner account. */
export function Signup({ onDone }) {
  const [f, setF] = useState({ name: '', email: '', username: '', password: '', company: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const st = strength(f.password);
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try { const r = await api('/setup/owner', { method: 'POST', body: { ...f, username: f.username || f.email.split('@')[0] } }); setToken(r.token); onDone(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-side p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl" /><div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-[#F97316]/25 blur-3xl" />
        <div className="relative flex items-center gap-3"><img src="/favicon.svg" alt="" className="h-10 w-10" /><span className="text-xl font-extrabold tracking-tight">OutletOS</span></div>
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight">Your restaurant group, set up in minutes, built for the way you actually run.</h1>
          <ul className="mt-8 space-y-3 text-[15px] text-white/85">
            {['Any country: currency, tax and legal receipts configured for you', 'Any shape: one café or two hundred outlets, each with its own floor and team', 'Bring your systems: 67 connectors, from Petpooja and Zomato to Tally and Hikvision', 'Explore with four weeks of sample activity, then go live outlet by outlet'].map((t) => <li key={t} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15"><Check size={12} /></span>{t}</li>)}
          </ul>
        </div>
      </div>
      <div className="grid place-items-center bg-bg p-6">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="mb-2 text-[12px] font-bold tracking-widest text-primary uppercase">Create your workspace</div>
          <h2 className="text-3xl font-extrabold tracking-tight">Welcome. Let's set you up.</h2>
          <p className="mt-1 text-sm text-muted">You'll be the owner. You can invite your team in the next few steps.</p>
          <div className="mt-6 grid gap-4">
            <Field label="Your name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" autoFocus /></Field>
            <Field label="Business name"><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="e.g. Spice Route Hospitality" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email"><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></Field>
              <Field label="Username"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} placeholder={f.email.split('@')[0] || 'owner'} autoComplete="username" /></Field>
            </div>
            <Field label="Password" hint="At least 10 characters. A passphrase works best.">
              <div className="relative"><Input type={show ? 'text' : 'password'} required minLength={10} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" className="pr-10" />
                <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
              <div className="mt-1 flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < st ? (st >= 3 ? 'bg-ok' : st === 2 ? 'bg-warn' : 'bg-bad') : 'bg-surface-2'}`} />)}</div>
            </Field>
          </div>
          {err && <p className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{err}</p>}
          <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl grad-primary py-3 text-[15px] font-bold text-white shadow-lg shadow-primary/25 disabled:opacity-60">{busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}Create workspace</button>
          <p className="mt-3 text-center text-[11.5px] text-muted">Your data stays in this workspace. Face recognition and marketing are opt-in only.</p>
        </form>
      </div>
    </div>
  );
}

function readiness(d, catalog) {
  const c = catalog.countries.find((x) => x.code === d.org?.country);
  const outlets = d.outlets || [];
  const reqIds = (c?.ids || []).filter((x) => x.required);
  const idsOk = outlets.every((o) => reqIds.filter((x) => x.scope === 'outlet').every((x) => o.ids?.[x.key] && validId(x, o.ids[x.key]))) && reqIds.filter((x) => x.scope === 'org').every((x) => d.org?.ids?.[x.key] && validId(x, d.org.ids[x.key]));
  const dine = outlets.filter((o) => Number(o.seats) > 0);
  const menuN = d.menu?.source === 'template' ? 1 : (d.menu?.items || []).filter((m) => m.name && Number(m.price) > 0).length;
  return [
    { k: 'Country & tax confirmed', ok: !!c, req: true, step: 1 },
    { k: 'Business name', ok: !!d.org?.group?.trim(), req: true, step: 1 },
    { k: `At least one outlet (${outlets.length})`, ok: outlets.length > 0, req: true, step: 2 },
    { k: `Legal IDs on receipts${reqIds.length ? ` (${reqIds.map((x) => x.label).join(', ')})` : ''}`, ok: !reqIds.length || idsOk, req: false, note: 'Needed before go-live of invoicing, not to explore', step: 2 },
    { k: `Floor plans for dine-in outlets (${dine.filter((o) => (o.areas || []).length).length}/${dine.length})`, ok: dine.every((o) => (o.areas || []).length), req: false, step: 3 },
    { k: 'Menu ready', ok: menuN > 0, req: true, step: 4 },
    { k: `Team invited (${(d.team?.invites || []).length})`, ok: (d.team?.invites || []).length > 0, req: false, step: 5 },
    { k: 'Modules chosen', ok: (d.modules || []).length > 0, req: false, step: 6 },
    { k: `Integrations selected (${(d.integrations || []).length})`, ok: (d.integrations || []).length > 0, req: false, step: 7 },
  ];
}

export default function Onboarding({ user, onComplete }) {
  const [catalog, setCatalog] = useState(null);
  const [data, setData] = useState(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState('idle');
  const [focus, setFocus] = useState(0);
  const [launch, setLaunch] = useState(null); // {phase, result, error}
  const timer = useRef(null);

  useEffect(() => {
    Promise.all([api('/setup/catalog'), api('/setup/draft')]).then(([cat, d]) => {
      setCatalog(cat);
      const init = d.data || {};
      init.org ??= {}; init.profile ??= { business_type: 'casual', outlet_band: '1', goals: [] };
      setData(init);
      const i = STEPS.findIndex((s) => s.id === d.step);
      setStep(i > 0 ? i : 0);
    }).catch(() => setCatalog(false));
  }, []);

  const save = useCallback((next, s = step) => {
    clearTimeout(timer.current); setSaved('saving');
    timer.current = setTimeout(async () => { try { await api('/setup/draft', { method: 'PUT', body: { step: STEPS[s].id, data: next } }); setSaved('saved'); } catch { setSaved('error'); } }, 600);
  }, [step]);
  const set = (next) => { setData(next); save(next); };
  const go = (i) => {
    let next = data;
    if (i >= 2 && !(data.outlets || []).length && data.org?.country) { next = { ...data, outlets: [newOutlet(data, catalog)] }; }
    if (i >= 4 && !data.menu) next = { ...next, menu: { source: 'template', template: data.org?.country === 'IN' ? 'indian' : 'global' } };
    if (i >= 6 && !data.modules) {
      const bt = catalog.business_types.find((b) => b.id === data.profile?.business_type) || catalog.business_types[1];
      const GOAL_MOD = { food_cost: ['inventory'], speed: ['kds'], labour: ['workforce'], safety: ['safety', 'vision'], loyalty: ['guests', 'reservations'], loss: ['vision', 'finance'], growth: ['reports'], visibility: ['reports', 'agents'] };
      next = { ...next, modules: [...new Set([...bt.modules, ...(data.profile?.goals || []).flatMap((g) => GOAL_MOD[g] || []), 'pos', 'reports'])] };
    }
    setData(next); setStep(i); save(next, i); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const country = useMemo(() => catalog && catalog.countries.find((c) => c.code === data?.org?.country), [catalog, data]);
  const checks = useMemo(() => (catalog && data ? readiness(data, catalog) : []), [catalog, data]);

  if (catalog === false) return <div className="grid h-full place-items-center text-sm text-bad">Could not load setup. Refresh to try again.</div>;
  if (!catalog || !data) return <div className="grid h-full place-items-center text-sm text-muted"><Loader2 className="mr-2 inline animate-spin" size={16} />Preparing your setup…</div>;
  const S = STEPS[step];
  const canNext = step !== 1 || (country && data.org?.group?.trim());
  const blockers = checks.filter((c) => c.req && !c.ok);

  const doLaunch = async () => {
    const tpl = data.menu?.template || 'global';
    const step2 = country?.roundTo >= 1 ? Math.max(country.roundTo, ['INR'].includes(data.org.currency?.code) ? 10 : country.roundTo) : 0.5;
    const body = { ...data, org: { ...data.org, business_type: data.profile?.business_type }, menu: { ...data.menu, priceFactor: priceFactor(tpl, data.org.currency?.code), priceStep: step2 }, modules: data.modules || undefined };
    const phases = ['Creating outlets and legal profiles', 'Drawing floor plans and tables', 'Publishing the menu and recipes', 'Building rosters and logins', 'Registering cameras and sensors', 'Creating connectors', data.sample !== false ? 'Generating four weeks of sample activity' : 'Preparing a clean workspace'];
    let i = 0; setLaunch({ phase: 0, phases });
    const tick = setInterval(() => { i = Math.min(phases.length - 1, i + 1); setLaunch((l) => (l && !l.result ? { ...l, phase: i } : l)); }, 2200);
    try { const r = await api('/setup/complete', { method: 'POST', body }); clearInterval(tick); setLaunch({ phase: phases.length, phases, result: r }); }
    catch (e) { clearInterval(tick); setLaunch({ phase: -1, phases, error: e.message }); }
  };

  if (launch) {
    return (
      <div className="grid min-h-full place-items-center bg-bg p-6">
        <div className="w-full max-w-2xl rounded-3xl border border-line bg-surface p-8 shadow-xl">
          {!launch.result && !launch.error && <>
            <div className="mb-6 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl grad-primary text-white"><Rocket size={22} /></span><div><div className="text-xl font-extrabold">Launching {data.org.group}</div><div className="text-sm text-muted">This takes a moment. Please keep this tab open.</div></div></div>
            <ol className="space-y-3">{launch.phases.map((p, i) => <li key={p} className="flex items-center gap-3 text-[15px]">{i < launch.phase ? <Check size={18} className="text-ok" /> : i === launch.phase ? <Loader2 size={18} className="animate-spin text-primary" /> : <CircleDashed size={18} className="text-faint" />}<span className={i <= launch.phase ? 'font-semibold' : 'text-muted'}>{p}</span></li>)}</ol>
          </>}
          {launch.error && <><div className="mb-3 flex items-center gap-2 text-lg font-extrabold text-bad"><AlertTriangle size={20} />Launch didn't finish</div><p className="text-sm">{launch.error}</p><button onClick={() => setLaunch(null)} className="mt-5 rounded-xl border border-line px-4 py-2 text-sm font-semibold">Back to review</button></>}
          {launch.result && <>
            <div className="mb-2 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-ok-soft text-ok"><PartyPopper size={22} /></span><div><div className="text-2xl font-extrabold">You're live, {user.name.split(' ')[0]}.</div><div className="text-sm text-muted">{data.org.group} is ready.</div></div></div>
            <div className="my-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Outlets', launch.result.outlets], ['Tables', launch.result.tables], ['Staff', launch.result.staff], ['Menu items', launch.result.menu]].map(([l, v]) => <div key={l} className="rounded-xl bg-surface-2 p-3 text-center"><div className="text-2xl font-extrabold">{v}</div><div className="text-[11px] text-muted">{l}</div></div>)}</div>
            {launch.result.invites.length > 0 && (
              <div className="rounded-2xl border border-warn/40 bg-warn-soft/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} />Team logins: shown once. Share them privately over a secure channel; you can deactivate any login from Access Control.</div>
                <div className="max-h-52 overflow-y-auto"><table className="w-full text-[13px]"><tbody>{launch.result.invites.map((x) => <tr key={x.username} className="border-t border-line/60"><td className="py-1.5 font-semibold">{x.name}</td><td className="text-muted">{x.role.replace('_', ' ')}</td><td className="font-mono">{x.username}</td><td className="font-mono">{x.temporary_password}</td></tr>)}</tbody></table></div>
                <button onClick={() => navigator.clipboard?.writeText(launch.result.invites.map((x) => `${x.name} (${x.role}): ${x.username} / ${x.temporary_password}`).join('\n'))} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Copy size={13} />Copy all</button>
              </div>
            )}
            <button onClick={onComplete} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl grad-primary py-3 font-bold text-white">Open my dashboard<ChevronRight size={17} /></button>
          </>}
        </div>
      </div>
    );
  }

  const sample = data.org?.country === 'IN' ? [['Butter Chicken', 1, 450], ['Garlic Naan', 2, 90], ['Sweet Lassi', 2, 140]] : [['Signature main', 2, 18 * priceFactor('global', data.org?.currency?.code)], ['House bread', 1, 5 * priceFactor('global', data.org?.currency?.code)], ['Fresh lime soda', 2, 4 * priceFactor('global', data.org?.currency?.code)]];
  const preview = () => {
    if (step === 3) return <><div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Floor plan · {data.outlets?.[focus]?.name}</div><FloorPreview outlet={data.outlets?.[focus]} /></>;
    if (step >= 5 && step !== 8) return <><div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Your workspace</div><SummaryCard data={data} catalog={catalog} /><div className="mt-5 mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Receipt</div><ReceiptPreview data={data} country={country} sampleItems={sample} /></>;
    return <><div className="mb-2 text-[11px] font-bold tracking-widest text-muted uppercase">Live receipt preview</div><ReceiptPreview data={data} country={country} sampleItems={sample} />
      {country && <p className="mt-4 text-center text-[11.5px] text-muted">{country.name} · {data.org?.tax?.name} {((data.org?.tax?.rate || 0) * 100).toFixed(2).replace(/\.00$/, '')}% {data.org?.tax?.inclusive ? 'inclusive' : 'added on bill'} · {fmtMoney(1234567.89, data.org?.currency)}</p>}</>;
  };

  return (
    <div className="min-h-full bg-bg lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* Step rail */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-side p-5 text-side-ink lg:flex">
        <div className="mb-6 flex items-center gap-2.5"><img src="/favicon.svg" alt="" className="h-9 w-9" /><div><div className="font-extrabold text-white">OutletOS</div><div className="text-[11px] text-side-muted">Workspace setup</div></div></div>
        <div className="mb-5"><div className="mb-1.5 flex justify-between text-[11px] text-side-muted"><span>Progress</span><span>{Math.round((step / (STEPS.length - 1)) * 100)}%</span></div><div className="h-1.5 rounded-full bg-side-2"><div className="h-full rounded-full grad-primary transition-all duration-500" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div></div>
        <nav className="flex-1 space-y-1" aria-label="Setup steps">
          {STEPS.map((s, i) => { const I = s.icon; const done = i < step; return (
            <button key={s.id} onClick={() => (i <= step || canNext) && go(i)} aria-current={i === step ? 'step' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-semibold transition ${i === step ? 'bg-side-2 text-white shadow-[inset_3px_0_0_var(--primary)]' : 'text-side-muted hover:bg-side-2/60 hover:text-white'}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${done ? 'bg-ok text-white' : i === step ? 'grad-primary text-white' : 'bg-side-2'}`}>{done ? <Check size={13} /> : <I size={12} />}</span>{s.label}
            </button>); })}
        </nav>
        <div className="rounded-xl bg-side-2 p-3 text-[11.5px]"><div className="flex items-center gap-1.5 font-semibold text-white"><CloudCheck size={14} />{saved === 'saving' ? 'Saving…' : saved === 'error' ? 'Not saved: retrying on next change' : 'All changes saved'}</div><div className="mt-0.5 text-side-muted">Close anytime and pick up exactly here.</div></div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 px-5 py-3 backdrop-blur lg:hidden"><div className="text-[11px] font-bold text-muted uppercase">Step {step + 1} of {STEPS.length}</div><div className="font-extrabold">{S.label}</div></header>
        <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:px-10">
          <main className="min-w-0">
            <div className="mb-6"><div className="text-[12px] font-bold tracking-widest text-primary uppercase">Step {step + 1} of {STEPS.length}</div><h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{S.title}</h1><p className="mt-1 text-[15px] text-muted">{S.sub}</p></div>
            {step === 0 && <StepBusiness data={data} set={set} catalog={catalog} />}
            {step === 1 && <StepCompliance data={data} set={set} catalog={catalog} country={country} />}
            {step === 2 && <StepOutlets data={data} set={set} catalog={catalog} country={country} />}
            {step === 3 && <StepTables data={data} set={set} focus={focus} setFocus={setFocus} />}
            {step === 4 && <StepMenu data={data} set={set} catalog={catalog} />}
            {step === 5 && <StepTeam data={data} set={set} catalog={catalog} />}
            {step === 6 && <StepModules data={data} set={set} catalog={catalog} />}
            {step === 7 && <StepIntegrations data={data} set={set} catalog={catalog} />}
            {step === 8 && (
              <div className="space-y-5">
                <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <h3 className="mb-3 font-extrabold">Readiness</h3>
                  <ul className="divide-y divide-line">{checks.map((c) => (
                    <li key={c.k} className="flex items-center gap-3 py-2.5 text-[14px]">
                      {c.ok ? <span className="grid h-6 w-6 place-items-center rounded-full bg-ok-soft text-ok"><Check size={14} /></span> : <span className={`grid h-6 w-6 place-items-center rounded-full ${c.req ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}><AlertTriangle size={13} /></span>}
                      <span className="flex-1"><span className="font-semibold">{c.k}</span>{!c.ok && <span className="ml-2 text-[11.5px] text-muted">{c.req ? 'Required to launch' : c.note || 'Recommended, can be done after launch'}</span>}</span>
                      {!c.ok && <button onClick={() => go(c.step)} className="text-[12.5px] font-semibold text-primary">Fix</button>}
                    </li>))}</ul>
                </section>
                <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <h3 className="mb-1 font-extrabold">How do you want to start?</h3>
                  <p className="mb-4 text-[12.5px] text-muted">Sample activity fills every dashboard, report and AI agent so your team can learn the product. Turn it off before go-live; real systems then feed the same screens.</p>
                  <div className="grid gap-3 md:grid-cols-2">{[[true, Sparkles, 'Explore with sample activity', 'Four weeks of orders, tickets, shifts, sensor readings and reviews for your outlets, menu and team'], [false, ShieldCheck, 'Start clean', 'Empty workspace: data arrives only from your POS, connectors and devices']].map(([v, I, t, d]) => (
                    <button key={t} onClick={() => set({ ...data, sample: v })} aria-pressed={(data.sample !== false) === v} className={`rounded-2xl border p-4 text-left ${(data.sample !== false) === v ? 'border-primary bg-primary-soft/50 ring-4 ring-primary/10' : 'border-line'}`}>
                      <I size={18} className="mb-2 text-primary" /><div className="font-bold">{t}</div><div className="text-[12px] text-muted">{d}</div></button>))}</div>
                </section>
              </div>
            )}
            <div className="sticky bottom-0 z-10 mt-8 flex items-center gap-3 border-t border-line bg-bg/90 py-4 backdrop-blur">
              <button onClick={() => go(Math.max(0, step - 1))} disabled={step === 0} className="inline-flex items-center gap-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold disabled:opacity-40"><ChevronLeft size={16} />Back</button>
              <span className="flex-1" />
              {step < STEPS.length - 1 && step > 1 && <button onClick={() => go(step + 1)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink">Skip for now</button>}
              {step < STEPS.length - 1
                ? <button onClick={() => canNext && go(step + 1)} disabled={!canNext} className="inline-flex items-center gap-1.5 rounded-xl grad-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-50">Continue<ChevronRight size={16} /></button>
                : <button onClick={doLaunch} disabled={blockers.length > 0} className="inline-flex items-center gap-2 rounded-xl grad-primary px-6 py-3 text-[15px] font-bold text-white shadow-lg shadow-primary/25 disabled:opacity-50"><Rocket size={17} />Launch {data.org?.group || 'workspace'}</button>}
            </div>
            {step === 1 && !canNext && <p className="-mt-2 text-right text-[12px] text-muted">Add a business name and pick a country to continue.</p>}
          </main>
          <aside className="hidden xl:block"><div className="sticky top-8 rounded-3xl border border-line bg-surface-2/50 p-5">{preview()}</div></aside>
        </div>
      </div>
    </div>
  );
}

export { inputCls };
