# Item bank review (v1)

Check each line: is the fact true, stable (will not change next year), sourced, and does the Chinese prompt ask exactly the same thing as the English one? Tick `[x]` when done. Fix errors in `items/items.json`, then run `cd web && npm run sync-items`.

Generated from `items/items.json` (ids: t = two-alternative, r = 90% range, c = attention check). Source URLs were written from standard references and not machine-checked; open each one.

Format: id · fact · source · check

## Two-alternative (40)

- t001 · [geography, easy] Which river is longer? → The Nile (not The Congo) — Nile ≈ 6,650 km; Congo ≈ 4,700 km (Africa) · https://www.britannica.com/place/Nile-River ; https://www.britannica.com/place/Congo-River · [ ]
- t002 · [geography, easy] Which mountain is higher? → Mount Everest (not K2) — Everest 8,849 m; K2 8,611 m (Asia) · https://www.britannica.com/place/Mount-Everest ; https://www.britannica.com/place/K2 · [ ]
- t003 · [geography, hard] Which city is farther north? → Paris (not Beijing) — Paris ≈ 48.9° N; Beijing ≈ 39.9° N (Europe / Asia) · https://www.britannica.com/place/Paris ; https://www.britannica.com/place/Beijing · [ ]
- t004 · [geography, medium] Which country has the larger total area? → Canada (not The United States) — Canada ≈ 9.98 million km²; United States ≈ 9.83 million km² (North America) · https://www.britannica.com/place/Canada ; https://www.britannica.com/place/United-States · [ ]
- t005 · [geography, hard] Which city is farther south? → Buenos Aires (not Sydney) — Buenos Aires ≈ 34.6° S; Sydney ≈ 33.9° S (South America / Oceania) · https://www.britannica.com/place/Sydney ; https://www.britannica.com/place/Buenos-Aires · [ ]
- t006 · [geography, easy] Which ocean is larger? → The Atlantic Ocean (not The Indian Ocean) — Atlantic ≈ 85 million km²; Indian ≈ 71 million km² (larger under any common definition) · https://www.ngdc.noaa.gov/mgg/global/etopo1_ocean_volumes.html · [ ]
- t007 · [geography, hard] Which lake is deeper? → Lake Baikal (not Lake Tanganyika) — Baikal max depth ≈ 1,642 m; Tanganyika ≈ 1,470 m (Asia / Africa) · https://www.britannica.com/place/Lake-Baikal ; https://www.britannica.com/place/Lake-Tanganyika · [ ]
- t008 · [history, hard] Which happened first? → Polynesian voyagers settled New Zealand (not Columbus reached the Americas) — New Zealand settled c. 1250–1300; Columbus 1492 (Oceania / Americas) · https://teara.govt.nz/en/history/page-1 ; https://www.britannica.com/biography/Christopher-Columbus · [ ]
- t009 · [history, medium] Which canal opened first? → The Suez Canal (not The Panama Canal) — Suez 1869; Panama 1914 (Africa / Americas) · https://www.britannica.com/topic/Suez-Canal ; https://www.britannica.com/topic/Panama-Canal · [ ]
- t010 · [history, medium] Which happened first? → The United Nations was founded (not India became independent) — UN 24 Oct 1945; India 15 Aug 1947 (global / South Asia) · https://www.un.org/en/about-us/history-of-the-un ; https://www.britannica.com/place/India · [ ]
- t011 · [history, easy] Which happened first? → The first crewed Moon landing (not The fall of the Berlin Wall) — Moon landing 20 Jul 1969; Berlin Wall 9 Nov 1989 · https://www.nasa.gov/mission/apollo-11/ ; https://www.britannica.com/topic/Berlin-Wall · [ ]
- t012 · [history, hard] Which happened first? → Mansa Musa of Mali made his pilgrimage to Mecca (not The Black Death reached Europe) — Mansa Musa's pilgrimage 1324–25; Black Death reached Europe 1347 (Africa / Europe) · https://www.britannica.com/biography/Musa-I-of-Mali ; https://www.britannica.com/event/Black-Death · [ ]
- t013 · [history, medium] Which was completed first? → The Forbidden City in Beijing (not The Taj Mahal in India) — Forbidden City completed 1420; Taj Mahal c. 1648–53 (East Asia / South Asia) · https://whc.unesco.org/en/list/439 ; https://whc.unesco.org/en/list/252 · [ ]
- t014 · [history, easy] Which empire began first? → The Roman Empire (not The Inca Empire) — Roman Empire 27 BC; Inca Empire 15th century (Europe / South America) · https://www.britannica.com/place/Roman-Empire ; https://www.britannica.com/topic/Inca · [ ]
- t015 · [physics, easy] Which travels faster through air? → Light (not Sound) — Light ≈ 300,000 km/s; sound ≈ 343 m/s · https://physics.nist.gov/cgi-bin/cuu/Value?c ; CRC Handbook of Chemistry and Physics (speed of sound in air) · [ ]
- t016 · [physics, medium] Which metal is denser? → Gold (not Lead) — Gold 19.3 g/cm³; lead 11.3 g/cm³ · https://pubchem.ncbi.nlm.nih.gov/element/Gold ; https://pubchem.ncbi.nlm.nih.gov/element/Lead · [ ]
- t017 · [physics, medium] Where does sound travel faster? → In water (not In air) — Water ≈ 1,480 m/s; air ≈ 343 m/s · https://www.britannica.com/science/sound-physics ; CRC Handbook of Chemistry and Physics · [ ]
- t018 · [physics, hard] Which planet has the hotter surface? → Venus (not Mercury) — Venus ≈ 465 °C everywhere; Mercury peaks ≈ 430 °C · https://science.nasa.gov/venus/ ; https://science.nasa.gov/mercury/ · [ ]
- t019 · [physics, hard] Which planet has the larger diameter? → Uranus (not Neptune) — Uranus 51,118 km; Neptune 49,528 km (Neptune is heavier, Uranus is wider) · https://nssdc.gsfc.nasa.gov/planetary/factsheet/ · [ ]
- t020 · [physics, easy] Which particle has more mass? → A proton (not An electron) — Proton ≈ 1,836 times the electron's mass · https://physics.nist.gov/cuu/Constants/ (CODATA) · [ ]
- t021 · [physics, medium] Which colour of light has the longer wavelength? → Red (not Blue) — Red ≈ 620–750 nm; blue ≈ 450–495 nm · https://science.nasa.gov/ems/09_visiblelight/ · [ ]
- t022 · [biology, medium] Who has more bones? → A newborn baby (not An adult) — Newborn ≈ 270–300 bones, many fuse; adult 206 · https://www.britannica.com/science/human-skeleton ; Gray's Anatomy (standard reference) · [ ]
- t023 · [biology, easy] Which is the largest organ of the human body? → The skin (not The liver) — Skin is the largest organ; the liver is the largest internal organ · https://www.britannica.com/science/skin · [ ]
- t024 · [biology, hard] Which has more chromosomes in each body cell? → A chimpanzee (not A human) — Chimpanzee 48; human 46 (human chromosome 2 is a fusion of two ape chromosomes) · https://www.genome.gov/about-genomics/fact-sheets/Chromosomes-Fact-Sheet ; Yunis & Prakash (1982) Science 215:1525 · [ ]
- t025 · [biology, easy] Whose pregnancy lasts longer? → An elephant's (not A human's) — Elephant ≈ 22 months; human ≈ 9 months · https://www.britannica.com/animal/elephant-mammal · [ ]
- t026 · [biology, medium] Which animal is more closely related to whales? → The hippopotamus (not The shark) — Hippos are the closest living relatives of whales; sharks are fish · https://www.britannica.com/animal/hippopotamus ; Thewissen et al. (2007) Nature 450:1190 · [ ]
- t027 · [biology, medium] Which is longer in an adult human? → The small intestine (not The large intestine) — Small intestine ≈ 6 m; large intestine ≈ 1.5 m · https://www.britannica.com/science/small-intestine ; https://www.britannica.com/science/large-intestine · [ ]
- t028 · [biology, hard] In an emergency, red blood cells of which type can be given to almost anyone? → O negative (not AB positive) — O negative = universal red-cell donor; AB positive = universal recipient · https://www.redcrossblood.org/donate-blood/blood-types.html · [ ]
- t029 · [math, medium] Which is larger? → 2¹⁰ (not 10³) — 2¹⁰ = 1,024; 10³ = 1,000 · arithmetic · [ ]
- t030 · [math, medium] Which is a prime number? → 97 (not 91) — 91 = 7 × 13; 97 is prime · arithmetic ; https://oeis.org/A000040 · [ ]
- t031 · [math, hard] Which is larger? → √10 (not π) — π ≈ 3.1416; √10 ≈ 3.1623 · arithmetic · [ ]
- t032 · [math, hard] In a room of 23 people, what is the chance that at least two share a birthday? → More than 50% (not Less than 50%) — ≈ 50.7% (365 equally likely birthdays, ignoring 29 Feb) · Feller, An Introduction to Probability Theory and Its Applications, vol. 1 (birthday problem): 1 − 365!/(342!·365²³) ≈ 0.507 · [ ]
- t033 · [math, easy] Which is larger? → 3⁴ (not 4³) — 3⁴ = 81; 4³ = 64 · arithmetic · [ ]
- t034 · [math, easy] You flip a fair coin 3 times. Which is more likely? → Exactly 2 heads (not Exactly 3 heads) — P(2 heads) = 3/8; P(3 heads) = 1/8 · binomial probability (arithmetic) · [ ]
- t035 · [everyday, medium] Gram for gram, which has more calories? → Fat (not Sugar) — Fat ≈ 9 kcal/g; sugar (carbohydrate) ≈ 4 kcal/g · https://www.fao.org/3/y5022e/y5022e04.htm (FAO 2003, Atwater factors) · [ ]
- t036 · [everyday, easy] Cup for cup, which usually has more caffeine? → Brewed coffee (not Green tea) — Brewed coffee ≈ 95 mg per 240 mL; green tea ≈ 30 mg · https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/in-depth/caffeine/art-20049372 · [ ]
- t037 · [everyday, medium] On a standard six-sided die, what do opposite faces add up to? → 7 (not 6) — 1–6, 2–5, 3–4: always 7 · https://www.britannica.com/topic/dice · [ ]
- t038 · [everyday, easy] Which weighs more? → 1 litre of water (not 1 litre of olive oil) — Olive oil ≈ 0.91 kg/L; water ≈ 1.00 kg/L (oil floats) · CRC Handbook of Chemistry and Physics (densities) · [ ]
- t039 · [everyday, hard] Per 100 grams, which has more vitamin C? → A red bell pepper (not An orange) — Red bell pepper ≈ 128 mg; orange ≈ 53 mg (raw) · https://fdc.nal.usda.gov/ (FoodData Central, SR Legacy: peppers, sweet, red, raw; oranges, raw) · [ ]
- t040 · [everyday, hard] Per 100 grams, which has more calories? → An avocado (not A banana) — Avocado ≈ 160 kcal; banana ≈ 89 kcal (raw) · https://fdc.nal.usda.gov/ (FoodData Central, SR Legacy: avocados, raw; bananas, raw) · [ ]

## 90% ranges (20)

- r001 · [geography, medium] How high is Mount Kilimanjaro above sea level? = 5895 m — 5,895 m (some surveys 5,892 m) (Africa) · https://whc.unesco.org/en/list/403 ; https://www.britannica.com/place/Kilimanjaro · [ ]
- r002 · [geography, hard] How tall is Angel Falls in Venezuela, from top to bottom? = 979 m — 979 m total; longest single drop 807 m (South America) · https://www.britannica.com/place/Angel-Falls · [ ]
- r003 · [geography, hard] How long is the Danube River? = 2850 km — ≈ 2,850 km (Europe) · https://www.britannica.com/place/Danube-River · [ ]
- r004 · [geography, medium] How long is Australia's Great Barrier Reef, end to end? = 2300 km — ≈ 2,300 km (Oceania) · https://www.gbrmpa.gov.au/ (Great Barrier Reef Marine Park Authority) ; https://whc.unesco.org/en/list/154 · [ ]
- r005 · [history, medium] In what year did the Ottoman Empire capture Constantinople (today's Istanbul)? = 1453 AD — 29 May 1453 (Europe / West Asia) · https://www.britannica.com/event/Fall-of-Constantinople-1453 · [ ]
- r006 · [history, hard] In what year was Genghis Khan proclaimed ruler of all the Mongols? = 1206 AD — 1206 (East / Central Asia) · https://www.britannica.com/biography/Genghis-Khan · [ ]
- r007 · [history, hard] In what year did Spanish forces capture Tenochtitlan, the Aztec capital? = 1521 AD — 13 Aug 1521 (Americas) · https://www.britannica.com/place/Tenochtitlan · [ ]
- r008 · [history, easy] In what year did Nelson Mandela become president of South Africa? = 1994 AD — May 1994 (Africa) · https://www.britannica.com/biography/Nelson-Mandela · [ ]
- r009 · [physics, easy] How fast does sound travel through air at 20 °C? = 343 m/s — ≈ 343 m/s in dry air · CRC Handbook of Chemistry and Physics (speed of sound in dry air at 20 °C) · [ ]
- r010 · [physics, medium] What is the average distance from Earth to the Moon? = 384400 km — ≈ 384,400 km · https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html · [ ]
- r011 · [physics, easy] How long does sunlight take to reach Earth? = 499 seconds — ≈ 499 s (8 min 19 s) = 1 au ÷ c · IAU 2012 Resolution B2 (1 au = 149,597,870,700 m) ÷ c = 299,792,458 m/s · [ ]
- r012 · [biology, easy] How many bones are in an adult human body? = 206 bones — 206 · https://www.britannica.com/science/human-skeleton · [ ]
- r013 · [biology, hard] On average, how long does a human red blood cell live? = 120 days — ≈ 120 days · https://www.britannica.com/science/red-blood-cell · [ ]
- r014 · [biology, medium] How many pairs of ribs does a typical adult human have? = 12 pairs — 12 pairs (24 ribs) · Gray's Anatomy (standard reference): 12 pairs of ribs · [ ]
- r015 · [math, medium] How many prime numbers are there below 100? = 25 primes — 25 (2, 3, 5, …, 97) · https://oeis.org/A000720 (π(100) = 25) · [ ]
- r016 · [math, medium] In how many different orders can you line up 5 different books on a shelf? = 120 orders — 5! = 120 · arithmetic (5! = 120) · [ ]
- r017 · [math, easy] How many edges does a cube have? = 12 edges — 12 · geometry (a cube has 8 vertices, 12 edges, 6 faces) · [ ]
- r018 · [everyday, easy] How long is a marathon? = 42.195 km — 42.195 km · World Athletics Competition Rules (marathon = 42.195 km) · [ ]
- r019 · [everyday, easy] How many keys does a standard modern piano have? = 88 keys — 88 (52 white, 36 black) · https://www.britannica.com/art/piano · [ ]
- r020 · [everyday, hard] How high above the floor is the rim of a standard basketball hoop? = 305 cm — 3.05 m (10 ft) · FIBA Official Basketball Rules (ring 3.05 m above the floor) · [ ]

## Attention checks (2)

- c001 · [math, easy] Which number is larger? → 100 (not 10) — attention check · attention check (self-evident) · [ ]
- c002 · [everyday, easy] Which of these is an animal? → A dog (not A table) — attention check · attention check (self-evident) · [ ]
