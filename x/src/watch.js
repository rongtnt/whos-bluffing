// The accounts the poller watches: X handle, how a reply addresses them, and the pack and difficulty that fit their
// field (members of Congress: Politics, Normal). Ids are resolved once through GET /2/users/by and cached in KV ("ids"),
// so a renamed handle only needs an edit here. People only, never organisations: the dare is addressed to a person.
export const SITE = 'https://whosbluffing.com/';
// People with a dare page (dares/dares.json): their link is the page that keeps score of their silence.
export const DARES = {"sama":"altman","elonmusk":"musk","gdb":"brockman","karpathy":"karpathy","ylecun":"lecun","demishassabis":"hassabis","mustafasuleyman":"suleyman","AravSrinivas":"srinivas","satyanadella":"nadella","sundarpichai":"pichai","OfficialLoganK":"kilpatrick","jackclarkSF":"clark","dwarkesh_sp":"dwarkesh","emollick":"mollick","GaryMarcus":"marcus","paulg":"graham","pmarca":"andreessen","naval":"naval","BillGates":"gates","JeffBezos":"bezos","AOC":"ocasio-cortez","BernieSanders":"sanders","ewarren":"warren","SenSchumer":"schumer","JohnFetterman":"fetterman","CoryBooker":"booker","RoKhanna":"khanna","JasmineForUS":"crockett","IlhanMN":"omar","AdamSchiff":"schiff","ChrisMurphyCT":"chris-murphy","CaptMarkKelly":"mark-kelly","tedcruz":"cruz","RandPaul":"rand-paul","HawleyMO":"hawley","SenatorTimScott":"tim-scott","BasedMikeLee":"mike-lee","TomCottonAR":"cotton","Jim_Jordan":"jordan","RepMikeJohnson":"mike-johnson","RepThomasMassie":"massie","DanCrenshawTX":"crenshaw","EliseStefanik":"stefanik","SenJohnKennedy":"john-kennedy"};

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
  // Members of Congress, 12 who caucus with the Democrats and 12 Republicans (dares/dares.json; scripts/check.sh checks
  // the balance): the Politics pack, and the politics lines below.
  ['AOC', 'Representative Ocasio-Cortez', 'politics', 'normal'],
  ['BernieSanders', 'Senator Sanders', 'politics', 'normal'],
  ['ewarren', 'Senator Warren', 'politics', 'normal'],
  ['SenSchumer', 'Senator Schumer', 'politics', 'normal'],
  ['JohnFetterman', 'Senator Fetterman', 'politics', 'normal'],
  ['CoryBooker', 'Senator Booker', 'politics', 'normal'],
  ['RoKhanna', 'Representative Khanna', 'politics', 'normal'],
  ['JasmineForUS', 'Representative Crockett', 'politics', 'normal'],
  ['IlhanMN', 'Representative Omar', 'politics', 'normal'],
  ['AdamSchiff', 'Senator Schiff', 'politics', 'normal'],
  ['ChrisMurphyCT', 'Senator Murphy', 'politics', 'normal'],
  ['CaptMarkKelly', 'Senator Kelly', 'politics', 'normal'],
  ['tedcruz', 'Senator Cruz', 'politics', 'normal'],
  ['RandPaul', 'Senator Paul', 'politics', 'normal'],
  ['HawleyMO', 'Senator Hawley', 'politics', 'normal'],
  ['SenatorTimScott', 'Senator Scott', 'politics', 'normal'],
  ['BasedMikeLee', 'Senator Lee', 'politics', 'normal'],
  ['TomCottonAR', 'Senator Cotton', 'politics', 'normal'],
  ['Jim_Jordan', 'Representative Jordan', 'politics', 'normal'],
  ['RepMikeJohnson', 'Representative Johnson', 'politics', 'normal'],
  ['RepThomasMassie', 'Representative Massie', 'politics', 'normal'],
  ['DanCrenshawTX', 'Representative Crenshaw', 'politics', 'normal'],
  ['EliseStefanik', 'Representative Stefanik', 'politics', 'normal'],
  ['SenJohnKennedy', 'Senator Kennedy', 'politics', 'normal'],
].map(([handle, address, pack, difficulty]) => ({ handle, address, pack, link: DARES[handle] ? `${SITE}dare/${DARES[handle]}` : `${SITE}?pack=${pack}&difficulty=${difficulty}` }));

// Polite dares, as the owner asked for them. Rotated by post id so the same wording does not repeat all day.
const LINES = [
  (who, link) => `${who}, I would bet you can't get all ten of these right: ${link}`,
  (who, link) => `${who}, surely you can get all ten of these right. The harder part is how sure you are on each one: ${link}`,
  (who, link) => `${who}, ten questions from your own field, about a minute. I doubt anyone gets all ten with the confidence they claim: ${link}`,
  (who, link) => `${who}, I would like to see your score on these ten. Being sure only pays when you're right: ${link}`,
  (who, link) => `${who}, a one-minute test from your own field. Most people are surest on the ones they get wrong: ${link}`,
];

// For members of Congress: about Congress's own record, never about the person's politics.
const POLITICS_LINES = [
  (who, link) => `${who}, ten questions about Congress's own record, written for you. About a minute, and the same ten for everyone: ${link}`,
  (who, link) => `${who}, your supporters can take the ten questions written for you and see how they score. I would like to see your score next to theirs: ${link}`,
  (who, link) => `${who}, ten questions about Congress, written for you. Being sure only pays when you're right: ${link}`,
  (who, link) => `${who}, a one-minute test on Congress's own record. The harder part is how sure you are on each answer: ${link}`,
  (who, link) => `${who}, the ten questions written for you are open to everyone. Your page says "no score yet" until you post yours: ${link}`,
];

export const dare = (user, postId) => {
  const lines = user.pack === 'politics' ? POLITICS_LINES : LINES;
  return lines[Number(BigInt(postId) % BigInt(lines.length))](user.address, user.link);
};

// The reply composer, prefilled: the owner taps it, reads the draft, and posts by hand.
export const replyIntent = (postId, text) => `https://x.com/intent/post?in_reply_to=${postId}&text=${encodeURIComponent(text)}`;
