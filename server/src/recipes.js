// Ingredients and recipes (bill of materials) per instance. Recipe quantities are derived so each dish's recipe cost
// matches its standard food cost, which keeps theoretical consumption, stock and food-cost % consistent.
import { INSTANCE } from './instance.js';

// [id, name, unit, cost per unit, category, vendor]
const GLOBAL_ING = [
  ['flour', 'Flour 00', 'kg', 1.4, 'Dry store', 'v1'], ['mozzarella', 'Mozzarella', 'kg', 9, 'Dairy', 'v2'], ['tomato', 'San Marzano tomato', 'kg', 3.2, 'Produce', 'v3'],
  ['chicken', 'Chicken thigh', 'kg', 7.5, 'Meat & fish', 'v4'], ['ribeye', 'Ribeye', 'kg', 32, 'Meat & fish', 'v4'], ['salmon', 'Salmon fillet', 'kg', 24, 'Meat & fish', 'v4'],
  ['squid', 'Squid', 'kg', 15, 'Meat & fish', 'v4'], ['beef_mince', 'Beef mince', 'kg', 11, 'Meat & fish', 'v4'], ['pepperoni', 'Pepperoni', 'kg', 17, 'Meat & fish', 'v4'],
  ['pasta', 'Fresh pasta', 'kg', 4, 'Dry store', 'v1'], ['rice', 'Arborio / basmati rice', 'kg', 3, 'Dry store', 'v1'], ['mushroom', 'Mushrooms', 'kg', 9, 'Produce', 'v3'],
  ['truffle', 'Truffle oil & paste', 'kg', 60, 'Dry store', 'v1'], ['cream', 'Cream', 'l', 5, 'Dairy', 'v2'], ['butter', 'Butter', 'kg', 10, 'Dairy', 'v2'],
  ['paneer', 'Paneer', 'kg', 11, 'Dairy', 'v2'], ['burrata', 'Burrata', 'kg', 22, 'Dairy', 'v2'], ['parmesan', 'Parmesan', 'kg', 20, 'Dairy', 'v2'],
  ['lettuce', 'Romaine', 'kg', 4.5, 'Produce', 'v3'], ['potato', 'Potatoes', 'kg', 1.6, 'Produce', 'v3'], ['bun', 'Brioche bun', 'pc', 0.6, 'Bakery', 'v1'],
  ['chocolate', 'Dark chocolate', 'kg', 14, 'Dry store', 'v1'], ['mascarpone', 'Mascarpone', 'kg', 15, 'Dairy', 'v2'], ['pistachio', 'Pistachio', 'kg', 32, 'Dry store', 'v1'],
  ['coconut', 'Coconut milk', 'l', 4, 'Dry store', 'v1'], ['spice', 'Spice mix', 'kg', 18, 'Dry store', 'v1'], ['lime', 'Limes', 'kg', 3.5, 'Produce', 'v3'],
  ['coffee', 'Coffee beans', 'kg', 22, 'Beverages', 'v5'], ['mango', 'Mango pulp', 'kg', 5, 'Beverages', 'v5'], ['wine', 'House red', 'l', 12, 'Beverages', 'v5'],
  ['milk', 'Milk', 'l', 1.3, 'Dairy', 'v2'], ['sugar', 'Sugar', 'kg', 1.1, 'Dry store', 'v1'], ['passion', 'Passionfruit purée', 'kg', 9, 'Beverages', 'v5'],
];
const GLOBAL_VENDORS = [['v1', 'Metro Dry Goods', 'Dry store, bakery'], ['v2', 'Valley Dairy Co.', 'Dairy'], ['v3', 'Fresh Fields Produce', 'Produce'], ['v4', 'Prime Meats & Seafood', 'Meat & fish'], ['v5', 'Bean & Barrel Beverages', 'Beverages']];
// item → [[ingredient, share of cost]]
const GLOBAL_BOM = {
  calamari: [['squid', 0.7], ['flour', 0.1], ['lime', 0.2]], burrata: [['burrata', 0.7], ['tomato', 0.3]], wings: [['chicken', 0.8], ['spice', 0.2]],
  caesar: [['lettuce', 0.5], ['parmesan', 0.4], ['chicken', 0.1]], salmon: [['salmon', 0.85], ['butter', 0.15]], ribeye: [['ribeye', 0.9], ['butter', 0.1]],
  burger: [['beef_mince', 0.6], ['bun', 0.2], ['potato', 0.2]], tikka: [['chicken', 0.6], ['rice', 0.2], ['spice', 0.2]], truffle_pasta: [['pasta', 0.3], ['truffle', 0.4], ['mushroom', 0.2], ['cream', 0.1]],
  paneer: [['paneer', 0.6], ['butter', 0.2], ['tomato', 0.2]], green_curry: [['chicken', 0.5], ['coconut', 0.3], ['rice', 0.2]], risotto: [['rice', 0.3], ['mushroom', 0.4], ['parmesan', 0.3]],
  margherita: [['flour', 0.3], ['mozzarella', 0.5], ['tomato', 0.2]], pepperoni: [['flour', 0.25], ['mozzarella', 0.4], ['pepperoni', 0.35]], funghi: [['flour', 0.25], ['mozzarella', 0.35], ['mushroom', 0.2], ['truffle', 0.2]],
  fries: [['potato', 0.6], ['truffle', 0.4]], lava: [['chocolate', 0.7], ['butter', 0.2], ['sugar', 0.1]], tiramisu: [['mascarpone', 0.6], ['coffee', 0.3], ['sugar', 0.1]],
  kulfi: [['milk', 0.4], ['pistachio', 0.5], ['sugar', 0.1]], cheesecake: [['mascarpone', 0.7], ['sugar', 0.3]], lime_soda: [['lime', 0.8], ['sugar', 0.2]],
  cold_brew: [['coffee', 1]], lassi: [['mango', 0.5], ['milk', 0.5]], lemonade: [['lime', 0.8], ['sugar', 0.2]], red_wine: [['wine', 1]], mocktail: [['passion', 0.8], ['sugar', 0.2]],
};

const INDIA_ING = [
  ['paneer', 'Paneer', 'kg', 380, 'Dairy', 'v2'], ['chicken', 'Chicken (curry cut)', 'kg', 260, 'Meat & fish', 'v4'], ['chicken_boneless', 'Chicken boneless', 'kg', 340, 'Meat & fish', 'v4'],
  ['mutton', 'Mutton', 'kg', 780, 'Meat & fish', 'v4'], ['fish', 'Basa / surmai fillet', 'kg', 460, 'Meat & fish', 'v4'], ['basmati', 'Basmati rice', 'kg', 125, 'Dry store', 'v1'],
  ['maida', 'Maida / atta', 'kg', 48, 'Dry store', 'v1'], ['butter', 'Butter (Amul)', 'kg', 540, 'Dairy', 'v2'], ['cream', 'Fresh cream', 'l', 250, 'Dairy', 'v2'],
  ['curd', 'Curd', 'kg', 85, 'Dairy', 'v2'], ['milk', 'Milk', 'l', 62, 'Dairy', 'v2'], ['khoya', 'Khoya / chhena', 'kg', 420, 'Dairy', 'v2'],
  ['ghee', 'Ghee', 'kg', 660, 'Dairy', 'v2'], ['tomato', 'Tomato', 'kg', 42, 'Produce', 'v3'], ['onion', 'Onion', 'kg', 38, 'Produce', 'v3'],
  ['veg', 'Mixed vegetables', 'kg', 70, 'Produce', 'v3'], ['potato', 'Potato', 'kg', 32, 'Produce', 'v3'], ['lemon', 'Lemon', 'kg', 130, 'Produce', 'v3'],
  ['urad', 'Urad dal & rajma', 'kg', 150, 'Dry store', 'v1'], ['dosa_batter', 'Dosa batter', 'kg', 65, 'Dry store', 'v1'], ['noodles', 'Hakka noodles', 'kg', 130, 'Dry store', 'v1'],
  ['spice', 'Whole & ground spices', 'kg', 620, 'Dry store', 'v1'], ['cashew', 'Cashew & nuts', 'kg', 950, 'Dry store', 'v1'], ['saffron', 'Saffron', 'g', 320, 'Dry store', 'v1'],
  ['oil', 'Refined oil', 'l', 155, 'Dry store', 'v1'], ['sugar', 'Sugar', 'kg', 46, 'Dry store', 'v1'], ['tea', 'Assam tea', 'kg', 420, 'Beverages', 'v5'],
  ['coffee', 'Filter coffee powder', 'kg', 820, 'Beverages', 'v5'], ['mango', 'Alphonso mango pulp', 'kg', 190, 'Beverages', 'v5'],
];
const INDIA_VENDORS = [['v1', 'Shree Balaji Traders', 'Dry store, grains, spices'], ['v2', 'Amrut Dairy Supplies', 'Dairy'], ['v3', 'Green Basket Agro (APMC)', 'Produce'], ['v4', 'Royal Meat & Fish Co.', 'Meat & fish'], ['v5', 'Nilgiri Beverages', 'Beverages']];
const INDIA_BOM = {
  paneer_tikka: [['paneer', 0.7], ['curd', 0.1], ['spice', 0.2]], chicken_tikka: [['chicken_boneless', 0.7], ['cream', 0.15], ['spice', 0.15]], hara_kebab: [['veg', 0.5], ['potato', 0.2], ['oil', 0.3]],
  chilli_paneer: [['paneer', 0.7], ['veg', 0.15], ['oil', 0.15]], amritsari_fish: [['fish', 0.75], ['maida', 0.1], ['oil', 0.15]],
  butter_chicken: [['chicken_boneless', 0.55], ['butter', 0.15], ['cream', 0.1], ['tomato', 0.1], ['cashew', 0.1]], paneer_makhani: [['paneer', 0.55], ['butter', 0.15], ['tomato', 0.15], ['cashew', 0.15]],
  dal_makhani: [['urad', 0.4], ['butter', 0.35], ['cream', 0.25]], rogan_josh: [['mutton', 0.8], ['onion', 0.1], ['spice', 0.1]], kadai_veg: [['veg', 0.6], ['paneer', 0.2], ['spice', 0.2]],
  masala_dosa: [['dosa_batter', 0.5], ['potato', 0.3], ['ghee', 0.2]], hakka_noodles: [['noodles', 0.5], ['veg', 0.35], ['oil', 0.15]],
  chicken_biryani: [['chicken', 0.5], ['basmati', 0.3], ['ghee', 0.1], ['saffron', 0.1]], veg_biryani: [['veg', 0.35], ['basmati', 0.4], ['ghee', 0.15], ['saffron', 0.1]], mutton_biryani: [['mutton', 0.6], ['basmati', 0.25], ['ghee', 0.1], ['saffron', 0.05]],
  butter_naan: [['maida', 0.6], ['butter', 0.4]], garlic_naan: [['maida', 0.6], ['butter', 0.3], ['spice', 0.1]], jeera_rice: [['basmati', 0.8], ['ghee', 0.2]],
  gulab_jamun: [['khoya', 0.7], ['sugar', 0.3]], rasmalai: [['khoya', 0.5], ['milk', 0.3], ['saffron', 0.2]], kulfi: [['milk', 0.6], ['cashew', 0.3], ['sugar', 0.1]], phirni: [['milk', 0.5], ['basmati', 0.2], ['saffron', 0.3]],
  masala_chai: [['tea', 0.4], ['milk', 0.5], ['sugar', 0.1]], filter_coffee: [['coffee', 0.6], ['milk', 0.4]], sweet_lassi: [['curd', 0.8], ['sugar', 0.2]], nimbu_soda: [['lemon', 0.8], ['sugar', 0.2]], mango_shake: [['mango', 0.6], ['milk', 0.4]],
};

const mk = (ing, ven, bom) => ({
  ingredients: ing.map(([id, name, unit, cost, category, vendor]) => ({ id, name, unit, cost, category, vendor })),
  vendors: ven.map(([id, name, supplies]) => ({ id, name, supplies, lead_days: id === 'v3' || id === 'v4' ? 1 : 2 })), bom,
});
const PACKS = { india: mk(INDIA_ING, INDIA_VENDORS, INDIA_BOM), global: mk(GLOBAL_ING, GLOBAL_VENDORS, GLOBAL_BOM) };
/** Ingredient pack that matches the menu in use (Indian or international template). */
export function packFor(menuIds = []) {
  const hit = (b) => menuIds.filter((m) => b[m]).length;
  return hit(INDIA_BOM) > hit(GLOBAL_BOM) ? PACKS.india : menuIds.length ? PACKS.global : PACKS[INSTANCE.id === 'india' ? 'india' : 'global'];
}
const DEFAULT = PACKS[INSTANCE.id === 'india' ? 'india' : 'global'];
export const INGREDIENTS = DEFAULT.ingredients;
export const VENDORS = DEFAULT.vendors;

/** Recipe lines with per-portion quantities scaled so recipe cost ≈ the dish's standard cost. */
export function buildRecipes(menu, pack = packFor(menu.map((m) => m.id))) {
  const BOM = pack.bom;
  const ing = Object.fromEntries(pack.ingredients.map((i) => [i.id, i]));
  const out = [];
  for (const m of menu) {
    for (const [iid, share] of BOM[m.id] || []) {
      const i = ing[iid];
      if (i) out.push({ item_id: m.id, ingredient_id: iid, qty: Math.round(((m.cost * share) / i.cost) * 10000) / 10000 });
    }
  }
  return out;
}
