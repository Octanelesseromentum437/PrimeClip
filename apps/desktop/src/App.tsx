import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { ActiveUploadBanner } from "./components/ActiveUploadBanner";
import { GlobalJobMonitor } from "./components/GlobalJobMonitor";
import { MenuBridge } from "./components/MenuBridge";
import { syncIconShapeFromStorage } from "./lib/iconShape";
import { LocaleProvider } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { CaptionEditorPage } from "./pages/CaptionEditorPage";
import { HelpPage } from "./pages/HelpPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

export default function App() {
  useEffect(() => {
    void syncIconShapeFromStorage();
  }, []);

  return (
    <ThemeProvider>
      <LocaleProvider>
        <GlobalJobMonitor />
        <BrowserRouter>
          <MenuBridge />
          <ActiveUploadBanner />
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/edit/:videoId/:clipId" element={<CaptionEditorPage />} />
            <Route path="/results/:videoId" element={<ResultsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<UploadPage />} />
          </Routes>
        </BrowserRouter>
      </LocaleProvider>
    </ThemeProvider>
  );
}
