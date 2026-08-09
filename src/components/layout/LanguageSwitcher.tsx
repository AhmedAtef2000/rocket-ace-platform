import { Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useI18n } from "@/lib/i18n";

/** Header control that switches interface language and flips layout direction for Arabic. */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const active = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("lang.label")}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Globe className="size-3.5" aria-hidden />
        <span className="uppercase">{active.code}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{t("lang.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((option) => (
          <DropdownMenuItem
            key={option.code}
            onSelect={() => setLang(option.code)}
            className={option.code === lang ? "font-semibold text-primary" : undefined}
          >
            <span aria-hidden className="me-2">
              {option.flag}
            </span>
            {option.native}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}