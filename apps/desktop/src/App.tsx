import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./lib/theme";
import { CaptionEditorPage } from "./pages/CaptionEditorPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/edit/:videoId/:clipId" element={<CaptionEditorPage />} />
        <Route path="/results/:videoId" element={<ResultsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<UploadPage />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}
