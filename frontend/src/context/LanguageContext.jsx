import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LanguageContext = createContext(null);

// Common backend status, role, and floor translations
const DYNAMIC_TRANSLATIONS_NE = {
  // Billing & KYC Statuses
  UNPAID: 'भुक्तानी बाँकी',
  Unpaid: 'भुक्तानी बाँकी',
  'Pending Verification': 'प्रमाणीकरण बाँकी',
  PENDING_VERIFICATION: 'प्रमाणीकरण बाँकी',
  APPROVED: 'स्वीकृत',
  Approved: 'स्वीकृत',
  'Paid (Cash)': 'नगद भुक्तानी',
  PAID_CASH: 'नगद भुक्तानी',
  REJECTED: 'अस्वीकृत',
  Rejected: 'अस्वीकृत',
  VERIFIED: 'प्रमाणित',
  Verified: 'प्रमाणित',
  PENDING: 'प्रतीक्षामा',
  Pending: 'प्रतीक्षामा',
  NOT_SUBMITTED: 'पेश गरिएको छैन',
  'Not Submitted': 'पेश गरिएको छैन',
  CANCELLED: 'रद्द गरिएको',
  Cancelled: 'रद्द गरिएको',
  OPEN: 'खुला',
  Open: 'खुला',
  IN_PROGRESS: 'प्रक्रियामा',
  'In Progress': 'प्रक्रियामा',
  RESOLVED: 'समाधान भएको',
  Resolved: 'समाधान भएको',

  // Priorities & Categories
  LOW: 'सामान्य',
  Low: 'सामान्य',
  'Normal / Low': 'सामान्य',
  MEDIUM: 'मध्यम',
  Medium: 'मध्यम',
  HIGH: 'अति जरुरी',
  High: 'अति जरुरी',
  'Urgent / High Priority': 'अति जरुरी',
  GENERAL: 'सामान्य सूचना',
  'General Notice': 'सामान्य सूचना',
  MAINTENANCE: 'मर्मत सम्भार',
  Maintenance: 'मर्मत सम्भार',
  URGENT: 'जरुरी सूचना',
  'Urgent Alert': 'जरुरी सूचना',

  // Floors & Room Badges
  GROUND: 'भुइँ तल्ला',
  'Ground Floor': 'भुइँ तल्ला',
  FIRST: 'पहिलो तल्ला',
  'First Floor': 'पहिलो तल्ला',
  'Active Unit': 'सक्रिय कोठा',
  'Landlord / Admin': 'घरधनी / एडमिन',
  Unassigned: 'कोठा तोकिएको छैन',
  'Start a conversation': 'कुराकानी सुरु गर्नुहोस्',
  '📷 Photo attachment': '📷 फोटो संलग्न',
  'Instant Room Reservation': 'तत्काल कोठा बुकिङ',
  'Schedule Physical Visit': 'प्रत्यक्ष अवलोकन समय',
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem('smartrent_lang') === 'ne' ? 'ne' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((newLang) => {
    const normalized = newLang === 'ne' ? 'ne' : 'en';
    setLangState(normalized);
    try {
      localStorage.setItem('smartrent_lang', normalized);
      document.documentElement.lang = normalized;
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLang(lang === 'en' ? 'ne' : 'en');
  }, [lang, setLang]);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      // Ignore
    }
  }, [lang]);

  // Primary inline translator: t("English Text", "नेपाली पाठ")
  const t = useCallback(
    (enText, neText) => {
      if (lang === 'ne' && neText !== undefined && neText !== null && neText !== '') {
        return neText;
      }
      return enText;
    },
    [lang]
  );

  // Translates dynamic backend labels/statuses when Nepali is active
  const td = useCallback(
    (rawValue) => {
      if (!rawValue) return rawValue;
      if (lang !== 'ne') return rawValue;
      const trimmed = String(rawValue).trim();
      if (DYNAMIC_TRANSLATIONS_NE[trimmed]) {
        return DYNAMIC_TRANSLATIONS_NE[trimmed];
      }
      if (trimmed.startsWith('Room ')) {
        return trimmed.replace(/^Room\s+/i, 'कोठा ');
      }
      return rawValue;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider
      value={{
        lang,
        isNepali: lang === 'ne',
        setLang,
        toggleLanguage,
        t,
        td,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// Safe fallback hook so components work even before App.jsx is wrapped
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    const fallbackLang =
      typeof window !== 'undefined' && localStorage.getItem('smartrent_lang') === 'ne'
        ? 'ne'
        : 'en';
    return {
      lang: fallbackLang,
      isNepali: fallbackLang === 'ne',
      setLang: (l) => {
        localStorage.setItem('smartrent_lang', l);
        window.location.reload();
      },
      toggleLanguage: () => {
        const next = fallbackLang === 'en' ? 'ne' : 'en';
        localStorage.setItem('smartrent_lang', next);
        window.location.reload();
      },
      t: (en, ne) => (fallbackLang === 'ne' && ne ? ne : en),
      td: (val) => val,
    };
  }
  return context;
}