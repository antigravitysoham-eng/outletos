import { useState } from 'react';
import { Check, Minus, UserPlus, ShieldCheck } from 'lucide-react';
import { useLive, api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, PageHeader, Badge, Button, Avatar, Loading, ErrorNote } from '../components/ui.jsx';

const ROLE_COLORS = { owner: '#D92D3A', area_manager: '#0BA5EC', branch_manager: '#12B76A', head_chef: '#FF8A3D', chef: '#F5B300', host: '#E8488A', auditor: '#2ED3B7', it_admin: '#667085' };
const ABAC_NOTES = {
  owner: 'All branches', area_manager: 'Only branches assigned to them (e.g. a region)', branch_manager: 'Only their branch',
  head_chef: 'Their branch · kitchen staff only · no sales or costs', chef: 'Their branch · their station’s tickets only',
  host: 'Their branch · guest phone numbers masked', auditor: 'All branches · read-only', it_admin: 'No business data',
};
const STATIONS = ['Grill', 'Fry', 'Pizza', 'Hot Line', 'Cold', 'Dessert', 'Bar'];

function AddUser({ roles, onDone }) {
  const { branches } = useAuth();
  const [f, setF] = useState({ name: '', username: '', role: 'branch_manager', branches: [], station: 'Grill', password: '' });
  const [err, setErr] = useState('');
  const role = roles.find((r) => r.id === f.role);
  const save = async () => {
    setErr('');
    try { await api('/team', { method: 'POST', body: f }); setF({ ...f, name: '', username: '', password: '', branches: [] }); onDone(); } catch (e) { setErr(e.message); }
  };
  const input = 'rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary';
  return (
    <Card title="Add a team member" subtitle="Pick a role (what they can do) and branches (where they can do it)">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input className={input} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={input} placeholder="Username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <select className={input} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <input className={input} placeholder="Temporary password (8+ chars)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </div>
      {role?.scope === 'assigned' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {branches.map((b) => {
            const on = f.branches.includes(b.id);
            return <button key={b.id} onClick={() => setF({ ...f, branches: on ? f.branches.filter((x) => x !== b.id) : [...f.branches, b.id] })}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${on ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}>{b.name} · {b.city}</button>;
          })}
        </div>
      )}
      {f.role === 'chef' && (
        <div className="mt-3 flex flex-wrap gap-2">{STATIONS.map((s) => <button key={s} onClick={() => setF({ ...f, station: s })} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${f.station === s ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}>{s}</button>)}</div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" onClick={save}><UserPlus size={15} /> Add member</Button>
        {err && <span className="text-sm text-bad">{err}</span>}
        {role && <span className="text-xs text-muted">{role.description}</span>}
      </div>
    </Card>
  );
}

export default function Team() {
  const { can, user, branchName } = useAuth();
  const { data, error, reload } = useLive('/team', { types: [] });
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><PageHeader title="Access Control" /><Loading /></>;
  const perms = Object.entries(data.permissions);
  const toggle = async (u) => { await api(`/team/${u.id}`, { method: 'PATCH', body: { active: !u.active } }); reload(); };

  return (
    <>
      <PageHeader title="Access Control"
        subtitle="Role-based access decides what each person can do. Attribute rules decide where and on what: their branches, their station, their team. Both are enforced on the server for every request and every live update." />
      {can('users.manage') && <div className="mb-4"><AddUser roles={data.roles} onDone={reload} /></div>}

      <Card title={`${data.users.length} team members`} pad={false}>
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="text-left text-xs font-semibold text-muted"><th className="py-2">Person</th><th>Role</th><th>Branches</th><th>Extra scope</th><th className="text-right">Status</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t border-line">
                  <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={u.name} size={30} color={ROLE_COLORS[u.role]} /><div><div className="font-semibold">{u.name}</div><div className="text-xs text-muted">@{u.username}</div></div></div></td>
                  <td><span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: `color-mix(in srgb, ${ROLE_COLORS[u.role]} 15%, transparent)`, color: ROLE_COLORS[u.role] }}>{u.roleLabel}</span></td>
                  <td className="text-muted">{u.branches === '*' ? 'All branches' : u.branches.split(',').map(branchName).join(', ')}</td>
                  <td className="text-muted">{u.station ? `${u.station} station` : ABAC_NOTES[u.role]?.split('·').slice(1).join('·') || '—'}</td>
                  <td className="text-right">{can('users.manage') && u.id !== user.id
                    ? <button onClick={() => toggle(u)}><Badge tone={u.active ? 'ok' : 'muted'}>{u.active ? 'Active' : 'Disabled'}</Badge></button>
                    : <Badge tone={u.active ? 'ok' : 'muted'}>{u.active ? 'Active' : 'Disabled'}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4" title="What each role can do" subtitle="RBAC permission matrix, plus the attribute rules (ABAC) applied on top" action={<ShieldCheck size={18} className="text-primary" />} pad={false}>
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[860px] table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted">
                <th className="w-[210px] py-2 pr-3">Permission</th>
                {data.roles.map((r) => <th key={r.id} className="px-1 text-center"><span className="inline-block rounded-md px-1.5 py-0.5 font-bold" style={{ color: ROLE_COLORS[r.id] }}>{r.label}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {perms.map(([p, desc]) => (
                <tr key={p} className="border-t border-line">
                  <td className="py-2 pr-3"><div className="font-semibold">{desc}</div><div className="font-mono text-[10.5px] text-faint">{p}</div></td>
                  {data.roles.map((r) => <td key={r.id} className="text-center">{r.perms.includes(p) ? <Check size={16} className="mx-auto text-ok" strokeWidth={3} /> : <Minus size={14} className="mx-auto text-line" />}</td>)}
                </tr>
              ))}
              <tr className="border-t-2 border-line bg-surface-2/60">
                <td className="py-2.5 pr-3 font-bold">Scope rules (ABAC)</td>
                {data.roles.map((r) => <td key={r.id} className="px-1 py-2.5 text-center text-[11px] leading-snug text-muted">{ABAC_NOTES[r.id]}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
