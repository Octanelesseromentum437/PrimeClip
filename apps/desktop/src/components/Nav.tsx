import { Link } from "react-router-dom";

export function Nav() {
  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-brand-500">
        PrimeClip
      </Link>
      <div className="flex gap-4 text-sm">
        <Link to="/" className="hover:text-brand-500">
          Upload
        </Link>
        <Link to="/library" className="hover:text-brand-500">
          Library
        </Link>
        <Link to="/settings" className="hover:text-brand-500">
          Settings
        </Link>
      </div>
    </nav>
  );
}
