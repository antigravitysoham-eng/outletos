import { useMemo, useState } from 'react';
import { UserCheck, Clock, UserX, CalendarClock, DollarSign } from 'lucide-react';
import { useLive, clock, money } from '../lib/api.js';
import { useBranchQuery } from '../lib/auth.jsx';
import { Card, PageHeader, MiniStat, Badge, Select, Loading, ErrorNote, Avatar } from '../components/ui.jsx';
import Staffing from '../components/Staffing.jsx';

const TONE = { 'on shift': 'ok', late: 'warn', absent: 'bad', due: 'warn', later: 'muted', finished: 'muted' };
const METHOD = { face: 'Face ID', biometric: 'Fingerprint', 'mobile-geo': 'Mobile GPS', camera: 'Camera' };

export default function Staff() {
  const q = useBranchQuery();
  const { data, error } = useLive(`/people?${q}`, { types: ['attendance'], interval: 30000 });
  const { data: staffing } = useLive(`/staffing?${q}`, { types: ['attendance', 'order'], throttle: 15000, interval: 60000 });
  const [dept, setDept] = useState('all');
  const [status, setStatus] = useState('all');
  const rows = useMemo(() => (data || []).filter((s) => (dept === 'all' || s.department === dept) && (status === 'all' || s.status === status)), [data, dept, status]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <><PageHeader title="Workforce" /><Loading /></>;
  const c = (st) => data.filter((s) => s.status === st).length;
  const showPay = data.length > 0 && 'hourly_rate' in data[0];
  const labour = data.reduce((a, s) => a + (s.cost || 0), 0);

  return (
    <>
      <PageHeader title="Workforce" subtitle="Clock-ins from face terminals, fingerprint readers and geofenced phones, checked against the rota. Late arrivals and no-shows raise alerts automatically." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MiniStat label="On shift" value={c('on shift') + c('late')} icon={UserCheck} tone="ok" />
        <MiniStat label="Arrived late" value={c('late')} icon={Clock} tone={c('late') ? 'warn' : undefined} />
        <MiniStat label="No-show" value={c('absent')} icon={UserX} tone={c('absent') ? 'bad' : undefined} />
        <MiniStat label="Starting later" value={c('later') + c('due')} icon={CalendarClock} tone="info" />
        {showPay && <MiniStat label="Labour cost today" value={money(labour)} icon={DollarSign} tone="primary" />}
      </div>
      {staffing && <div className="mt-4"><Staffing s={staffing} /></div>}
      <Card className="mt-4" pad={false} title={`${rows.length} people`}
        action={<div className="flex flex-wrap gap-2">
          <Select value={dept} onChange={setDept} options={[{ value: 'all', label: 'All teams' }, ...[...new Set(data.map((s) => s.department))].map((d) => ({ value: d, label: d }))]} />
          <Select value={status} onChange={setStatus} options={['all', 'on shift', 'late', 'absent', 'due', 'later', 'finished'].map((v) => ({ value: v, label: v === 'all' ? 'Any status' : v }))} />
        </div>}>
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[880px] text-[13px] [&_td]:pr-3 [&_td]:whitespace-nowrap [&_th]:pr-3">
            <thead><tr className="text-left text-xs font-semibold text-muted">
              <th className="py-2">Name</th><th>Role</th><th>Branch</th><th>Shift</th><th>Clocked in</th><th>How</th><th>Hours</th>{showPay && <th>Cost</th>}<th className="text-right">Status</th>
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={28} color={s.department === 'Kitchen' ? '#FF8A3D' : s.department === 'Management' ? '#5B4CFA' : '#0BA5EC'} /><span className="font-semibold">{s.name}</span></div></td>
                  <td className="text-muted">{s.role} · {s.station}</td>
                  <td>{s.branch}</td>
                  <td className="tnum text-muted">{clock(s.due)}–{clock(s.end)}</td>
                  <td className="tnum">{s.ts_in ? clock(s.ts_in) : '—'}{s.late_min >= 10 && <span className="ml-1 text-[11px] font-semibold text-warn">+{s.late_min}m</span>}</td>
                  <td className="text-muted">{METHOD[s.method] ?? '—'}</td>
                  <td className="tnum text-muted">{s.hours ? s.hours.toFixed(1) : '—'}</td>
                  {showPay && <td className="tnum">{s.cost ? money(s.cost, { compact: false }) : '—'}</td>}
                  <td className="text-right"><Badge tone={TONE[s.status]} className="capitalize">{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
