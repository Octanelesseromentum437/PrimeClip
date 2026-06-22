import { NavLink } from "react-router-dom";
import { useTheme, type Theme } from "../lib/theme";
import { useLocale } from "../lib/i18n";

const navItems = [
  { to: "/", labelKey: "nav.upload", end: true },
  { to: "/library", labelKey: "nav.library", end: false },
  { to: "/settings", labelKey: "nav.settings", end: false },
  { to: "/help", labelKey: "nav.help", end: false },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const order: Theme[] = ["light", "dark", "system"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const icon =
    theme === "light" ? "☀" : theme === "dark" ? "☾" : "◐";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${theme}`}
      className="sidebar-item w-full justify-center text-base"
    >
      {icon}
    </button>
  );
}

export function Sidebar() {
  const { t } = useLocale();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" data-tauri-drag-region>
        <span className="sidebar-logo">PC</span>
        <span className="sidebar-title">PrimeClip</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? "sidebar-item sidebar-item-active" : "sidebar-item"
            }
          >
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle />
      </div>
    </aside>
  );
}
