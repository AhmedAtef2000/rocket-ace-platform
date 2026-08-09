import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇪🇬", dir: "rtl" },
  { code: "de", label: "German", native: "Deutsch", flag: "🇩🇪", dir: "ltr" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "astrobet.lang";

/** Shared chrome + navigation copy. Missing keys fall back to English. */
const dictionary = {
  en: {
    "nav.play": "Play",
    "nav.signIn": "Sign in",
    "nav.register": "Register",
    "nav.signOut": "Sign out",
    "nav.wallet": "Wallet",
    "nav.account": "Account",
    "nav.profile": "Profile",
    "nav.support": "Support",
    "nav.notifications": "Notifications",
    "nav.fairness": "Fairness",
    "nav.backOffice": "Back office",
    "lang.label": "Language",
    "common.loading": "Loading…",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.balance": "Balance",
  },
  ar: {
    "nav.play": "العب",
    "nav.signIn": "تسجيل الدخول",
    "nav.register": "إنشاء حساب",
    "nav.signOut": "تسجيل الخروج",
    "nav.wallet": "المحفظة",
    "nav.account": "الحساب",
    "nav.profile": "الملف الشخصي",
    "nav.support": "الدعم",
    "nav.notifications": "الإشعارات",
    "nav.fairness": "العدالة",
    "nav.backOffice": "لوحة الإدارة",
    "lang.label": "اللغة",
    "common.loading": "جارٍ التحميل…",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.balance": "الرصيد",
  },
  de: {
    "nav.play": "Spielen",
    "nav.signIn": "Anmelden",
    "nav.register": "Registrieren",
    "nav.signOut": "Abmelden",
    "nav.wallet": "Wallet",
    "nav.account": "Konto",
    "nav.profile": "Profil",
    "nav.support": "Support",
    "nav.notifications": "Mitteilungen",
    "nav.fairness": "Fairness",
    "nav.backOffice": "Backoffice",
    "lang.label": "Sprache",
    "common.loading": "Wird geladen…",
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.balance": "Guthaben",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TranslationKey = keyof (typeof dictionary)["en"];

const LOCALES: Record<Lang, string> = { en: "en-US", ar: "ar-EG", de: "de-DE" };

type I18nValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  locale: string;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  formatMoney: (amount: number | string, currency?: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLang(value: string | null): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read the stored preference after hydration so SSR markup stays stable.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
  }, []);

  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — preference stays in memory */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey) => dictionary[lang][key] ?? dictionary.en[key] ?? key,
    [lang],
  );

  const locale = LOCALES[lang];

  const formatMoney = useCallback(
    (amount: number | string, currency = "USD") => {
      const value = typeof amount === "string" ? Number(amount) : amount;
      if (!Number.isFinite(value)) return "—";
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(value);
      } catch {
        return `${value.toFixed(2)} ${currency}`;
      }
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, locale, setLang, t, formatMoney }),
    [lang, dir, locale, setLang, t, formatMoney],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}