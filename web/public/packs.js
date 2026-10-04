// Quick-round packs and difficulties: one list for the API (functions/_rounds.js imports it), the sync step that decides
// which packs the home page offers (scripts/sync-pages.js) and the browser (labels on the end screen and in the share
// text). A pack is a set of pair categories (items/pairs.json); `all` is every category.
export const PACKS = {
  all: { label: 'All', categories: null },
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
