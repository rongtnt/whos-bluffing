// The accounts the poller watches: X handle, how a reply addresses them, and the pack and difficulty that fit their
// field. Ids are resolved once through GET /2/users/by and cached in KV ("ids"), so a renamed handle only needs an
// edit here. People only, never organisations: the dare is addressed to a person.
export const SITE = 'https://whosbluffing.com/';

export const WATCH = [
  // AI labs and researchers: the AI pack, brutal for the people who would find normal easy.
  ['sama', 'Mr. Altman', 'ai', 'brutal'],
  ['elonmusk', 'Mr. Musk', 'ai', 'brutal'],
  ['gdb', 'Mr. Brockman', 'ai', 'brutal'],
  ['karpathy', 'Mr. Karpathy', 'ai', 'brutal'],
  ['ylecun', 'Professor LeCun', 'ai', 'brutal'],
  ['demishassabis', 'Sir Demis', 'ai', 'brutal'],
  ['satyanadella', 'Mr. Nadella', 'ai', 'normal'],
  ['sundarpichai', 'Mr. Pichai', 'ai', 'normal'],
  ['mustafasuleyman', 'Mr. Suleyman', 'ai', 'brutal'],
  ['AravSrinivas', 'Mr. Srinivas', 'ai', 'brutal'],
  ['OfficialLoganK', 'Mr. Kilpatrick', 'ai', 'brutal'],
  ['jackclarkSF', 'Mr. Clark', 'ai', 'brutal'],
  ['DrJimFan', 'Dr. Fan', 'ai', 'brutal'],
  ['ClementDelangue', 'Mr. Delangue', 'ai', 'brutal'],
  ['arthurmensch', 'Mr. Mensch', 'ai', 'brutal'],
  ['dwarkesh_sp', 'Mr. Patel', 'ai', 'brutal'],
  ['lexfridman', 'Mr. Fridman', 'ai', 'normal'],
  ['emollick', 'Professor Mollick', 'ai', 'brutal'],
  ['AndrewYNg', 'Professor Ng', 'ai', 'brutal'],
  ['fchollet', 'Mr. Chollet', 'ai', 'brutal'],
  ['GaryMarcus', 'Professor Marcus', 'ai', 'brutal'],
  ['kevinweil', 'Mr. Weil', 'ai', 'brutal'],
  ['miramurati', 'Ms. Murati', 'ai', 'brutal'],
  ['alexandr_wang', 'Mr. Wang', 'ai', 'brutal'],
  ['rowancheung', 'Mr. Cheung', 'ai', 'normal'],
  ['ilyasut', 'Mr. Sutskever', 'ai', 'brutal'],
  // Founders and investors: the pack closest to what they talk about.
  ['BillGates', 'Mr. Gates', 'history', 'normal'],
  ['JeffBezos', 'Mr. Bezos', 'companies', 'normal'],
  ['pmarca', 'Mr. Andreessen', 'companies', 'brutal'],
  ['naval', 'Mr. Ravikant', 'companies', 'normal'],
  ['paulg', 'Mr. Graham', 'companies', 'brutal'],
  ['tim_cook', 'Mr. Cook', 'products', 'normal'],
  ['garrytan', 'Mr. Tan', 'companies', 'normal'],
  ['chamath', 'Mr. Palihapitiya', 'companies', 'normal'],
  ['mcuban', 'Mr. Cuban', 'companies', 'normal'],
  ['RayDalio', 'Mr. Dalio', 'countries', 'normal'],
  ['MichaelDell', 'Mr. Dell', 'companies', 'normal'],
  ['reidhoffman', 'Mr. Hoffman', 'companies', 'normal'],
  ['balajis', 'Mr. Srinivasan', 'countries', 'brutal'],
  ['CathieDWood', 'Ms. Wood', 'companies', 'normal'],
].map(([handle, address, pack, difficulty]) => ({ handle, address, link: `${SITE}?pack=${pack}&difficulty=${difficulty}` }));

// Polite dares, as the owner asked for them. Rotated by post id so the same wording does not repeat all day.
const LINES = [
  (who, link) => `${who}, I would bet you can't get all ten of these right: ${link}`,
  (who, link) => `${who}, surely you can get all ten of these right. The harder part is how sure you are on each one: ${link}`,
  (who, link) => `${who}, ten questions from your own field, about a minute. I doubt anyone gets all ten with the confidence they claim: ${link}`,
  (who, link) => `${who}, I would like to see your score on these ten. Being sure only pays when you're right: ${link}`,
  (who, link) => `${who}, a one-minute test from your own field. Most people are surest on the ones they get wrong: ${link}`,
];

export const dare = (user, postId) => LINES[Number(BigInt(postId) % BigInt(LINES.length))](user.address, user.link);

// The reply composer, prefilled: the owner taps it, reads the draft, and posts by hand.
export const replyIntent = (postId, text) => `https://x.com/intent/post?in_reply_to=${postId}&text=${encodeURIComponent(text)}`;
