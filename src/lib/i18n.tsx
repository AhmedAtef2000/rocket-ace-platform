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
    "home.badge": "Provably fair · 18+",
    "home.heroLine1": "Your heart beats",
    "home.heroLine2": "with the multiplier.",
    "home.heroBody":
      "AstroBet turns a single number into pure adrenaline. The rocket climbs, the crowd holds its breath, and one tap decides everything. Provably fair. Server-authoritative. Unforgettable.",
    "home.ctaPrimary": "Launch your first round",
    "home.ctaSecondary": "Verify a round",
    "home.statRound": "Round length",
    "home.statMax": "Max multiplier",
    "home.statEdge": "House edge",
    "home.pillar1Title": "One tap to launch",
    "home.pillar1Body":
      "Place your stake, feel the countdown, then watch the rocket tear off the pad. No forms, no friction.",
    "home.pillar2Title": "Cash out on instinct",
    "home.pillar2Body":
      "Every tenth of a second the multiplier climbs. Greed or discipline — the choice is yours, and it is instant.",
    "home.pillar3Title": "Provably fair, always",
    "home.pillar3Body":
      "The crash point is committed before you bet and revealed after. Verify any round yourself in one click.",
    "home.liveResults": "Live player results",
    "home.disclaimer":
      "Gambling involves risk. AstroBet is intended solely for lawful, licensed operation in permitted jurisdictions, with age verification, KYC/AML checks and responsible gambling controls enforced before any real-money play.",
    "game.launchingIn": "Launching in {s}s",
    "game.boarding": "Boarding",
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
    "home.badge": "عدالة مثبتة · +18",
    "home.heroLine1": "قلبك ينبض",
    "home.heroLine2": "مع المضاعف.",
    "home.heroBody":
      "أسترو بيت يحوّل رقمًا واحدًا إلى أدرينالين خالص. الصاروخ يصعد، والجميع يحبس أنفاسه، ونقرة واحدة تحسم كل شيء. عدالة مثبتة وتحكم كامل من الخادم.",
    "home.ctaPrimary": "ابدأ جولتك الأولى",
    "home.ctaSecondary": "تحقق من جولة",
    "home.statRound": "مدة الجولة",
    "home.statMax": "أقصى مضاعف",
    "home.statEdge": "نسبة الصالة",
    "home.pillar1Title": "نقرة واحدة للانطلاق",
    "home.pillar1Body":
      "ضع رهانك، عِش العد التنازلي، ثم شاهد الصاروخ ينطلق. بلا نماذج ولا تعقيد.",
    "home.pillar2Title": "اسحب أرباحك بحدسك",
    "home.pillar2Body":
      "كل جزء من الثانية يرتفع المضاعف. الطمع أو الانضباط — القرار لك، وفوري.",
    "home.pillar3Title": "عدالة مثبتة دائمًا",
    "home.pillar3Body":
      "نقطة الانفجار تُحدَّد قبل رهانك وتُكشف بعده. تحقق من أي جولة بنفسك بنقرة واحدة.",
    "home.liveResults": "نتائج اللاعبين المباشرة",
    "home.disclaimer":
      "المقامرة تنطوي على مخاطر. أسترو بيت مخصص للتشغيل المرخّص والقانوني في الولايات المسموح بها فقط، مع التحقق من العمر وإجراءات اعرف عميلك ومكافحة غسل الأموال وأدوات اللعب المسؤول.",
    "game.launchingIn": "الانطلاق خلال {s} ث",
    "game.boarding": "الاستعداد",
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
    "home.badge": "Nachweislich fair · 18+",
    "home.heroLine1": "Dein Herz schlägt",
    "home.heroLine2": "im Takt des Multiplikators.",
    "home.heroBody":
      "AstroBet verwandelt eine einzige Zahl in pures Adrenalin. Die Rakete steigt, alle halten den Atem an, und ein Tipp entscheidet alles. Nachweislich fair. Servergesteuert.",
    "home.ctaPrimary": "Erste Runde starten",
    "home.ctaSecondary": "Runde verifizieren",
    "home.statRound": "Rundenlänge",
    "home.statMax": "Max. Multiplikator",
    "home.statEdge": "Hausvorteil",
    "home.pillar1Title": "Ein Tipp zum Start",
    "home.pillar1Body":
      "Einsatz setzen, Countdown spüren und zusehen, wie die Rakete abhebt. Keine Formulare, keine Reibung.",
    "home.pillar2Title": "Auszahlen aus dem Bauch",
    "home.pillar2Body":
      "Jede Zehntelsekunde steigt der Multiplikator. Gier oder Disziplin — die Wahl liegt bei dir, sofort.",
    "home.pillar3Title": "Immer nachweislich fair",
    "home.pillar3Body":
      "Der Crash-Punkt wird vor deinem Einsatz festgelegt und danach offengelegt. Jede Runde in einem Klick prüfbar.",
    "home.liveResults": "Live-Ergebnisse der Spieler",
    "home.disclaimer":
      "Glücksspiel birgt Risiken. AstroBet ist ausschließlich für den lizenzierten, rechtmäßigen Betrieb in zugelassenen Jurisdiktionen bestimmt — mit Altersprüfung, KYC/AML-Kontrollen und Verantwortungsspiel-Maßnahmen.",
    "game.launchingIn": "Start in {s}s",
    "game.boarding": "Boarding",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TranslationKey = keyof (typeof dictionary)["en"];

const LOCALES: Record<Lang, string> = { en: "en-US", ar: "ar-EG", de: "de-DE" };

type I18nValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  locale: string;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
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
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const raw: string = dictionary[lang][key] ?? dictionary.en[key] ?? key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, (m, p: string) =>
        p in params ? String(params[p]) : m,
      );
    },
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