import type { AppLocale } from "../i18n/catalog";
import { LOCALE_LABEL } from "../i18n/catalog";
import { useI18n } from "../i18n/context";
import { cn } from "../lib/cn";

const FLAGS: Record<AppLocale, string> = {
  "pt-BR": "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
};

export function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale, t } = useI18n();
  const locales: AppLocale[] = ["pt-BR", "en", "es"];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-0.5 shadow-sm",
        variant === "dark" ? "border-zinc-600 bg-zinc-800" : "border-zinc-200 bg-white",
      )}
      role="group"
      aria-label={t("lang.choose")}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          title={LOCALE_LABEL[l]}
          className={cn(
            "rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-wide transition",
            locale === l
              ? variant === "dark"
                ? "bg-white text-zinc-900"
                : "bg-teal-600 text-white"
              : variant === "dark"
                ? "text-zinc-200 hover:bg-zinc-700"
                : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          <span className="mr-0.5" aria-hidden>
            {FLAGS[l]}
          </span>
          {LOCALE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
