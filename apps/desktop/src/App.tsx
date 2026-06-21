import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/results/:videoId" element={<ResultsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<UploadPage />} />
      </Routes>
    </BrowserRouter>
  );
}
