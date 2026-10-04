// The five calibration types. The API and the stored plays keep their original names (functions/_rounds.js typeOf);
// players read these. The one-line meanings live in i18n/en.json (rounds.type_*), on the home page's type tiles and in
// its FAQ.
export const TYPE_NAMES = { Bluffer: 'Bluffer', 'Hot-headed': 'Too sure', Calibrated: 'Spot on', Modest: 'Too modest', Hedger: 'Playing it safe' };
export const typeName = (type) => TYPE_NAMES[type] ?? type;
