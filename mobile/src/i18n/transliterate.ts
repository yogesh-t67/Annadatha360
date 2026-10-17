/**
 * English-letter names → Telugu script, for showing a farmer's name in the Telugu UI ("Yogesh" → "యోగేష్").
 *
 * English spelling of Indian names is ambiguous (short vs long vowels, త vs ట), so: common names come from
 * a dictionary, everything else from phonetic rules. The farmer can correct the result in their profile
 * ("Name in Telugu"), which always wins.
 */

const NAMES: Record<string, string> = {
  yogesh: 'యోగేష్', suresh: 'సురేష్', ramesh: 'రమేష్', rajesh: 'రాజేష్', mahesh: 'మహేష్', naresh: 'నరేష్',
  dinesh: 'దినేష్', ganesh: 'గణేష్', venkatesh: 'వెంకటేష్', umesh: 'ఉమేష్', mukesh: 'ముఖేష్', rakesh: 'రాకేష్',
  satish: 'సతీష్', harish: 'హరీష్', girish: 'గిరీష్', srinivas: 'శ్రీనివాస్', srinivasa: 'శ్రీనివాస',
  srinu: 'శ్రీను', sreenu: 'శ్రీను', venkat: 'వెంకట్', venkata: 'వెంకట', venkanna: 'వెంకన్న', ravi: 'రవి',
  raju: 'రాజు', ramu: 'రాము', rama: 'రామ', ram: 'రామ్', krishna: 'కృష్ణ', kishore: 'కిషోర్', kiran: 'కిరణ్',
  kumar: 'కుమార్', anil: 'అనిల్', sunil: 'సునీల్', prasad: 'ప్రసాద్', prakash: 'ప్రకాష్', reddy: 'రెడ్డి',
  rao: 'రావు', naidu: 'నాయుడు', chowdary: 'చౌదరి', choudary: 'చౌదరి', yadav: 'యాదవ్', goud: 'గౌడ్',
  nagaraju: 'నాగరాజు', narayana: 'నారాయణ', satyanarayana: 'సత్యనారాయణ', subba: 'సుబ్బ', subbarao: 'సుబ్బారావు',
  appa: 'అప్ప', appala: 'అప్పల', ramana: 'రమణ', ramanaiah: 'రమణయ్య', srikanth: 'శ్రీకాంత్', sai: 'సాయి',
  siva: 'శివ', shiva: 'శివ', shankar: 'శంకర్', sankar: 'శంకర్', balu: 'బాలు', babu: 'బాబు', mohan: 'మోహన్',
  madhu: 'మధు', murali: 'మురళి', nagesh: 'నాగేష్', naveen: 'నవీన్', praveen: 'ప్రవీణ్', pavan: 'పవన్',
  pawan: 'పవన్', vamsi: 'వంశీ', vijay: 'విజయ్', ajay: 'అజయ్', anand: 'ఆనంద్', arjun: 'అర్జున్', ashok: 'అశోక్',
  bhaskar: 'భాస్కర్', chandra: 'చంద్ర', chandu: 'చందు', gopal: 'గోపాల్', hari: 'హరి', jagan: 'జగన్',
  koti: 'కోటి', lokesh: 'లోకేష్', mallesh: 'మల్లేష్', mallaiah: 'మల్లయ్య', narasimha: 'నరసింహ', raghu: 'రఘు',
  ranga: 'రంగ', rajendra: 'రాజేంద్ర', sekhar: 'శేఖర్', shekar: 'శేఖర్', somu: 'సోము', sudhakar: 'సుధాకర్',
  surya: 'సూర్య', tirupati: 'తిరుపతి', upendra: 'ఉపేంద్ర', veeraiah: 'వీరయ్య', yellaiah: 'ఎల్లయ్య',
  satyanand: 'సత్యానంద్', thalluri: 'తల్లూరి', bhargav: 'భార్గవ్', pranay: 'ప్రణయ్', kalyan: 'కళ్యాణ్',
  anjaneyulu: 'ఆంజనేయులు', teja: 'తేజ', tejaswini: 'తేజస్విని', karthik: 'కార్తీక్', manikanta: 'మణికంఠ',
  harika: 'హారిక', mounika: 'మౌనిక', sandeep: 'సందీప్', nikhil: 'నిఖిల్', manoj: 'మనోజ్',
  lakshmi: 'లక్ష్మి', laxmi: 'లక్ష్మి', padma: 'పద్మ', sita: 'సీత', geetha: 'గీత', gita: 'గీత', latha: 'లత',
  lata: 'లత', radha: 'రాధ', rani: 'రాణి', saritha: 'సరిత', sunitha: 'సునీత', anitha: 'అనిత', kavitha: 'కవిత',
  swathi: 'స్వాతి', swapna: 'స్వప్న', jyothi: 'జ్యోతి', durga: 'దుర్గ', parvathi: 'పార్వతి', saraswathi: 'సరస్వతి',
  annapurna: 'అన్నపూర్ణ', mangamma: 'మంగమ్మ', yellamma: 'ఎల్లమ్మ', renuka: 'రేణుక', sujatha: 'సుజాత',
  vani: 'వాణి', usha: 'ఉష', uma: 'ఉమ', devi: 'దేవి', kumari: 'కుమారి', bhavani: 'భవాని', vijaya: 'విజయ',
  shanthi: 'శాంతి', santhi: 'శాంతి', sravani: 'శ్రావణి', divya: 'దివ్య', priya: 'ప్రియ', ramya: 'రమ్య',
};

const VOWELS: [string, string, string][] = [
  // [latin, independent letter, sign after a consonant]
  ['aa', 'ఆ', 'ా'], ['ai', 'ఐ', 'ై'], ['au', 'ఔ', 'ౌ'], ['ou', 'ఔ', 'ౌ'], ['ee', 'ఈ', 'ీ'], ['ii', 'ఈ', 'ీ'], ['oo', 'ఊ', 'ూ'],
  ['uu', 'ఊ', 'ూ'], ['a', 'అ', ''], ['i', 'ఇ', 'ి'], ['u', 'ఉ', 'ు'], ['e', 'ఏ', 'ే'], ['o', 'ఓ', 'ో'],
];

const CONSONANTS: [string, string][] = [
  ['ksh', 'క్ష'], ['chh', 'ఛ'], ['shn', 'ష్ణ'], ['kh', 'ఖ'], ['gh', 'ఘ'], ['ch', 'చ'], ['jh', 'ఝ'], ['th', 'త'],
  ['dh', 'ధ'], ['ph', 'ఫ'], ['bh', 'భ'], ['sh', 'ష'], ['x', 'క్స'], ['q', 'క'], ['k', 'క'], ['g', 'గ'],
  ['c', 'క'], ['j', 'జ'], ['t', 'ట'], ['dd', 'డ్డ'], ['d', 'ద'], ['n', 'న'], ['p', 'ప'], ['b', 'బ'], ['m', 'మ'], ['y', 'య'],
  ['r', 'ర'], ['l', 'ల'], ['v', 'వ'], ['w', 'వ'], ['s', 'స'], ['h', 'హ'], ['f', 'ఫ'], ['z', 'జ'],
];

const VIRAMA = '్';
const ANUSVARA = 'ం';

function match<T extends [string, ...string[]]>(list: T[], s: string, i: number): T | undefined {
  return list.find(([latin]) => s.startsWith(latin, i));
}

function word(w: string): string {
  const lower = w.toLowerCase();
  if (NAMES[lower]) return NAMES[lower];
  if (!/^[a-z]+$/.test(lower)) return w; // already Telugu, initials with dots, etc.

  let s = lower.replace(/^sri/, '\u0000'); // "Sri…" → శ్రీ
  let out = '';
  let i = 0;
  if (s.startsWith('\u0000')) {
    out = 'శ్రీ';
    i = 1;
  }
  let afterConsonant = false;
  while (i < s.length) {
    const c = match(CONSONANTS, s, i);
    if (c) {
      const [latin, telugu] = c;
      // n/m before a different consonant → anusvara (Anand → ఆనంద్, Shankar → శంకర్)
      const next = s[i + 1];
      if ((latin === 'n' || latin === 'm') && next && next !== latin && next !== 'y' && match(CONSONANTS, s, i + 1)) {
        out += ANUSVARA;
        afterConsonant = false;
        i += 1;
        continue;
      }
      // consonant after consonant → conjunct (Krishna → కృష్ణ, Reddy → రెడ్డి)
      if (afterConsonant) out += VIRAMA;
      // word-initial "sh" is usually శ (Shiva, Shankar) and "t" usually త (Teja, Tulasi)
      out += i === 0 && latin === 'sh' ? 'శ' : i === 0 && latin === 't' ? 'త' : telugu;
      afterConsonant = true;
      i += latin.length;
      continue;
    }
    const v = match(VOWELS, s, i);
    if (v) {
      out += afterConsonant ? v[2] : v[1];
      afterConsonant = false;
      i += v[0].length;
      continue;
    }
    i += 1; // unknown character: skip
  }
  if (afterConsonant) out += VIRAMA; // final consonant: Yogesh → …ష్
  return out;
}

/** Transliterate each word of a Latin-script name to Telugu. Telugu input is returned unchanged. */
export function toTeluguName(name: string): string {
  return name
    .trim()
    .split(/(\s+)/)
    .map((part) => (/\s/.test(part) ? part : word(part)))
    .join('');
}

/** Name to show in the current UI language. A name the farmer typed in Telugu always wins. */
export function displayName(name: string, nameTe: string, language: string): string {
  const n = name.trim();
  if (language !== 'te') return n;
  if (nameTe.trim()) return nameTe.trim();
  return /[a-z]/i.test(n) ? toTeluguName(n) : n;
}
