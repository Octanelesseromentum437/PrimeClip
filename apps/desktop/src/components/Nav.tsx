import { Link } from "react-router-dom";
import { useTheme } from "../lib/theme";
import { useLocale } from "../lib/i18n";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const order = ["light", "dark", "system"] as const;
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const label =
    theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  const icon =
    theme === "light" ? (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ) : theme === "dark" ? (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ) : (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label}`}
      className="flex items-center gap-1.5 rounded-lg border border-app-border px-2.5 py-1.5 text-xs text-app-fg-muted hover:bg-app-muted transition-colors"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function Nav() {
  const { t } = useLocale();

  return (
    <nav className="nav-bar">
      <Link to="/" className="text-xl font-bold text-brand-600 dark:text-brand-500">
        PrimeClip
      </Link>
      <div className="flex items-center gap-3 lg:gap-4 text-sm">
        <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
          {t("nav.upload")}
        </Link>
        <Link to="/library" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
          {t("nav.library")}
        </Link>
        <Link to="/settings" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
          {t("nav.settings")}
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
