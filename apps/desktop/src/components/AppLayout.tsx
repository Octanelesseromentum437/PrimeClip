import { Outlet, useLocation } from "react-router-dom";
import { ActiveUploadBanner } from "./ActiveUploadBanner";
import { ApiStartupBanner } from "./ApiStartupBanner";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/edit/");

  if (isEditor) {
    return (
      <div className="app-shell editor-root">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <div className="titlebar-drag" data-tauri-drag-region />
        <ApiStartupBanner />
        <ActiveUploadBanner />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
