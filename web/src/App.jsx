import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, ChefHat, Cctv, HeartHandshake, Users, Thermometer, BellRing, ShieldCheck, Plug, Sparkles, Menu, X, LogOut, Store, ChevronDown, FileBarChart, MonitorSmartphone, Boxes, CalendarClock, Landmark, PanelLeftClose, Gauge, Utensils, ConciergeBell, UsersRound, ShieldAlert, Settings2 } from 'lucide-react';
import { useAuth } from './lib/auth.jsx';
import { useConnection, useLive } from './lib/api.js';
import { Avatar } from './components/ui.jsx';
import ThemePicker from './components/ThemePicker.jsx';
import { TelegramButton } from './components/Telegram.jsx';
import Login from './pages/Login.jsx';
import AgentDrawer from './components/AgentDrawer.jsx';
import { api } from './lib/api.js';

// Pages load on demand so the first paint ships only the shell; the rest prefetch while the browser is idle.
const LOADERS = {
  Dashboard: () => import('./pages/Dashboard.jsx'),
  Kitchen: () => import('./pages/Kitchen.jsx'),
  Cameras: () => import('./pages/Cameras.jsx'),
  Guests: () => import('./pages/Guests.jsx'),
  Staff: () => import('./pages/Staff.jsx'),
  Safety: () => import('./pages/Safety.jsx'),
  Alerts: () => import('./pages/Alerts.jsx'),
  Team: () => import('./pages/Team.jsx'),
  Integrations: () => import('./pages/Integrations.jsx'),
  Agents: () => import('./pages/Agents.jsx'),
  Reports: () => import('./pages/Reports.jsx'),
  Pos: () => import('./pages/Pos.jsx'),
  Inventory: () => import('./pages/Inventory.jsx'),
  Reservations: () => import('./pages/Reservations.jsx'),
  Finance: () => import('./pages/Finance.jsx'),
  Onboarding: () => import('./onboarding/Onboarding.jsx'),
};
const Dashboard = lazy(LOADERS.Dashboard), Kitchen = lazy(LOADERS.Kitchen), Cameras = lazy(LOADERS.Cameras), Guests = lazy(LOADERS.Guests), Staff = lazy(LOADERS.Staff), Safety = lazy(LOADERS.Safety), Alerts = lazy(LOADERS.Alerts), Team = lazy(LOADERS.Team), Integrations = lazy(LOADERS.Integrations), Agents = lazy(LOADERS.Agents), Reports = lazy(LOADERS.Reports), Pos = lazy(LOADERS.Pos), Inventory = lazy(LOADERS.Inventory), Reservations = lazy(LOADERS.Reservations), Finance = lazy(LOADERS.Finance);
const Onboarding = lazy(LOADERS.Onboarding);
const Signup = lazy(() => LOADERS.Onboarding().then((m) => ({ default: m.Signup })));
const prefetchAll = () => Object.values(LOADERS).forEach((load) => load().catch(() => {}));

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-64 rounded-lg bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface-2" />)}</div>
      <div className="h-72 rounded-2xl bg-surface-2" />
    </div>
  );
}
const FullLoader = () => <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>;

// Which onboarding module each page belongs to (pages without one are always available)
const MODULE_OF = { '/pos': 'pos', '/kitchen': 'kds', '/inventory': 'inventory', '/reservations': 'reservations', '/vision': 'vision', '/guests': 'guests', '/staff': 'workforce', '/safety': 'safety', '/reports': 'reports', '/finance': 'finance', '/agents': 'agents' };
let enabledModules = null;
export const navAllowed = (n, can) => (!enabledModules || !MODULE_OF[n.to] || enabledModules.includes(MODULE_OF[n.to])) && (n.perm ? can(n.perm) : n.anyPerm.some(can));

export const NAV = [
  { group: 'overview', to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view', element: <Dashboard /> },
  { group: 'front', to: '/pos', label: 'Point of Sale', icon: MonitorSmartphone, perm: 'pos.bill', element: <Pos /> },
  { group: 'overview', to: '/agents', label: 'AI Agents', icon: Sparkles, anyPerm: ['sales.view', 'kitchen.view', 'vision.view', 'guests.view', 'reviews.view', 'staff.view', 'safety.view', 'alerts.view', 'dashboard.view'], element: <Agents /> },
  { group: 'kitchen', to: '/kitchen', label: 'Kitchen Operations', icon: ChefHat, perm: 'kitchen.view', element: <Kitchen /> },
  { group: 'kitchen', to: '/inventory', label: 'Inventory & Menu', icon: Boxes, anyPerm: ['inventory.manage', 'menu.manage'], element: <Inventory /> },
  { group: 'front', to: '/reservations', label: 'Reservations', icon: CalendarClock, perm: 'reservations.manage', element: <Reservations /> },
  { group: 'people', to: '/vision', label: 'Vision Intelligence', icon: Cctv, perm: 'vision.view', element: <Cameras /> },
  { group: 'front', to: '/guests', label: 'Guest Intelligence', icon: HeartHandshake, perm: 'guests.view', element: <Guests /> },
  { group: 'people', to: '/staff', label: 'Workforce', icon: Users, perm: 'staff.view', element: <Staff /> },
  { group: 'kitchen', to: '/safety', label: 'Food Safety & HACCP', icon: Thermometer, perm: 'safety.view', element: <Safety /> },
  { group: 'control', to: '/alerts', label: 'Alerts & Incidents', icon: BellRing, perm: 'alerts.view', element: <Alerts />, badge: true },
  { group: 'control', to: '/reports', label: 'Reports & Analytics', icon: FileBarChart, anyPerm: ['sales.view', 'kitchen.view', 'vision.view', 'safety.view', 'staff.view', 'reviews.view'], element: <Reports /> },
  { group: 'control', to: '/finance', label: 'Finance & Compliance', icon: Landmark, perm: 'finance.view', element: <Finance /> },
  { group: 'admin', to: '/team', label: 'Access Control', icon: ShieldCheck, perm: 'users.view', element: <Team /> },
  { group: 'admin', to: '/integrations', label: 'Integrations', icon: Plug, perm: 'integrations.manage', element: <Integrations /> },
];

// Main menu (groups) and sub menu (pages). Order follows the working day: overview → front of house → kitchen →
// people → control → admin. Groups collapse; the whole rail collapses to icons. Both choices are remembered.
export const GROUPS = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'front', label: 'Front of house', icon: ConciergeBell },
  { id: 'kitchen', label: 'Kitchen & supply', icon: Utensils },
  { id: 'people', label: 'People & vision', icon: UsersRound },
  { id: 'control', label: 'Control & reporting', icon: ShieldAlert },
  { id: 'admin', label: 'Administration', icon: Settings2 },
];
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked */ } } };

const EASE = 'duration-300 ease-[cubic-bezier(.32,.72,0,1)]';
// Animates open/close by height (grid 0fr to 1fr) with a fade; closed content is inert so it cannot take focus
function Collapse({ open, children }) {
  return (
    <div className={`grid transition-[grid-template-rows,opacity] ${EASE} ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!open}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Sidebar({ onNavigate, collapsed = false, onToggle }) {
  const { can, user, group, branches } = useAuth();
  const { pathname } = useLocation();
  const { data: alerts } = useLive(can('alerts.view') ? '/alerts?status=open&limit=500' : null, { types: ['alert'], interval: 30000 });
  const [closed, setClosed] = useState(() => store.get('nav-closed', []));
  const [tip, setTip] = useState(null); // instant label flyout for the icon rail (fixed, so the scrolling nav can't clip it)
  const showTip = (label) => (e) => { if (!collapsed) return; const r = e.currentTarget.getBoundingClientRect(); setTip({ label, top: r.top + r.height / 2, left: r.right + 12 }); };
  const hideTip = () => setTip(null);
  const items = NAV.filter((n) => navAllowed(n, can));
  const toggleGroup = (id) => { const next = closed.includes(id) ? closed.filter((x) => x !== id) : [...closed, id]; setClosed(next); store.set('nav-closed', next); };
  const scope = user.branches.length > 1 ? `${user.branches.length} branches` : branches.find((b) => b.id === user.branches[0])?.name || '1 branch';
  const fade = collapsed ? 'opacity-0' : 'opacity-100 delay-75';
  const count = alerts?.length > 99 ? '99+' : alerts?.length;
  // Icons sit at the same x in both states (nav px-2 + link pl-[18px]), so only the width, labels and headers move
  const link = ({ to, label, icon: Icon, badge }) => (
    <NavLink key={to} to={to} end={to === '/'} onClick={() => { hideTip(); onNavigate?.(); }} aria-label={collapsed ? label : undefined}
      onMouseEnter={showTip(label)} onMouseLeave={hideTip} onFocus={showTip(label)} onBlur={hideTip}
      className={({ isActive }) => `group relative flex h-10 items-center gap-3 overflow-hidden rounded-xl pr-2.5 pl-[18px] text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 ${isActive ? 'bg-side-2 text-white shadow-[inset_3px_0_0_var(--primary)]' : 'text-side-muted hover:bg-side-2/60 hover:text-white'}`}>
      <span className="grid w-5 shrink-0 place-items-center transition-transform duration-200 group-hover:scale-110"><Icon size={17} strokeWidth={2} /></span>
      <span className={`min-w-0 flex-1 truncate transition-opacity duration-200 ${fade}`}>{label}</span>
      {badge && alerts?.length > 0 && <>
        <span className={`rounded-full bg-bad px-1.5 py-px text-[10px] font-bold text-white tnum transition-opacity duration-200 ${fade}`}>{count}</span>
        <span className={`absolute top-1.5 left-[33px] h-2 w-2 rounded-full bg-bad ring-2 ring-side transition-opacity duration-200 ${collapsed ? 'opacity-100' : 'opacity-0'}`} />
      </>}
    </NavLink>
  );
  return (
    <div className="flex h-full flex-col overflow-hidden bg-side text-side-ink">
      <div className={`relative shrink-0 transition-[height] ${EASE} ${collapsed ? 'h-[108px]' : 'h-[76px]'}`}>
        <img src="/favicon.svg" alt="" className="absolute top-5 left-[18px] h-9 w-9" />
        <div className={`absolute top-5 right-12 left-[66px] whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'pointer-events-none opacity-0' : 'opacity-100 delay-100'}`}>
          <div className="text-[16px] leading-none font-extrabold tracking-tight text-white">OutletOS</div><div className="mt-1 truncate text-[11px] text-side-muted">{group}</div>
        </div>
        {onToggle && <button onClick={() => { hideTip(); onToggle(); }} style={{ top: collapsed ? 64 : 23, left: collapsed ? 21 : 211 }}
          className={`absolute rounded-lg p-1.5 text-side-muted transition-[top,left,background-color,color] hover:bg-side-2 hover:text-white ${EASE}`} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
          <PanelLeftClose size={17} className={`transition-transform ${EASE} ${collapsed ? 'rotate-180' : ''}`} />
        </button>}
      </div>
      <nav className={`nav-scroll flex-1 overflow-x-hidden overflow-y-auto px-2 pb-3 ${collapsed ? 'nav-scroll-hidden' : ''}`} aria-label="Main" onScroll={hideTip}>
        {GROUPS.map((g, gi) => {
          const list = items.filter((n) => n.group === g.id);
          if (!list.length) return null;
          const open = !closed.includes(g.id) || list.some((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));
          return (
            <div key={g.id} className="mb-1">
              <Collapse open={!collapsed}>
                <button onClick={() => toggleGroup(g.id)} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg pt-2.5 pr-3 pb-1.5 pl-[22px] text-[10.5px] font-bold tracking-[.12em] whitespace-nowrap text-side-muted/80 uppercase transition-colors hover:text-white">
                  <g.icon size={12} className="shrink-0" /><span className="flex-1 text-left">{g.label}</span>
                  <ChevronDown size={13} className={`transition-transform ${EASE} ${open ? '' : '-rotate-90'}`} />
                </button>
              </Collapse>
              {gi > 0 && <div className={`mx-auto h-px bg-side-2 transition-all ${EASE} ${collapsed ? 'my-1.5 w-8 opacity-100' : 'my-0 w-0 opacity-0'}`} />}
              <Collapse open={collapsed || open}><div className="space-y-0.5 pb-0.5">{list.map(link)}</div></Collapse>
            </div>
          );
        })}
      </nav>
      {tip && <div role="tooltip" className="tip-in pointer-events-none fixed z-50 -translate-y-1/2 rounded-lg bg-side-2 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-lg ring-1 ring-white/10" style={{ top: tip.top, left: tip.left }}>{tip.label}</div>}
      <Collapse open={!collapsed}>
        <div className="m-3 mt-0 rounded-xl bg-side-2 p-3 text-xs whitespace-nowrap">
          <div className="font-semibold text-white">{user.roleLabel}</div>
          <div className="mt-0.5 truncate text-side-muted">{scope}{user.station ? ` · ${user.station} station` : ''}</div>
        </div>
      </Collapse>
    </div>
  );
}

function BranchPicker() {
  const { branches, branch, setBranch } = useAuth();
  if (branches.length <= 1) {
    const b = branches[0];
    return b ? <span className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold sm:inline-flex"><Store size={15} className="text-primary" />{b.name} · {b.city}</span> : null;
  }
  return (
    <label className="relative inline-flex min-w-0 items-center">
      <Store size={15} className="pointer-events-none absolute left-3 text-primary" />
      <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch"
        className="w-full max-w-[170px] min-w-0 appearance-none truncate rounded-xl border border-line bg-surface py-2 pr-8 pl-9 text-sm font-semibold outline-none focus:border-primary sm:max-w-none sm:pr-9">
        <option value="all">All branches ({branches.length})</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.city}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 text-muted" />
    </label>
  );
}

function TopBar({ onMenu }) {
  const { user, logout } = useAuth();
  const live = useConnection();
  return (
    <header className="sticky top-0 z-30 flex print:hidden items-center gap-2 border-b border-line bg-bg/85 px-3 py-3 backdrop-blur sm:gap-3 sm:px-8">
      <button onClick={onMenu} className="rounded-lg p-2 hover:bg-surface-2 lg:hidden" aria-label="Open menu"><Menu size={18} /></button>
      <BranchPicker />
      <span className="ml-1 hidden items-center gap-1.5 text-xs font-medium text-muted md:inline-flex">
        <span className={`h-2 w-2 rounded-full ${live ? 'live-dot bg-ok' : 'bg-bad'}`} />{live ? 'Live' : 'Reconnecting…'}
      </span>
      <div className="flex-1" />
      <TelegramButton />
      <ThemePicker />
      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface py-1 pr-1 pl-1.5 sm:gap-2.5">
        <Avatar name={user.name} size={30} />
        <div className="hidden pr-1 leading-tight sm:block">
          <div className="text-[13px] font-bold">{user.name}</div>
          <div className="text-[11px] text-muted">{user.roleLabel}</div>
        </div>
        <button onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Sign out" title="Sign out"><LogOut size={15} /></button>
      </div>
    </header>
  );
}

export default function App() {
  const { user, loading, can, setup, modules } = useAuth();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(() => store.get('nav-rail', false));
  const toggleRail = () => { setRail(!rail); store.set('nav-rail', !rail); };
  const [status, setStatus] = useState(null);
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { if (!user) return; const t = setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(prefetchAll, { timeout: 4000 }) : prefetchAll()), 1500); return () => clearTimeout(t); }, [user]);
  useEffect(() => { if (!user && !loading) api('/setup/status').then(setStatus).catch(() => setStatus({})); }, [user, loading]);
  enabledModules = modules || null;

  if (loading || (!user && !status)) return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>;
  if (!user) return status?.needs_owner ? <Suspense fallback={<FullLoader />}><Signup onDone={() => window.location.reload()} /></Suspense> : <Login />;
  if (setup && setup.status !== 'complete') {
    return user.role === 'owner' ? <Suspense fallback={<FullLoader />}><Onboarding user={user} onComplete={() => window.location.assign('/')} /></Suspense>
      : <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">Your workspace is still being set up by the owner. Please check back soon.</div>;
  }
  const allowed = NAV.filter((n) => navAllowed(n, can));
  const home = allowed[0]?.to ?? '/';

  return (
    <div className={`min-h-full lg:grid lg:transition-[grid-template-columns] ${EASE} ${rail ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[256px_minmax(0,1fr)]'} print:block`}>
      <a href="#main" className="skip-link rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-lg print:hidden">Skip to main content</a>
      <aside className="sticky top-0 hidden h-screen overflow-hidden lg:block print:hidden"><Sidebar collapsed={rail} onToggle={toggleRail} /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="drawer-in absolute inset-y-0 left-0 w-72 shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-6 z-10 rounded-lg p-2 text-side-ink hover:bg-side-2" aria-label="Close menu"><X size={18} /></button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-w-0">
        <TopBar onMenu={() => setOpen(true)} />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1500px] px-4 py-6 outline-none sm:px-8 sm:py-8">
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {allowed.map((n) => <Route key={n.to} path={n.to} element={n.element} />)}
              <Route path="*" element={<Navigate to={home} replace />} />
            </Routes>
          </Suspense>
        </main>
        {pathname !== '/pos' && <div className="print:hidden"><AgentDrawer /></div>}
      </div>
    </div>
  );
}
