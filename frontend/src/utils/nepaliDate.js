// Complete AD to Bikram Sambat (BS) Date & Billing Cycle Formatter
// Uses English-script Nepali month names: Baishakh, Jestha, Ashadh, Shrawan, Bhadra, Ashwin, Kartik, Mangsir, Poush, Magh, Falgun, Chaitra

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

// Official Nepal Panchanga month lengths for BS years 2078 to 2090
const BS_CALENDAR_DATA = {
  2078: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30], // 365 days
  2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 365 days
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30], // 365 days
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31], // 366 days
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30], // 365 days
  2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30], // 365 days (Ashwin = 31, Kartik = 30, Mangsir = 29, Poush = 30, Magh = 29)
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
  january: { pair: 'Poush/Magh', yearOffset: 56 },
  jan: { pair: 'Poush/Magh', yearOffset: 56 },
  february: { pair: 'Magh/Falgun', yearOffset: 56 },
  feb: { pair: 'Magh/Falgun', yearOffset: 56 },
  march: { pair: 'Falgun/Chaitra', yearOffset: 56 },
  mar: { pair: 'Falgun/Chaitra', yearOffset: 56 },
  april: { pair: 'Chaitra/Baishakh', yearOffset: 57 },
  apr: { pair: 'Chaitra/Baishakh', yearOffset: 57 },
  may: { pair: 'Baishakh/Jestha', yearOffset: 57 },
  june: { pair: 'Jestha/Ashadh', yearOffset: 57 },
  jun: { pair: 'Jestha/Ashadh', yearOffset: 57 },
  july: { pair: 'Ashadh/Shrawan', yearOffset: 57 },
  jul: { pair: 'Ashadh/Shrawan', yearOffset: 57 },
  august: { pair: 'Shrawan/Bhadra', yearOffset: 57 },
  aug: { pair: 'Shrawan/Bhadra', yearOffset: 57 },
  september: { pair: 'Bhadra/Ashwin', yearOffset: 57 },
  sep: { pair: 'Bhadra/Ashwin', yearOffset: 57 },
  october: { pair: 'Ashwin/Kartik', yearOffset: 57 },
  oct: { pair: 'Ashwin/Kartik', yearOffset: 57 },
  november: { pair: 'Kartik/Mangsir', yearOffset: 57 },
  nov: { pair: 'Kartik/Mangsir', yearOffset: 57 },
  december: { pair: 'Mangsir/Poush', yearOffset: 57 },
  dec: { pair: 'Mangsir/Poush', yearOffset: 57 },
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
    const approxYear = ad.year + 57;
    const approxMonth = BS_MONTH_NAMES[(ad.month + 8) % 12];
    return {
      bsYear: approxYear,
      bsMonthIndex: (ad.month + 8) % 12,
      bsMonthName: approxMonth,
      bsDay: ad.day,
      formattedBS: `${ad.day} ${approxMonth} ${approxYear} BS`,
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
  return {
    bsYear,
    bsMonthIndex,
    bsMonthName,
    bsDay,
    formattedBS: `${bsDay} ${bsMonthName} ${bsYear} BS`,
    displayAD: ad.displayAD,
  };
}

/**
 * Formats any AD date into "YYYY-MM-DD (DD MonthName YYYY BS)"
 * e.g. "2026-11-13" -> "2026-11-13 (27 Kartik 2083 BS)"
 */
export function formatDualDate(rawInput, fallback = 'N/A') {
  if (!rawInput) return fallback;
  const str = String(rawInput).trim();
  if (!str || ['Pending', 'Upcoming', 'N/A', 'Verified', 'None'].includes(str)) {
    return str || fallback;
  }
  if (str.includes('BS')) return str;

  const converted = convertADToBS(str);
  if (!converted) return str;
  return `${converted.displayAD} (${converted.formattedBS})`;
}

/**
 * Returns only the BS date string, e.g. "27 Kartik 2083 BS"
 */
export function formatBSOnly(rawInput) {
  if (!rawInput) return '';
  const converted = convertADToBS(rawInput);
  return converted ? converted.formattedBS : '';
}

/**
 * Formats a Billing Month Label like "December 2026" into:
 * "December 2026 (Mangsir/Poush 2083 BS)"
 */
export function formatDualMonthLabel(labelInput) {
  if (!labelInput) return 'Active Cycle';
  const str = String(labelInput).trim();
  if (str.includes('BS')) return str;

  const match = str.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i
  );
  if (!match) return str;

  const monthKey = match[1].toLowerCase();
  const adYear = Number(match[2]);
  const info = AD_MONTH_TO_BS_PAIR[monthKey];
  if (!info) return str;

  const bsYear = adYear + info.yearOffset;
  return `${str} (${info.pair} ${bsYear} BS)`;
}