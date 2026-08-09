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
const CURRENCY_KEY = "astrobet.currency";
const COUNTRY_KEY = "astrobet.country";

export const CURRENCIES = ["USD", "EUR", "EGP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

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
    "nav.home": "Home",
    "nav.crash": "Crash",
    "nav.transactions": "Transactions",
    "nav.overview": "Overview",
    "nav.verification": "Verification",
    "nav.messages": "Messages",
    "nav.settings": "Settings",
    "nav.vipFairness": "VIP & Fairness",
    "nav.helpSupport": "Help & Support",
    "nav.deposit": "Deposit",
    "nav.withdraw": "Withdraw",
    "nav.signInToFund": "Sign in to fund your account",
    "nav.player": "Player",
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
    "home.ctaPrimary": "Invite",
    "home.ctaSecondary": "Bet Now",
    "home.statRound": "Round length",
    "home.statMax": "Max multiplier",
    "home.statEdge": "Players deposited",
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
    "home.betAmount": "Bet amount",
    "home.autoCashout": "Auto cashout",
    "home.stakeShown": "Stake shown as {v}",
    "home.placeBet": "Place Bet",
    "home.max": "MAX",
    "home.recentRounds": "Recent rounds",
    "home.live": "Live",
    "home.colPlayer": "Player",
    "home.colCrash": "Crash",
    "home.colResult": "Result",
    "home.checkRound": "Check Round",
    "home.welcomeBoost": "Welcome boost",
    "home.play": "Play",
    "home.lowEdge": "Low house edge",
    "home.referEarn": "Refer & earn",
    "home.invite": "Invite",
    "home.games": "Games",
    "home.onlyGame": "Crash is our only game",
    "home.astroCrash": "Astro Crash",
    "home.playNow": "Play now",
    "home.comingSoon": "Coming soon",
    "home.gameAutoBet": "Auto-bet mode",
    "home.gameTournaments": "Tournaments",
    "home.gameHighRoller": "High-roller table",
    "home.trustFairTitle": "Provably Fair",
    "home.trustFairBody": "100% verifiable",
    "home.trustFastTitle": "Fast Withdrawals",
    "home.trustFastBody": "Within 1 hours",
    "home.trustSecureTitle": "Secure & Trusted",
    "home.trustSecureBody": "Encrypted end to end",
    "home.trustSupportTitle": "24/7 Support",
    "home.trustSupportBody": "Here for you",
    "game.placeBet": "Place your bet",
    "game.nextRoundIn": "Next round in",
    "game.sec": "SEC",
    "game.currentMultiplier": "Current multiplier",
    "game.crashed": "Crashed",
    "game.launchingIn": "Launching in {s}s",
    "game.boarding": "Boarding",
    "auth.title": "Account access",
    "auth.subtitle": "Sign in to your AstroBet account, or create one in under a minute.",
    "auth.signIn": "Sign in",
    "auth.createAccount": "Create account",
    "auth.identifier": "Email or phone number",
    "auth.password": "Password",
    "auth.forgot": "Forgot password?",
    "auth.firstName": "First name",
    "auth.lastName": "Last name",
    "auth.dob": "Date of birth",
    "auth.email": "Email",
    "auth.phone": "Phone number",
    "auth.countryCode": "Country code",
    "auth.phoneInvalid": "Enter a valid phone number for {c} — {n} digits after the country code.",
    "auth.fillAll": "Please fill in every field to create your account.",
    "auth.currency": "Account currency",
    "auth.currencyHint": "Your balances, bets and payouts are held in this currency.",
    "auth.confirmPassword": "Confirm password",
    "auth.passwordsMismatch": "Passwords do not match.",
    "auth.passwordNeeds": "Password needs {p}.",
    "auth.ageNotice": "You must be of legal age in your jurisdiction to open an AstroBet account.",
    "auth.or": "or",
    "auth.google": "Continue with Google",
    "auth.apple": "Continue with Apple",
    "auth.verifyTitle": "Verify your account",
    "auth.verifyBody": "We sent a verification link to {email}. Open it to activate your AstroBet account, then come back here to sign in.",
    "auth.backToSignIn": "Back to sign in",
    "auth.signedIn": "Signed in",
    "auth.accountCreated": "Account created",
    "auth.verificationSent": "Verification code sent — check your email.",
    "auth.signInFailed": "Could not sign you in.",
    "auth.signUpFailed": "Could not create your account.",
    "auth.resetNeedsEmail": "Enter your email address to reset your password.",
    "auth.resetSent": "Password reset email sent",
    "auth.showPassword": "Show password",
    "auth.hidePassword": "Hide password",
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
    "nav.home": "الرئيسية",
    "nav.crash": "كراش",
    "nav.transactions": "المعاملات",
    "nav.overview": "نظرة عامة",
    "nav.verification": "التحقق",
    "nav.messages": "الرسائل",
    "nav.settings": "الإعدادات",
    "nav.vipFairness": "كبار اللاعبين والعدالة",
    "nav.helpSupport": "المساعدة والدعم",
    "nav.deposit": "إيداع",
    "nav.withdraw": "سحب",
    "nav.signInToFund": "سجّل الدخول لتمويل حسابك",
    "nav.player": "لاعب",
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
    "home.statEdge": "لاعبون أودعوا",
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
    "home.betAmount": "قيمة الرهان",
    "home.autoCashout": "السحب التلقائي",
    "home.stakeShown": "الرهان يظهر كـ {v}",
    "home.placeBet": "ضع الرهان",
    "home.max": "الأقصى",
    "home.recentRounds": "الجولات الأخيرة",
    "home.live": "مباشر",
    "home.colPlayer": "اللاعب",
    "home.colCrash": "الانفجار",
    "home.colResult": "النتيجة",
    "home.checkRound": "تحقق من الجولة",
    "home.welcomeBoost": "مكافأة الترحيب",
    "home.play": "العب",
    "home.lowEdge": "هامش ربح منخفض",
    "home.referEarn": "ادعُ واربح",
    "home.invite": "دعوة",
    "home.games": "الألعاب",
    "home.onlyGame": "كراش هي لعبتنا الوحيدة",
    "home.astroCrash": "أسترو كراش",
    "home.playNow": "العب الآن",
    "home.comingSoon": "قريبًا",
    "home.gameAutoBet": "وضع الرهان التلقائي",
    "home.gameTournaments": "البطولات",
    "home.gameHighRoller": "طاولة كبار اللاعبين",
    "home.trustFairTitle": "عدالة مثبتة",
    "home.trustFairBody": "قابلة للتحقق 100%",
    "home.trustFastTitle": "سحب سريع",
    "home.trustFastBody": "خلال ساعة واحدة",
    "home.trustSecureTitle": "آمن وموثوق",
    "home.trustSecureBody": "تشفير من طرف إلى طرف",
    "home.trustSupportTitle": "دعم 24/7",
    "home.trustSupportBody": "نحن هنا من أجلك",
    "game.placeBet": "ضع رهانك",
    "game.nextRoundIn": "الجولة التالية خلال",
    "game.sec": "ثانية",
    "game.currentMultiplier": "المضاعف الحالي",
    "game.crashed": "انفجر",
    "game.launchingIn": "الانطلاق خلال {s} ث",
    "game.boarding": "الاستعداد",
    "auth.title": "الدخول إلى الحساب",
    "auth.subtitle": "سجّل الدخول إلى حسابك في أسترو بيت أو أنشئ حسابًا في أقل من دقيقة.",
    "auth.signIn": "تسجيل الدخول",
    "auth.createAccount": "إنشاء حساب",
    "auth.identifier": "البريد الإلكتروني أو رقم الهاتف",
    "auth.password": "كلمة المرور",
    "auth.forgot": "نسيت كلمة المرور؟",
    "auth.firstName": "الاسم الأول",
    "auth.lastName": "اسم العائلة",
    "auth.dob": "تاريخ الميلاد",
    "auth.email": "البريد الإلكتروني",
    "auth.phone": "رقم الهاتف",
    "auth.countryCode": "رمز الدولة",
    "auth.phoneInvalid": "أدخل رقم هاتف صحيحًا لـ {c} — {n} أرقام بعد رمز الدولة.",
    "auth.fillAll": "يرجى ملء جميع الحقول لإنشاء حسابك.",
    "auth.currency": "عملة الحساب",
    "auth.currencyHint": "أرصدتك ورهاناتك وأرباحك تُحفظ بهذه العملة.",
    "auth.confirmPassword": "تأكيد كلمة المرور",
    "auth.passwordsMismatch": "كلمتا المرور غير متطابقتين.",
    "auth.passwordNeeds": "كلمة المرور تحتاج {p}.",
    "auth.ageNotice": "يجب أن تكون في السن القانوني في بلدك لفتح حساب في أسترو بيت.",
    "auth.or": "أو",
    "auth.google": "المتابعة عبر جوجل",
    "auth.apple": "المتابعة عبر آبل",
    "auth.verifyTitle": "فعّل حسابك",
    "auth.verifyBody": "أرسلنا رابط تفعيل إلى {email}. افتحه لتفعيل حسابك ثم عد لتسجيل الدخول.",
    "auth.backToSignIn": "العودة لتسجيل الدخول",
    "auth.signedIn": "تم تسجيل الدخول",
    "auth.accountCreated": "تم إنشاء الحساب",
    "auth.verificationSent": "تم إرسال رسالة التفعيل — تحقق من بريدك.",
    "auth.signInFailed": "تعذّر تسجيل دخولك.",
    "auth.signUpFailed": "تعذّر إنشاء حسابك.",
    "auth.resetNeedsEmail": "أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور.",
    "auth.resetSent": "تم إرسال رسالة إعادة التعيين",
    "auth.showPassword": "إظهار كلمة المرور",
    "auth.hidePassword": "إخفاء كلمة المرور",
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
    "nav.home": "Start",
    "nav.crash": "Crash",
    "nav.transactions": "Transaktionen",
    "nav.overview": "Übersicht",
    "nav.verification": "Verifizierung",
    "nav.messages": "Nachrichten",
    "nav.settings": "Einstellungen",
    "nav.vipFairness": "VIP & Fairness",
    "nav.helpSupport": "Hilfe & Support",
    "nav.deposit": "Einzahlen",
    "nav.withdraw": "Auszahlen",
    "nav.signInToFund": "Melde dich an, um einzuzahlen",
    "nav.player": "Spieler",
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
    "home.statEdge": "Spieler mit Einzahlung",
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
    "home.betAmount": "Einsatz",
    "home.autoCashout": "Auto-Auszahlung",
    "home.stakeShown": "Einsatz angezeigt als {v}",
    "home.placeBet": "Einsatz setzen",
    "home.max": "MAX",
    "home.recentRounds": "Letzte Runden",
    "home.live": "Live",
    "home.colPlayer": "Spieler",
    "home.colCrash": "Crash",
    "home.colResult": "Ergebnis",
    "home.checkRound": "Runde prüfen",
    "home.welcomeBoost": "Willkommensbonus",
    "home.play": "Spielen",
    "home.lowEdge": "Niedriger Hausvorteil",
    "home.referEarn": "Empfehlen & verdienen",
    "home.invite": "Einladen",
    "home.games": "Spiele",
    "home.onlyGame": "Crash ist unser einziges Spiel",
    "home.astroCrash": "Astro Crash",
    "home.playNow": "Jetzt spielen",
    "home.comingSoon": "Demnächst",
    "home.gameAutoBet": "Auto-Bet-Modus",
    "home.gameTournaments": "Turniere",
    "home.gameHighRoller": "High-Roller-Tisch",
    "home.trustFairTitle": "Nachweislich fair",
    "home.trustFairBody": "100 % überprüfbar",
    "home.trustFastTitle": "Schnelle Auszahlungen",
    "home.trustFastBody": "Innerhalb 1 Stunde",
    "home.trustSecureTitle": "Sicher & vertrauenswürdig",
    "home.trustSecureBody": "Ende-zu-Ende verschlüsselt",
    "home.trustSupportTitle": "24/7 Support",
    "home.trustSupportBody": "Für dich da",
    "game.placeBet": "Setze deinen Einsatz",
    "game.nextRoundIn": "Nächste Runde in",
    "game.sec": "SEK",
    "game.currentMultiplier": "Aktueller Multiplikator",
    "game.crashed": "Abgestürzt",
    "game.launchingIn": "Start in {s}s",
    "game.boarding": "Boarding",
    "auth.title": "Kontozugang",
    "auth.subtitle": "Melde dich bei AstroBet an oder erstelle in einer Minute ein Konto.",
    "auth.signIn": "Anmelden",
    "auth.createAccount": "Konto erstellen",
    "auth.identifier": "E-Mail oder Telefonnummer",
    "auth.password": "Passwort",
    "auth.forgot": "Passwort vergessen?",
    "auth.firstName": "Vorname",
    "auth.lastName": "Nachname",
    "auth.dob": "Geburtsdatum",
    "auth.email": "E-Mail",
    "auth.phone": "Telefonnummer",
    "auth.countryCode": "Ländervorwahl",
    "auth.phoneInvalid": "Gib eine gültige Telefonnummer für {c} ein — {n} Ziffern nach der Vorwahl.",
    "auth.fillAll": "Bitte fülle alle Felder aus, um dein Konto zu erstellen.",
    "auth.currency": "Kontowährung",
    "auth.currencyHint": "Guthaben, Einsätze und Auszahlungen laufen in dieser Währung.",
    "auth.confirmPassword": "Passwort bestätigen",
    "auth.passwordsMismatch": "Passwörter stimmen nicht überein.",
    "auth.passwordNeeds": "Passwort benötigt {p}.",
    "auth.ageNotice": "Du musst in deiner Jurisdiktion volljährig sein, um ein AstroBet-Konto zu eröffnen.",
    "auth.or": "oder",
    "auth.google": "Weiter mit Google",
    "auth.apple": "Weiter mit Apple",
    "auth.verifyTitle": "Konto bestätigen",
    "auth.verifyBody": "Wir haben einen Bestätigungslink an {email} gesendet. Öffne ihn und melde dich danach an.",
    "auth.backToSignIn": "Zurück zur Anmeldung",
    "auth.signedIn": "Angemeldet",
    "auth.accountCreated": "Konto erstellt",
    "auth.verificationSent": "Bestätigungsmail gesendet — prüfe dein Postfach.",
    "auth.signInFailed": "Anmeldung nicht möglich.",
    "auth.signUpFailed": "Konto konnte nicht erstellt werden.",
    "auth.resetNeedsEmail": "Gib deine E-Mail-Adresse ein, um das Passwort zurückzusetzen.",
    "auth.resetSent": "E-Mail zum Zurücksetzen gesendet",
    "auth.showPassword": "Passwort anzeigen",
    "auth.hidePassword": "Passwort verbergen",
  },
} satisfies Record<Lang, Record<string, string>>;

export type TranslationKey = keyof (typeof dictionary)["en"];

const LOCALES: Record<Lang, string> = { en: "en-US", ar: "ar-EG", de: "de-DE" };

type I18nValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  locale: string;
  setLang: (lang: Lang) => void;
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  /** ISO-3166 alpha-2 detected from the visitor's connection (null until resolved). */
  country: string | null;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatMoney: (amount: number | string, currency?: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLang(value: string | null): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [country, setCountry] = useState<string | null>(null);

  // Read the stored preference after hydration so SSR markup stays stable.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
    const storedCurrency = window.localStorage.getItem(CURRENCY_KEY);
    if (storedCurrency && (CURRENCIES as readonly string[]).includes(storedCurrency)) {
      setCurrencyState(storedCurrency as CurrencyCode);
    }

    // Detect the visitor's country and apply its currency when they have no preference yet.
    let cancelled = false;
    void (async () => {
      try {
        const stored2 = window.localStorage.getItem(COUNTRY_KEY);
        let iso = stored2;
        if (!iso) {
          const res = await fetch("/api/public/geo");
          const body = (await res.json()) as { country?: string | null };
          iso = body.country ?? null;
          if (!iso) {
            const region = new Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
            iso = region.startsWith("Africa/Cairo") ? "EG" : null;
          }
          if (iso) window.localStorage.setItem(COUNTRY_KEY, iso);
        }
        if (cancelled || !iso) return;
        setCountry(iso);
        if (!storedCurrency) {
          const { countryByIso } = await import("@/lib/countries");
          const detected = countryByIso(iso)?.currency;
          if (detected && !cancelled) setCurrencyState(detected);
        }
      } catch {
        /* detection is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    try {
      window.localStorage.setItem(CURRENCY_KEY, next);
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
    (amount: number | string, override?: string) => {
      const code = override ?? currency;
      const value = typeof amount === "string" ? Number(amount) : amount;
      if (!Number.isFinite(value)) return "—";
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: code,
          maximumFractionDigits: 2,
        }).format(value);
      } catch {
        return `${value.toFixed(2)} ${code}`;
      }
    },
    [locale, currency],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, locale, setLang, currency, setCurrency, country, t, formatMoney }),
    [lang, dir, locale, setLang, currency, setCurrency, country, t, formatMoney],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}