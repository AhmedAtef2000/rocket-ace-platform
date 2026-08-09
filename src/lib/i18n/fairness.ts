import type { Pack } from "./packs";

/** Translation strings for the fairness surface. */
const pack: Pack = {
  en: {
    "fair.heading": "Provably fair verification",
    "fair.subtitle":
      "The server seed is hashed and committed before betting opens, then revealed after the round settles. Everything below is recomputed in your browser — nothing here trusts our answer.",
    "fair.revealed.heading": "Revealed rounds",
    "fair.loading": "Loading…",
    "fair.empty": "No settled rounds yet — play a round and it will appear here once the seed is revealed.",
    "fair.table.roundId": "Round ID",
    "fair.table.crash": "Crash",
    "fair.table.totalBets": "Total bets",
    "fair.table.netResult": "Player win / loss",
    "fair.table.check": "Check",
    "fair.status.checking": "Checking…",
    "fair.status.verified": "Verified",
    "fair.status.mismatch": "Mismatch",
    "fair.footnote":
      "Each row is recomputed from the revealed seed inside your browser. Raw seeds and algorithm internals stay out of public view.",
  },
  ar: {
    "fair.heading": "التحقق من العدالة القابلة للإثبات",
    "fair.subtitle":
      "يتم تجزئة بذرة الخادم والالتزام بها قبل فتح الرهان، ثم الكشف عنها بعد تسوية الجولة. يتم إعادة حساب كل ما يلي في متصفحك — لا شيء هنا يثق بإجابتنا.",
    "fair.revealed.heading": "الجولات المكشوفة",
    "fair.loading": "جارٍ التحميل…",
    "fair.empty": "لا توجد جولات مسواة بعد — العب جولة وستظهر هنا بمجرد الكشف عن البذرة.",
    "fair.table.roundId": "رقم الجولة",
    "fair.table.crash": "الانهيار",
    "fair.table.totalBets": "إجمالي الرهانات",
    "fair.table.netResult": "ربح / خسارة اللاعب",
    "fair.table.check": "التحقق",
    "fair.status.checking": "جارٍ التحقق…",
    "fair.status.verified": "تم التحقق",
    "fair.status.mismatch": "عدم تطابق",
    "fair.footnote":
      "يتم إعادة حساب كل صف من البذرة المكشوفة داخل متصفحك. تبقى البذور الخام وتفاصيل الخوارزمية بعيدة عن العرض العام.",
  },
  de: {
    "fair.heading": "Nachweislich faire Verifizierung",
    "fair.subtitle":
      "Der Server-Seed wird gehasht und festgelegt, bevor Wetten geöffnet werden, und danach nach Rundenende offengelegt. Alles unten wird in deinem Browser neu berechnet — nichts hier vertraut unserer Antwort.",
    "fair.revealed.heading": "Aufgedeckte Runden",
    "fair.loading": "Wird geladen…",
    "fair.empty": "Noch keine abgeschlossenen Runden — spiele eine Runde, sie erscheint hier, sobald der Seed offengelegt ist.",
    "fair.table.roundId": "Runden-ID",
    "fair.table.crash": "Crash",
    "fair.table.totalBets": "Gesamteinsätze",
    "fair.table.netResult": "Gewinn / Verlust des Spielers",
    "fair.table.check": "Prüfung",
    "fair.status.checking": "Wird geprüft…",
    "fair.status.verified": "Verifiziert",
    "fair.status.mismatch": "Abweichung",
    "fair.footnote":
      "Jede Zeile wird aus dem offengelegten Seed in deinem Browser neu berechnet. Rohe Seeds und Algorithmusdetails bleiben nicht öffentlich sichtbar.",
  },
};

export default pack;
