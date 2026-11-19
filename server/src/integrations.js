// No-code integration layer: canonical schemas, JSON field-mapping for any webhook, CSV parsing.

export const SCHEMAS = {
  orders: {
    endpoint: 'POST /api/v1/orders',
    fields: { outlet_id: 'string*', total: 'number (or items)', items: '[{item_id, qty, price}]', channel: 'dine-in | takeaway | delivery | online', platform: 'POS | Uber Eats | Swiggy | …', payment: 'card | cash | wallet | prepaid', covers: 'int', guest_id: 'string', table_no: 'string', external_id: 'string', closed_at: 'epoch ms' },
    example: { outlet_id: 'r1', channel: 'delivery', platform: 'Uber Eats', items: [{ item_id: 'margherita', qty: 2 }, { item_id: 'lime_soda', qty: 1 }] },
  },
  attendance: {
    endpoint: 'POST /api/v1/attendance',
    fields: { staff_id: 'string (or external_id)', external_id: 'device employee code', action: 'in | out', method: 'face | biometric | mobile-geo | camera', ts: 'epoch ms' },
    example: { external_id: 'EMP-R1-103', action: 'in', method: 'face' },
  },
  vision: {
    endpoint: 'POST /api/v1/vision',
    fields: { outlet_id: 'string*', camera_id: 'string', type: 'station | hairnet | gloves | handwash | apron | phone | spill | access | greeted | guest | person', ok: 'boolean', confidence: '0-1', people: 'int', ts: 'epoch ms' },
    example: { outlet_id: 'r1', camera_id: 'r1-hotline', type: 'gloves', ok: false, confidence: 0.93, people: 2 },
  },
  readings: {
    endpoint: 'POST /api/v1/readings',
    fields: { sensor_id: 'string*', value: 'number*', ts: 'epoch ms' },
    example: { sensor_id: 'r1-walkin', value: 3.1 },
  },
  guest_visits: {
    endpoint: 'POST /api/v1/guest-visits',
    fields: { outlet_id: 'string*', guest_id: 'string (or phone)', method: 'face (opt-in only) | loyalty-qr | phone | reservation', table_no: 'string', covers: 'int' },
    example: { outlet_id: 'r1', guest_id: 'g1000', method: 'loyalty-qr', table_no: 'T4', covers: 2 },
  },
  reviews: {
    endpoint: 'POST /api/v1/reviews',
    fields: { outlet_id: 'string*', rating: '1-5*', platform: 'string', author: 'string', text: 'string' },
    example: { outlet_id: 'r2', rating: 5, platform: 'Google', author: 'A. Guest', text: 'Sublime.' },
  },
};

// Starter mappings. Field paths are illustrative and must be checked against each vendor's live payload.
export const TEMPLATES = [
  {
    name: 'Generic POS (nested JSON)', target: 'orders',
    mapping: { _each: 'orders', outlet_id: { path: 'location.code', map: { 'PARIS-01': 'r1', 'LDN-01': 'r2' } }, total: 'totals.grand', covers: 'guests', table_no: 'table.name', external_id: 'id', closed_at: { path: 'closed_at', date: true } },
    sample: { orders: [{ id: 'A-1001', location: { code: 'NYC-01' }, totals: { grand: 1820 }, guests: 4, table: { name: 'T3' }, closed_at: '2026-11-18T13:05:00Z' }] },
  },
  {
    name: 'Amount in minor units (cents/paise)', target: 'orders',
    mapping: { outlet_id: '=r1', total: { path: 'order.total_money.amount', multiply: 0.01 }, external_id: 'order.id', covers: 'order.guest_count' },
    sample: { order: { id: 'ord_9X', total_money: { amount: 189000, currency: 'USD' }, guest_count: 4 } },
  },
  {
    name: 'Biometric / face terminal punch', target: 'attendance',
    mapping: { external_id: 'EmpCode', action: { path: 'Direction', map: { IN: 'in', OUT: 'out' } }, method: '=biometric', ts: { path: 'PunchTime', date: true } },
    sample: { EmpCode: 'EMP-R1-103', Direction: 'IN', PunchTime: '2026-11-18T09:58:00Z' },
  },
  {
    name: 'IoT gateway (temperature)', target: 'readings',
    mapping: { _each: 'readings', sensor_id: 'device', value: 'temp_c' },
    sample: { readings: [{ device: 'r1-walkin', temp_c: 3.2 }, { device: 'r1-freezer', temp_c: -19.1 }] },
  },
];

const getPath = (obj, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj);

function resolveField(src, spec) {
  if (typeof spec === 'string') return spec.startsWith('=') ? spec.slice(1) : getPath(src, spec);
  if (spec && typeof spec === 'object') {
    let v = spec.const !== undefined ? spec.const : getPath(src, spec.path);
    if (v === undefined && spec.default !== undefined) v = spec.default;
    if (spec.map) v = v != null ? spec.map[v] ?? spec.map['*'] ?? v : spec.map['*'];
    if (spec.multiply && v != null) v = Number(v) * spec.multiply;
    if (spec.date && v != null) v = typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v);
    return v;
  }
  return undefined;
}

export function applyMapping(payload, mapping) {
  const { _each, ...fields } = mapping;
  const items = _each ? getPath(payload, _each) : payload;
  const list = Array.isArray(items) ? items : [items];
  return list.map((src) => {
    const out = {};
    for (const [k, spec] of Object.entries(fields)) {
      const v = resolveField(src, spec);
      if (v !== undefined) out[k] = v;
    }
    return out;
  });
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  const [header, ...data] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]?.trim()]).filter(([, v]) => v !== '' && v !== undefined)));
}
