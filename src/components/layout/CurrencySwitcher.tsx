import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CURRENCIES, useI18n } from "@/lib/i18n";

/** Header control that switches the display currency used for money formatting. */
export function CurrencySwitcher() {
  const { currency, setCurrency } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Currency"
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {currency}
        <ChevronDown className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuLabel>Currency</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CURRENCIES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setCurrency(code)}
            className={code === currency ? "font-semibold text-primary" : undefined}
          >
            {code}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}