import { useEffect, useMemo, useState } from "react";

type Entry = {
  id: string;
  player: string;
  bet: number;
  multiplier: number;
  won: boolean;
  payout: number;
};

const HANDLES = [
  "ahmedatef1",
  "nova_rider",
  "salmakh22",
  "orbitking",
  "mariam_z9",
  "zerogravity",
  "khaled0077",
  "lunatrader",
  "youssefx4",
  "starchaser",
  "dina_says",
  "voyager88",
];

/** Only the last three characters of a handle are ever shown. */
export function maskPlayer(handle: string): string {
  const tail = handle.slice(-3);
  return `****${tail}`;
}

function makeEntry(): Entry {
  const handle = HANDLES[Math.floor(Math.random() * HANDLES.length)]!;
  const bet = Math.round((5 + Math.random() * 245) * 100) / 100;
  const won = Math.random() > 0.42;
  const multiplier = won
    ? Math.round((1.05 + Math.random() * 8) * 100) / 100
    : Math.round((1 + Math.random() * 2) * 100) / 100;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    player: maskPlayer(handle),
    bet,
    multiplier,
    won,
    payout: won ? Math.round(bet * multiplier * 100) / 100 : 0,
  };
}

export function LiveActivityFeed() {
  const initial = useMemo(() => Array.from({ length: 8 }, makeEntry), []);
  const [rows, setRows] = useState<Entry[]>(initial);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRows((current) => [makeEntry(), ...current].slice(0, 8));
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card/70">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Recent player results</caption>
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Player</th>
            <th scope="col" className="px-4 py-3 font-medium">Bet</th>
            <th scope="col" className="px-4 py-3 font-medium">Multiplier</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border/70">
              <td className="px-4 py-3 font-medium tabular-nums">{row.player}</td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {row.bet.toFixed(2)}
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {row.multiplier.toFixed(2)}x
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold tabular-nums ${
                  row.won ? "text-primary" : "text-destructive"
                }`}
              >
                {row.won ? `+${row.payout.toFixed(2)}` : `-${row.bet.toFixed(2)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}