// Quick-round packs and difficulties: one list for the API (functions/_rounds.js imports it), the sync step that decides
// which packs the home page offers (scripts/sync-pages.js) and the browser (labels on the end screen and in the share
// text). A pack is a set of pair categories (items/pairs.json); `all` is every category.
// `tiers` (AI pack only): which pair tiers each difficulty draws, on top of the difficulty's own rules. An AI pair's tier
// is the higher of its two items' (items/ai_curated.json): 1 famous names and years, 2 events and money, 3 technical.
// Easy = tier 1, Normal = tiers 1-2, Brutal = tiers 2-3. Ranked rounds ignore packs (their AI slot is tier 1-2).
export const PACKS = {
  all: { label: 'All', categories: null },
  ai: {
    label: 'AI',
    categories: ['ai_timeline', 'ai_drama', 'ai_released', 'ai_company_founded', 'ai_money', 'ai_params', 'ai_tech'],
    tiers: { easy: [1], normal: [1, 2], brutal: [2, 3] },
  },
  geography: { label: 'Geography', categories: ['country_area', 'country_population', 'mountain_elevation', 'river_length', 'lake'] },
  space: { label: 'Space', categories: ['solar_system_size', 'solar_system_distance'] },
  elements: { label: 'Elements', categories: ['element_melting_point'] },
  history: { label: 'History', categories: ['first_flight', 'university_founded', 'first_ascent', 'landmark_built', 'company_founded', 'product_released'] },
  buildings: { label: 'Buildings', categories: ['building_height', 'landmark_height', 'landmark_built'] },
  bridges: { label: 'Bridges', categories: ['bridge_length'] },
  lakes: { label: 'Lakes', categories: ['lake'] },
  rivers: { label: 'Rivers', categories: ['river_length'] },
  mountains: { label: 'Mountains', categories: ['mountain_elevation', 'first_ascent'] },
  companies: { label: 'Companies', categories: ['company_founded'] },
  products: { label: 'Products', categories: ['product_released'] },
  languages: { label: 'Languages', categories: ['language_speakers'] },
  countries: { label: 'Countries', categories: ['country_area', 'country_population'] },
};

export const DIFFICULTY_LABELS = { easy: 'Easy', normal: 'Normal', brutal: 'Brutal' };
export const DEFAULT_PACK = 'all';
export const DEFAULT_DIFFICULTY = 'normal';

export const packLabel = (pack) => PACKS[pack]?.label ?? PACKS.all.label;
export const difficultyLabel = (d) => DIFFICULTY_LABELS[d] ?? DIFFICULTY_LABELS.normal;

// The labs a player of an AI-pack round can say they are with (POST /api/round/lab, GET /api/labs, the end screen and
// /labs), in board order for ties: id -> display name.
export const LABS = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', xai: 'xAI', meta: 'Meta', other: 'Other' };
