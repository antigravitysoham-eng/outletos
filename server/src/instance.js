// Instance profiles. One codebase, separate deployments: INSTANCE=global (default, USD, 6 cities worldwide) or
// INSTANCE=india (INR, GST, Indian cities, menu, staff, platforms, UPI). Each instance has its own database and port.
const NAME = (process.env.INSTANCE || 'global').toLowerCase();

const GLOBAL = {
  id: 'global', label: 'Global', group: 'My Restaurant Group', port: 8787, db: 'outletos-v2.db', tz: null,
  currency: { code: 'USD', symbol: '$', locale: 'en-US' }, tax: { name: 'Sales tax', rate: 0, inclusive: false },
  payments: ['card', 'card', 'card', 'cash', 'wallet'], takeawayPayments: ['card', 'card', 'cash', 'wallet'],
  altMain: 'Pizza', reviewPlatforms: ['Google', 'Google', 'Tripadvisor'],
};

const INDIA = {
  id: 'india', label: 'India', group: 'Spice Route Hospitality', port: 8788, db: 'outletos-india.db', tz: 'Asia/Kolkata',
  currency: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  // Restaurant service (SAC 9963) without input tax credit: 5% GST, split CGST 2.5% + SGST 2.5% for intra-state supply
  tax: { name: 'GST', rate: 0.05, inclusive: false, sac: '9963', split: [['CGST', 0.025], ['SGST', 0.025]] },
  fssai: true,
  payments: ['upi', 'upi', 'upi', 'card', 'card', 'cash'], takeawayPayments: ['upi', 'upi', 'upi', 'cash', 'card'],
  altMain: 'Biryani', reviewPlatforms: ['Google', 'Google', 'Zomato', 'Swiggy'],
  branches: [
    { id: 'r1', name: 'Restaurant 1', location: 'Bandra West', city: 'Mumbai', country: 'India', region: 'West', state: 'Maharashtra', seats: 96, manager: 'Priya Nair', platforms: ['Swiggy', 'Zomato', 'Website'], gstin: '27AABCS1234F1Z5', fssai: '11524998000123' },
    { id: 'r2', name: 'Restaurant 2', location: 'Connaught Place', city: 'New Delhi', country: 'India', region: 'North', state: 'Delhi', seats: 110, manager: 'Rohan Malhotra', platforms: ['Zomato', 'Swiggy', 'Magicpin'], gstin: '07AABCS1234F1Z9', fssai: '13324998000456' },
    { id: 'r3', name: 'Restaurant 3', location: 'Indiranagar', city: 'Bengaluru', country: 'India', region: 'South', state: 'Karnataka', seats: 84, manager: 'Kavya Reddy', platforms: ['Swiggy', 'Zomato', 'ONDC'], gstin: '29AABCS1234F1Z1', fssai: '11224998000789' },
    { id: 'r4', name: 'Restaurant 4', location: 'Jubilee Hills', city: 'Hyderabad', country: 'India', region: 'South', state: 'Telangana', seats: 120, manager: 'Imran Qureshi', platforms: ['Zomato', 'Swiggy', 'Website'], gstin: '36AABCS1234F1Z3', fssai: '13624998000234' },
    { id: 'r5', name: 'Restaurant 5', location: 'Koregaon Park', city: 'Pune', country: 'India', region: 'West', state: 'Maharashtra', seats: 90, manager: 'Aditi Kulkarni', platforms: ['Swiggy', 'Zomato', 'ONDC'], gstin: '27AABCS1234F2Z4', fssai: '11524998000567' },
    { id: 'r6', name: 'Restaurant 6', location: 'Park Street', city: 'Kolkata', country: 'India', region: 'East', state: 'West Bengal', seats: 72, manager: 'Sourav Banerjee', platforms: ['Zomato', 'Swiggy', 'Website'], gstin: '19AABCS1234F1Z8', fssai: '12824998000890' },
  ],
  // Budgeted net sales per day (₹, before GST)
  dailyTarget: { r1: 460000, r2: 400000, r3: 340000, r4: 430000, r5: 510000, r6: 355000 },
  // [id, name, category, price ₹, station, prep_sec, tags, is_new]
  menu: [
    ['paneer_tikka', 'Paneer Tikka', 'Starters', 320, 'Tandoor', 600, 'dairy,veg'],
    ['chicken_tikka', 'Murgh Malai Tikka', 'Starters', 380, 'Tandoor', 660, 'dairy'],
    ['hara_kebab', 'Hara Bhara Kebab', 'Starters', 260, 'Fry', 420, 'veg'],
    ['chilli_paneer', 'Chilli Paneer', 'Starters', 290, 'Wok', 480, 'dairy,veg'],
    ['amritsari_fish', 'Amritsari Fish', 'Starters', 420, 'Fry', 540, 'fish,gluten'],
    ['butter_chicken', 'Butter Chicken', 'Mains', 450, 'Curry', 660, 'dairy,nuts'],
    ['paneer_makhani', 'Paneer Butter Masala', 'Mains', 380, 'Curry', 600, 'dairy,veg,nuts'],
    ['dal_makhani', 'Dal Makhani', 'Mains', 320, 'Curry', 480, 'dairy,veg'],
    ['rogan_josh', 'Mutton Rogan Josh', 'Mains', 520, 'Curry', 720, ''],
    ['kadai_veg', 'Kadai Vegetables', 'Mains', 300, 'Curry', 540, 'veg'],
    ['masala_dosa', 'Masala Dosa', 'Mains', 220, 'South Indian', 420, 'veg'],
    ['hakka_noodles', 'Veg Hakka Noodles', 'Mains', 260, 'Wok', 420, 'gluten,veg'],
    ['chicken_biryani', 'Hyderabadi Chicken Biryani', 'Biryani', 420, 'Biryani', 600, 'dairy'],
    ['veg_biryani', 'Subz Dum Biryani', 'Biryani', 340, 'Biryani', 540, 'dairy,veg'],
    ['mutton_biryani', 'Lucknowi Mutton Biryani', 'Biryani', 520, 'Biryani', 660, 'dairy', 1],
    ['butter_naan', 'Butter Naan', 'Sides', 70, 'Tandoor', 240, 'gluten,dairy,veg'],
    ['garlic_naan', 'Garlic Naan', 'Sides', 90, 'Tandoor', 240, 'gluten,dairy,veg'],
    ['jeera_rice', 'Jeera Rice', 'Sides', 180, 'Curry', 300, 'veg'],
    ['gulab_jamun', 'Gulab Jamun', 'Desserts', 140, 'Dessert', 120, 'dairy,gluten,veg'],
    ['rasmalai', 'Rasmalai', 'Desserts', 180, 'Dessert', 120, 'dairy,nuts,veg'],
    ['kulfi', 'Malai Kulfi', 'Desserts', 160, 'Dessert', 90, 'dairy,nuts,veg'],
    ['phirni', 'Kesar Phirni', 'Desserts', 150, 'Dessert', 90, 'dairy,veg', 1],
    ['masala_chai', 'Masala Chai', 'Drinks', 80, 'Beverages', 180, 'dairy,veg'],
    ['filter_coffee', 'Filter Coffee', 'Drinks', 90, 'Beverages', 180, 'dairy,veg'],
    ['sweet_lassi', 'Sweet Lassi', 'Drinks', 140, 'Beverages', 120, 'dairy,veg'],
    ['nimbu_soda', 'Fresh Lime Soda', 'Drinks', 120, 'Beverages', 90, 'veg'],
    ['mango_shake', 'Alphonso Mango Shake', 'Drinks', 180, 'Beverages', 150, 'dairy,veg'],
  ],
  // [role, department, station, ₹/h, shift start (min), shift end]
  staff: [
    ['Branch Manager', 'Management', 'Floor', 780, 600, 1200], ['Head Chef', 'Kitchen', 'Pass', 720, 570, 1170],
    ['Sous Chef', 'Kitchen', 'Curry', 500, 960, 1440], ['Tandoor Chef', 'Kitchen', 'Tandoor', 390, 600, 1080],
    ['Tandoor Chef', 'Kitchen', 'Tandoor', 390, 1020, 1440], ['Fry Cook', 'Kitchen', 'Fry', 280, 600, 1080],
    ['Biryani Cook', 'Kitchen', 'Biryani', 360, 660, 1140], ['Wok Cook', 'Kitchen', 'Wok', 320, 600, 1080],
    ['Dessert Cook', 'Kitchen', 'Dessert', 280, 720, 1200], ['Beverage Associate', 'Front of House', 'Beverages', 240, 960, 1440],
    ['Host', 'Front of House', 'Entrance', 260, 660, 1140], ['Steward', 'Front of House', 'Floor', 220, 660, 1140],
    ['Steward', 'Front of House', 'Floor', 220, 1020, 1440], ['Steward', 'Front of House', 'Floor', 220, 1020, 1440],
    ['Packing Associate', 'Kitchen', 'Packing', 210, 660, 1200], ['Kitchen Steward', 'Kitchen', 'Dish', 200, 720, 1260],
    ['Night Cook', 'Kitchen', 'Curry', 300, 0, 600], ['Night Packer', 'Kitchen', 'Packing', 220, 0, 600],
  ],
  loading: 1.35, // PF, ESIC, bonus, gratuity, meals
  first: ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Isha', 'Kavya', 'Meera', 'Riya', 'Rahul', 'Vikram', 'Suresh', 'Lakshmi', 'Fatima', 'Zoya', 'Harpreet', 'Gurpreet', 'Tanvi', 'Neha', 'Pooja', 'Manoj', 'Deepak', 'Sneha', 'Rakesh', 'Divya', 'Karthik', 'Nikhil', 'Anjali', 'Farhan', 'Sameer', 'Shreya', 'Varun', 'Bhavna'],
  last: ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Shah', 'Gupta', 'Singh', 'Khan', 'Das', 'Banerjee', 'Mukherjee', 'Rao', 'Menon', 'Pillai', 'Joshi', 'Kulkarni', 'Deshpande', 'Chopra', 'Malhotra', 'Kapoor', 'Mehta', 'Bose', 'Ghosh', 'Hegde', 'Naidu', 'Qureshi'],
  phonePrefix: ['+91 98', '+91 99', '+91 97', '+91 88', '+91 70', '+91 81'],
  seating: ['Window', 'Booth', 'Terrace', 'Family section', 'Quiet corner'],
  drinks: ['Masala Chai', 'Fresh Lime Soda', 'Sweet Lassi', 'Filter Coffee', 'Still water'],
  users: { owner: 'Vikram Mehta', 'area.east': 'Anjali Rao', 'manager.r1': 'Priya Nair', 'manager.r5': 'Aditi Kulkarni', 'chef.r1': 'Suresh Pillai', 'cook.r1': 'Ravi Kumar', 'host.r1': 'Meera Iyer', auditor: 'Neha Joshi', 'it.admin': 'Farhan Shaikh', 'cashier.r1': 'Rahul Yadav' },
  cookStation: 'Tandoor', areaBranches: 'r3,r4,r6',
  reviews: {
    5: ['Best butter chicken in the city, naan was perfect!', 'Biryani was outstanding and staff remembered our usual.', 'Quick service, great vibe, loved the kulfi.', 'Fantastic paneer tikka, will definitely come back.'],
    4: ['Great food, bit crowded on the weekend.', 'Tasty dal makhani, rotis could be softer.', 'Lovely dinner, dessert took a while.'],
    3: ['Food was okay, service was slow tonight.', 'Delivery came a little cold but tasted fine.'],
    2: ['Waited 40 minutes for the main course.', 'Order was missing an item and support was slow.'],
  },
  authors: ['Rahul S.', 'Sneha K.', 'Arjun M.', 'Pooja R.', 'Farhan A.', 'Divya N.', 'Karthik V.', 'Isha G.', 'Manoj P.', 'Zoya H.'],
};

// A fresh tenant: no demo data; the owner signs up and configures everything in the onboarding wizard.
const BLANK = { id: 'blank', label: 'New workspace', group: 'New restaurant group', port: 8789, db: 'outletos-new.db', blank: true };

export const INSTANCE = NAME === 'india' ? { ...GLOBAL, ...INDIA } : NAME === 'blank' ? { ...GLOBAL, ...BLANK } : { ...GLOBAL };
export const INDIA_MENU = INDIA.menu;

/** Apply the organisation configured in onboarding (currency, tax, time zone, payments...) to this running instance. */
export function applyOrg(org) {
  if (!org) return;
  Object.assign(INSTANCE, {
    group: org.group, currency: org.currency, tax: org.tax, fssai: org.country === 'IN', country: org.country, payments: org.payments || INSTANCE.payments,
    takeawayPayments: org.payments || INSTANCE.takeawayPayments, altMain: org.altMain || INSTANCE.altMain, service_pct: org.service_pct || 0, roundTo: org.roundTo,
    reviewPlatforms: ['Google', 'Google', ...(org.platforms || []).filter((x) => x !== 'Website')].slice(0, 4),
  });
  if (org.timezone) process.env.TZ = org.timezone;
}

if (INSTANCE.tz && !process.env.TZ) process.env.TZ = INSTANCE.tz;

/** Money formatting for server-written text (summaries, agent answers). */
export function fmtMoney(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const { symbol, locale, code } = INSTANCE.currency;
  const a = Math.abs(v), neg = v < 0 ? '−' : '';
  if (code === 'INR' && a >= 1e7) return `${neg}${symbol}${(a / 1e7).toFixed(2)} Cr`;
  if (code === 'INR' && a >= 1e5) return `${neg}${symbol}${(a / 1e5).toFixed(2)} L`;
  return `${neg}${symbol}${Math.round(a).toLocaleString(locale)}`;
}

/** Public subset sent to the web app. */
export const publicInstance = () => ({ id: INSTANCE.id, label: INSTANCE.label, currency: INSTANCE.currency, tax: INSTANCE.tax, fssai: !!INSTANCE.fssai, country: INSTANCE.country || (INSTANCE.id === 'india' ? 'IN' : null), blank: !!INSTANCE.blank });
