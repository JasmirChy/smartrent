// Complete AD to Bikram Sambat (BS) Date & Billing Cycle Formatter
// Automatically formats in English (Baishakh, Jestha...) or Nepali Devanagari (बैशाख, जेठ...)

export const BS_MONTH_NAMES = [
  'Baishakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];

export const BS_MONTH_NAMES_NE = [
  'बैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भाद्र',
  'आश्विन',
  'कार्तिक',
  'मंसिर',
  'पुष',
  'माघ',
  'फाल्गुन',
  'चैत्र',
];

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function toNepaliDigits(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => NEPALI_DIGITS[Number(d)]);
}

function getActiveLang() {
  try {
    return localStorage.getItem('smartrent_lang') === 'ne' ? 'ne' : 'en';
  } catch {
    return 'en';
  }
}

// Official Nepal Panchanga month lengths for BS years 2078 to 2090
const BS_CALENDAR_DATA = {
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 365 days
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 365 days
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 365 days
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 366 days
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 365 days
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 365 days (Ashwin = 31, Kartik = 30)
  2084: [31, 31, 32, 31, 31, 30, 30, 30, 29, 30, 30, 30], // 365 days
  2085: [31, 32, 31, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2086: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2087: [31, 31, 32, 31, 31, 31, 30, 30, 30, 29, 30, 30],
  2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
  2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
  2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
};

// Anchor: 2021-04-14 AD = 1 Baishakh 2078 BS
const ANCHOR_AD_UTC = Date.UTC(2021, 3, 14);
const ANCHOR_BS_YEAR = 2078;

const AD_MONTH_TO_BS_PAIR = {
  january: { pair: 'Poush/Magh', pairNe: 'पुष/माघ', adNe: 'जनवरी', yearOffset: 56 },
  jan: { pair: 'Poush/Magh', pairNe: 'पुष/माघ', adNe: 'जनवरी', yearOffset: 56 },
  february: { pair: 'Magh/Falgun', pairNe: 'माघ/फाल्गुन', adNe: 'फेब्रुअरी', yearOffset: 56 },
  feb: { pair: 'Magh/Falgun', pairNe: 'माघ/फाल्गुन', adNe: 'फेब्रुअरी', yearOffset: 56 },
  march: { pair: 'Falgun/Chaitra', pairNe: 'फाल्गुन/चैत्र', adNe: 'मार्च', yearOffset: 56 },
  mar: { pair: 'Falgun/Chaitra', pairNe: 'फाल्गुन/चैत्र', adNe: 'मार्च', yearOffset: 56 },
  april: { pair: 'Chaitra/Baishakh', pairNe: 'चैत्र/बैशाख', adNe: 'अप्रिल', yearOffset: 57 },
  apr: { pair: 'Chaitra/Baishakh', pairNe: 'चैत्र/बैशाख', adNe: 'अप्रिल', yearOffset: 57 },
  may: { pair: 'Baishakh/Jestha', pairNe: 'बैशाख/जेठ', adNe: 'मे', yearOffset: 57 },
  june: { pair: 'Jestha/Ashadh', pairNe: 'जेठ/असार', adNe: 'जुन', yearOffset: 57 },
  jun: { pair: 'Jestha/Ashadh', pairNe: 'जेठ/असार', adNe: 'जुन', yearOffset: 57 },
  july: { pair: 'Ashadh/Shrawan', pairNe: 'असार/श्रावण', adNe: 'जुलाई', yearOffset: 57 },
  jul: { pair: 'Ashadh/Shrawan', pairNe: 'असार/श्रावण', adNe: 'जुलाई', yearOffset: 57 },
  august: { pair: 'Shrawan/Bhadra', pairNe: 'श्रावण/भाद्र', adNe: 'अगस्ट', yearOffset: 57 },
  aug: { pair: 'Shrawan/Bhadra', pairNe: 'श्रावण/भाद्र', adNe: 'अगस्ट', yearOffset: 57 },
  september: { pair: 'Bhadra/Ashwin', pairNe: 'भाद्र/आश्विन', adNe: 'सेप्टेम्बर', yearOffset: 57 },
  sep: { pair: 'Bhadra/Ashwin', pairNe: 'भाद्र/आश्विन', adNe: 'सेप्टेम्बर', yearOffset: 57 },
  october: { pair: 'Ashwin/Kartik', pairNe: 'आश्विन/कार्तिक', adNe: 'अक्टोबर', yearOffset: 57 },
  oct: { pair: 'Ashwin/Kartik', pairNe: 'आश्विन/कार्तिक', adNe: 'अक्टोबर', yearOffset: 57 },
  november: { pair: 'Kartik/Mangsir', pairNe: 'कार्तिक/मंसिर', adNe: 'नोभेम्बर', yearOffset: 57 },
  nov: { pair: 'Kartik/Mangsir', pairNe: 'कार्तिक/मंसिर', adNe: 'नोभेम्बर', yearOffset: 57 },
  december: { pair: 'Mangsir/Poush', pairNe: 'मंसिर/पुष', adNe: 'डिसेम्बर', yearOffset: 57 },
  dec: { pair: 'Mangsir/Poush', pairNe: 'मंसिर/पुष', adNe: 'डिसेम्बर', yearOffset: 57 },
};

const pad2 = (n) => String(n).padStart(2, '0');

function parseADDate(rawInput) {
  if (!rawInput) return null;
  if (rawInput instanceof Date && !isNaN(rawInput.getTime())) {
    const y = rawInput.getFullYear();
    const m = rawInput.getMonth() + 1;
    const d = rawInput.getDate();
    return {
      year: y,
      month: m,
      day: d,
      displayAD: `${y}-${pad2(m)}-${pad2(d)}`,
    };
  }

  const str = String(rawInput).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
      displayAD: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
    };
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      displayAD: str,
    };
  }
  return null;
}

export function convertADToBS(rawInput) {
  const ad = parseADDate(rawInput);
  if (!ad) return null;

  const targetUTC = Date.UTC(ad.year, ad.month - 1, ad.day);
  let diffDays = Math.floor((targetUTC - ANCHOR_AD_UTC) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const idx = (ad.month + 8) % 12;
    const approxYear = ad.year + 57;
    const approxMonth = BS_MONTH_NAMES[idx];
    const approxMonthNe = BS_MONTH_NAMES_NE[idx];
    return {
      bsYear: approxYear,
      bsMonthIndex: idx,
      bsMonthName: approxMonth,
      bsMonthNameNe: approxMonthNe,
      bsDay: ad.day,
      formattedBS: `${ad.day} ${approxMonth} ${approxYear} BS`,
      formattedBSNe: `${toNepaliDigits(ad.day)} ${approxMonthNe} ${toNepaliDigits(approxYear)} बि.सं.`,
      displayAD: ad.displayAD,
    };
  }

  let bsYear = ANCHOR_BS_YEAR;
  let bsMonthIndex = 0;
  let bsDay = 1;

  while (diffDays > 0) {
    const monthsArray =
      BS_CALENDAR_DATA[bsYear] || [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
    const daysInCurrentMonth = monthsArray[bsMonthIndex];
    const remainingInMonth = daysInCurrentMonth - bsDay;

    if (diffDays <= remainingInMonth) {
      bsDay += diffDays;
      diffDays = 0;
    } else {
      diffDays -= remainingInMonth + 1;
      bsDay = 1;
      bsMonthIndex += 1;
      if (bsMonthIndex >= 12) {
        bsMonthIndex = 0;
        bsYear += 1;
      }
    }
  }

  const bsMonthName = BS_MONTH_NAMES[bsMonthIndex] || 'Baishakh';
  const bsMonthNameNe = BS_MONTH_NAMES_NE[bsMonthIndex] || 'बैशाख';

  return {
    bsYear,
    bsMonthIndex,
    bsMonthName,
    bsMonthNameNe,
    bsDay,
    formattedBS: `${bsDay} ${bsMonthName} ${bsYear} BS`,
    formattedBSNe: `${toNepaliDigits(bsDay)} ${bsMonthNameNe} ${toNepaliDigits(bsYear)} बि.सं.`,
    displayAD: ad.displayAD,
  };
}

export function formatDualDate(rawInput, fallback = 'N/A') {
  const isNe = getActiveLang() === 'ne';
  if (!rawInput) return isNe && fallback === 'N/A' ? 'उपलब्ध छैन' : fallback;
  const str = String(rawInput).trim();
  if (!str || ['Pending', 'Upcoming', 'N/A', 'Verified', 'None'].includes(str)) {
    if (isNe) {
      const map = {
        Pending: 'प्रतीक्षामा',
        Upcoming: 'आगामी',
        'N/A': 'उपलब्ध छैन',
        Verified: 'प्रमाणित',
        None: 'कुनै छैन',
      };
      return map[str] || str || fallback;
    }
    return str || fallback;
  }
  if (str.includes('BS') || str.includes('बि.सं.')) return str;

  const converted = convertADToBS(str);
  if (!converted) return str;
  return isNe
    ? `${converted.displayAD} (${converted.formattedBSNe})`
    : `${converted.displayAD} (${converted.formattedBS})`;
}

export function formatBSOnly(rawInput) {
  if (!rawInput) return '';
  const isNe = getActiveLang() === 'ne';
  const converted = convertADToBS(rawInput);
  if (!converted) return '';
  return isNe ? converted.formattedBSNe : converted.formattedBS;
}

export function formatDualMonthLabel(labelInput) {
  const isNe = getActiveLang() === 'ne';
  if (!labelInput) return isNe ? 'सक्रिय चक्र' : 'Active Cycle';
  const str = String(labelInput).trim();
  if (str.includes('BS') || str.includes('बि.सं.')) return str;

  const match = str.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i
  );
  if (!match) return str;

  const monthKey = match[1].toLowerCase();
  const adYear = Number(match[2]);
  const info = AD_MONTH_TO_BS_PAIR[monthKey];
  if (!info) return str;

  const bsYear = adYear + info.yearOffset;
  if (isNe) {
    return `${str} (${info.pairNe} ${toNepaliDigits(bsYear)} बि.सं.)`;
  }
  return `${str} (${info.pair} ${bsYear} BS)`;
}