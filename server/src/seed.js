import { randomBytes, scryptSync } from 'node:crypto';
import { db, tx, getSetting, setSetting } from './db.js';
import { INSTANCE as I } from './instance.js';

// Budgeted net sales per day (set by finance) and the fully-loaded labour multiplier (wages + benefits + payroll taxes)
export const DAILY_TARGET = I.dailyTarget || { r1: 23000, r2: 20000, r3: 16000, r4: 22500, r5: 26000, r6: 18000 };
const LOADING = I.loading || 1.6;

const GLOBAL_BRANCHES = [
  { id: 'r1', name: 'Restaurant 1', location: 'Downtown', city: 'New York', country: 'USA', region: 'Americas & Europe', seats: 90, manager: 'Maya Chen', platforms: ['Uber Eats', 'DoorDash', 'Website'] },
  { id: 'r2', name: 'Restaurant 2', location: 'Soho', city: 'London', country: 'UK', region: 'Americas & Europe', seats: 72, manager: 'James Walker', platforms: ['Deliveroo', 'Uber Eats', 'Website'] },
  { id: 'r3', name: 'Restaurant 3', location: 'Le Marais', city: 'Paris', country: 'France', region: 'Americas & Europe', seats: 64, manager: 'Camille Laurent', platforms: ['Uber Eats', 'Deliveroo', 'Website'] },
  { id: 'r4', name: 'Restaurant 4', location: 'Dubai Marina', city: 'Dubai', country: 'UAE', region: 'Middle East & Asia', seats: 110, manager: 'Omar Haddad', platforms: ['Talabat', 'Deliveroo', 'Website'] },
  { id: 'r5', name: 'Restaurant 5', location: 'Bandra', city: 'Mumbai', country: 'India', region: 'Middle East & Asia', seats: 96, manager: 'Priya Nair', platforms: ['Swiggy', 'Zomato', 'Website'] },
  { id: 'r6', name: 'Restaurant 6', location: 'Orchard', city: 'Singapore', country: 'Singapore', region: 'Middle East & Asia', seats: 68, manager: 'Wei Ling Tan', platforms: ['GrabFood', 'foodpanda', 'Website'] },
];

// [id, name, category, price, station, prep_sec, tags, is_new]
export const GLOBAL_MENU = [
  ['calamari', 'Crispy Calamari', 'Starters', 12, 'Fry', 420, 'seafood,gluten'],
  ['burrata', 'Burrata & Heirloom Tomato', 'Starters', 14, 'Cold', 300, 'dairy,veg'],
  ['wings', 'Smoky Chicken Wings', 'Starters', 11, 'Fry', 480, ''],
  ['caesar', 'Caesar Salad', 'Starters', 12, 'Cold', 300, 'dairy,gluten'],
  ['salmon', 'Grilled Salmon', 'Mains', 26, 'Grill', 780, 'fish'],
  ['ribeye', 'Ribeye Steak', 'Mains', 34, 'Grill', 900, ''],
  ['burger', 'Classic Smash Burger', 'Mains', 17, 'Grill', 600, 'gluten,dairy'],
  ['tikka', 'Chicken Tikka Bowl', 'Mains', 18, 'Hot Line', 600, 'dairy'],
  ['truffle_pasta', 'Truffle Mushroom Pasta', 'Mains', 22, 'Hot Line', 660, 'dairy,gluten,veg'],
  ['paneer', 'Paneer Butter Masala', 'Mains', 16, 'Hot Line', 600, 'dairy,veg,nuts'],
  ['green_curry', 'Thai Green Curry', 'Mains', 19, 'Hot Line', 600, 'nuts'],
  ['risotto', 'Wild Mushroom Risotto', 'Mains', 21, 'Hot Line', 720, 'dairy,veg', 1],
  ['margherita', 'Margherita Pizza', 'Pizza', 15, 'Pizza', 540, 'gluten,dairy,veg'],
  ['pepperoni', 'Pepperoni Pizza', 'Pizza', 17, 'Pizza', 540, 'gluten,dairy'],
  ['funghi', 'Truffle Funghi Pizza', 'Pizza', 19, 'Pizza', 600, 'gluten,dairy,veg'],
  ['fries', 'Truffle Fries', 'Sides', 8, 'Fry', 300, 'veg'],
  ['lava', 'Chocolate Lava Cake', 'Desserts', 10, 'Dessert', 540, 'gluten,dairy'],
  ['tiramisu', 'Tiramisu', 'Desserts', 9, 'Dessert', 180, 'dairy,gluten'],
  ['kulfi', 'Pistachio Kulfi', 'Desserts', 8, 'Dessert', 120, 'nuts,dairy'],
  ['cheesecake', 'Basque Cheesecake', 'Desserts', 10, 'Dessert', 150, 'dairy', 1],
  ['lime_soda', 'Fresh Lime Soda', 'Drinks', 5, 'Bar', 90, 'veg'],
  ['cold_brew', 'Cold Brew Coffee', 'Drinks', 6, 'Bar', 60, 'veg'],
  ['lassi', 'Mango Lassi', 'Drinks', 6, 'Bar', 90, 'dairy,veg'],
  ['lemonade', 'Craft Lemonade', 'Drinks', 5, 'Bar', 90, 'veg'],
  ['red_wine', 'House Red Wine', 'Drinks', 11, 'Bar', 45, 'veg'],
  ['mocktail', 'Passionfruit Mocktail', 'Drinks', 8, 'Bar', 120, 'veg'],
];

// [role, department, station, $/h, shift start (min after midnight), shift end]
const GLOBAL_STAFF = [
  ['Branch Manager', 'Management', 'Floor', 38, 600, 1200], ['Head Chef', 'Kitchen', 'Pass', 36, 570, 1170],
  ['Sous Chef', 'Kitchen', 'Hot Line', 29, 960, 1440], ['Grill Chef', 'Kitchen', 'Grill', 24, 600, 1080],
  ['Grill Chef', 'Kitchen', 'Grill', 24, 1020, 1440], ['Fry Cook', 'Kitchen', 'Fry', 20, 600, 1080],
  ['Pizza Chef', 'Kitchen', 'Pizza', 22, 660, 1140], ['Cold Station Cook', 'Kitchen', 'Cold', 20, 600, 1080],
  ['Pastry Cook', 'Kitchen', 'Dessert', 22, 720, 1200], ['Bartender', 'Front of House', 'Bar', 21, 960, 1440],
  ['Host', 'Front of House', 'Entrance', 19, 660, 1140], ['Server', 'Front of House', 'Floor', 17, 660, 1140],
  ['Server', 'Front of House', 'Floor', 17, 1020, 1440], ['Server', 'Front of House', 'Floor', 17, 1020, 1440],
  ['Packing Associate', 'Kitchen', 'Packing', 17, 660, 1200], ['Dishwasher', 'Kitchen', 'Dish', 16, 720, 1260],
  ['Night Line Cook', 'Kitchen', 'Hot Line', 22, 0, 600], ['Night Packer', 'Kitchen', 'Packing', 18, 0, 600],
];

const GLOBAL_FIRST = ['Aarav', 'Sofia', 'Liam', 'Aisha', 'Noah', 'Mei', 'Lucas', 'Zara', 'Ethan', 'Hana', 'Mateo', 'Priya', 'Leo', 'Yuki', 'Omar', 'Chloe', 'Ravi', 'Ines', 'Theo', 'Sara', 'Diego', 'Nora', 'Felix', 'Lina', 'Kenji', 'Amara', 'Jonas', 'Elena', 'Tariq', 'Maya', 'Arjun', 'Emma', 'Hugo', 'Layla', 'Daniel', 'Anika', 'Ryan', 'Fatima', 'Oscar', 'Isla'];
const GLOBAL_LAST = ['Patel', 'Rossi', 'Kim', 'Khan', 'Laurent', 'Silva', 'Nair', 'Weber', 'Tanaka', 'Haddad', 'Moreau', 'Iyer', 'Fischer', 'Costa', 'Lim', 'Novak', 'Rahman', 'Bernard', 'Ortiz', 'Mori', 'Brown', 'Singh', 'Garcia', 'Chen', 'Dubois', 'Ahmed', 'Wilson', 'Kapoor'];

export const BRANCHES = I.branches || GLOBAL_BRANCHES;
export const MENU = I.menu || GLOBAL_MENU;
const STAFF = I.staff || GLOBAL_STAFF;
const FIRST = I.first || GLOBAL_FIRST;
const LAST = I.last || GLOBAL_LAST;

export const CAMERAS = [
  ['entrance', 'Entrance', 'entrance'], ['hotline', 'Hot Line', 'kitchen'], ['grill', 'Grill & Fry', 'kitchen'],
  ['pass', 'Pass & Packing', 'pass'], ['store', 'Cold Store', 'storage'], ['dining', 'Dining Room', 'front'],
];
export const SENSORS = [
  ['walkin', 'Walk-in Cooler', 'temperature', '°C', 0, 5, 2.8], ['freezer', 'Freezer', 'temperature', '°C', -24, -16, -19.5],
  ['prep', 'Prep Fridge', 'temperature', '°C', 1, 5, 3.2], ['dessert', 'Dessert Chiller', 'temperature', '°C', 1, 6, 3.6],
  ['bar', 'Bar Fridge', 'temperature', '°C', 2, 7, 4.4], ['humid', 'Dry Store Humidity', 'humidity', '%', 35, 65, 50],
];

// Demo accounts for local development only. Password for all: demo1234
export const DEMO_PASSWORD = 'demo1234';
const GLOBAL_USERS = [
  ['owner', 'Olivia Bennett', 'owner', '*', null],
  ['area.east', 'Arjun Mehta', 'area_manager', 'r4,r5,r6', null],
  ['manager.r1', 'Maya Chen', 'branch_manager', 'r1', null],
  ['manager.r5', 'Priya Nair', 'branch_manager', 'r5', null],
  ['chef.r1', 'Marco Rossi', 'head_chef', 'r1', null],
  ['cook.r1', 'Leo Garcia', 'chef', 'r1', 'Grill'],
  ['host.r1', 'Sara Kim', 'host', 'r1', null],
  ['auditor', 'Nora Fischer', 'auditor', '*', null],
  ['it.admin', 'Sam Okafor', 'it_admin', '*', null],
  ['cashier.r1', 'Ella Brooks', 'cashier', 'r1', null],
];
export const DEMO_USERS = GLOBAL_USERS.map(([u, name, role, br, st]) => [u, I.users?.[u] || name, role, u === 'area.east' && I.areaBranches ? I.areaBranches : br, st && I.cookStation ? I.cookStation : st]);

export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
}

// Deterministic pseudo-random so the guest book is stable across resets
let s = 42;
const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];

export function seedReference() {
  if (I.blank) return false; // a fresh workspace is configured by its owner in onboarding
  if (db.prepare('SELECT COUNT(*) c FROM outlets').get().c > 0) {
    // One-off calibration of databases seeded before budgets existed (rates were loaded x3, targets were seats x 95)
    if (getSetting('calibration', 0) < 2) {
      tx(() => {
        for (const [id, v] of Object.entries(DAILY_TARGET)) db.prepare('UPDATE outlets SET daily_target = ? WHERE id = ?').run(v, id);
        db.prepare(`UPDATE staff SET hourly_rate = ROUND(hourly_rate / 3.0 * ${LOADING}, 2)`).run();
        setSetting('calibration', 2);
      });
    }
    // demo accounts added in later versions
    const hash = hashPassword(DEMO_PASSWORD);
    for (const [username, name, role, branches, station] of DEMO_USERS) {
      if (!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) db.prepare('INSERT INTO users(id, username, name, role, branches, station, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(`u_${username.replace('.', '_')}`, username, name, role, branches, station, hash, 1, Date.now());
    }
    return false;
  }
  tx(() => {
    const insO = db.prepare('INSERT INTO outlets(id, name, location, city, country, region, seats, manager, daily_target, platforms) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const insM = db.prepare('INSERT INTO menu_items VALUES (?,?,?,?,?,?,?,?,?)');
    const insS = db.prepare('INSERT INTO staff VALUES (?,?,?,?,?,?,?,?,?,?)');
    const insC = db.prepare('INSERT INTO cameras(id, outlet_id, name, zone, stream_url, status) VALUES (?,?,?,?,?,?)');
    const insSe = db.prepare('INSERT INTO sensors VALUES (?,?,?,?,?,?,?,?)');
    const insU = db.prepare('INSERT INTO users(id, username, name, role, branches, station, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
    const insG = db.prepare('INSERT INTO guests VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');

    setSetting('calibration', 2);
    setSetting('group_name', I.group);
    for (const [id, name, cat, price, station, prep, tags, isNew] of MENU) {
      insM.run(id, name, cat, price, Math.round(price * (0.26 + rand() * 0.08) * 100) / 100, station, prep, tags, isNew ? 1 : 0);
    }
    BRANCHES.forEach((b, bi) => {
      insO.run(b.id, b.name, b.location, b.city, b.country, b.region, b.seats, b.manager, DAILY_TARGET[b.id], JSON.stringify(b.platforms));
      db.prepare('UPDATE outlets SET state = ?, gstin = ?, fssai = ? WHERE id = ?').run(b.state ?? null, b.gstin ?? null, b.fssai ?? null, b.id);
      STAFF.forEach(([role, dept, station, rate, start, end], i) => {
        const name = role === 'Branch Manager' ? b.manager : `${FIRST[(bi * 7 + i * 3) % FIRST.length]} ${LAST[(bi * 5 + i * 7) % LAST.length]}`;
        insS.run(`${b.id}-s${i + 1}`, b.id, name, role, dept, station, Math.round(rate * LOADING * 100) / 100, start, end, `EMP-${b.id.toUpperCase()}-${100 + i}`);
      });
      CAMERAS.forEach(([cid, name, zone]) => insC.run(`${b.id}-${cid}`, b.id, name, zone, '', 'online'));
      SENSORS.forEach(([sid, name, kind, unit, min, max, base]) => insSe.run(`${b.id}-${sid}`, b.id, name, kind, unit, min, max, base));
    });

    const hash = hashPassword(DEMO_PASSWORD);
    for (const [username, name, role, branches, station] of DEMO_USERS) {
      insU.run(`u_${username.replace('.', '_')}`, username, name, role, branches, station, hash, 1, Date.now());
    }

    const items = MENU.filter((m) => !m[7]).map((m) => m[0]);
    const mains = MENU.filter((m) => ['Mains', I.altMain].includes(m[2]) && !m[7]).map((m) => m[0]);
    const drinks = MENU.filter((m) => m[2] === 'Drinks').map((m) => m[0]);
    for (let i = 0; i < 600; i++) {
      const home = BRANCHES[i % BRANCHES.length];
      const allergies = [rand() < 0.1 && 'nuts', rand() < 0.07 && 'dairy', rand() < 0.06 && 'gluten', rand() < 0.05 && 'seafood'].filter(Boolean);
      const safe = (id) => { const tags = MENU.find((m) => m[0] === id)[6]; return !allergies.some((a) => tags.includes(a)); };
      const favs = [...new Set([pick(mains.filter(safe)), pick(items.filter(safe)), pick(drinks.filter(safe))])].filter(Boolean);
      const bday = `${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`;
      insG.run(`g${1000 + i}`, `${pick(FIRST)} ${pick(LAST)}`, I.phonePrefix ? `${I.phonePrefix[i % I.phonePrefix.length]}${String(Math.floor(1e7 + rand() * 8.9e7))}` : `+${[1, 44, 33, 971, 91, 65][i % 6]} ${Math.floor(1e9 + rand() * 8.9e9)}`,
        home.id, 'New', bday, allergies.join(','), pick(I.seating || ['Window', 'Booth', 'Patio', 'Bar counter', 'Quiet corner']),
        pick(I.drinks || ['Sparkling water', 'Still water', 'Cold Brew', 'House Red', 'Fresh Lime Soda']), favs.join(','), rand() < 0.55 ? 1 : 0, Date.now());
    }
  });
  return true;
}
