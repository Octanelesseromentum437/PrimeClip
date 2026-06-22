import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en-US" | "pt-BR";

const STORAGE_KEY = "primeclip-locale";

const translations = {
  "en-US": {
    "nav.upload": "Upload",
    "nav.library": "Library",
    "nav.settings": "Settings",
    "upload.title": "Generate Clips",
    "upload.tab.file": "Local file",
    "upload.tab.url": "URL",
    "upload.tab.drive": "Google Drive",
    "upload.drop": "Drag & drop a video, or",
    "upload.choose": "Choose video file",
    "upload.url.hint":
      "Paste a public YouTube, Vimeo, or Google Drive link. Respect copyright and platform terms.",
    "upload.url.download": "Download video",
    "upload.url.downloading": "Downloading…",
    "upload.url.ready": "Ready",
    "upload.url.openFolder": "Open folder",
    "upload.llm": "LLM Provider",
    "upload.model": "Model",
    "upload.clips": "Number of clips",
    "upload.generate": "Generate Clips",
    "upload.processing": "Processing...",
    "upload.loadingProviders": "Loading providers…",
    "upload.apiKeyHint": "This provider needs an API key. Add it in Settings before generating clips.",
    "results.title": "Results",
    "results.noClips": "No clips generated.",
    "results.noClipsHint":
      "The AI did not find valid clip windows. Try again with a different provider or check the transcript.",
    "progress.title": "Pipeline progress",
    "progress.expand": "Show steps",
    "progress.collapse": "Hide steps",
    "stage.extract_audio": "Extract audio",
    "stage.transcribe": "Transcribe",
    "stage.detect_scenes": "Detect scenes",
    "stage.select_clips": "Select clips (AI)",
    "stage.track_faces": "Track faces",
    "stage.render_clips": "Render clips",
    "stage.done": "Done",
    "stage.status.done": "Completed",
    "stage.status.active": "In progress",
    "stage.status.pending": "Pending",
    "notify.complete": "Clip generation complete!",
    "notify.stage": "Step complete: {stage}",
    "notify.importComplete": "Video download complete!",
    "banner.import": "Downloading video… {pct}%",
    "banner.generating": "Generating clips… {pct}%",
    "banner.view": "View progress",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.systemStatus": "System Status",
    "settings.llm": "LLM Provider",
    "settings.save": "Save",
    "settings.test": "Test Connection",
    "locale.en": "English (US)",
    "locale.pt": "Português (BR)",
  },
  "pt-BR": {
    "nav.upload": "Enviar",
    "nav.library": "Biblioteca",
    "nav.settings": "Configurações",
    "upload.title": "Gerar Clipes",
    "upload.tab.file": "Arquivo local",
    "upload.tab.url": "URL",
    "upload.tab.drive": "Google Drive",
    "upload.drop": "Arraste e solte um vídeo, ou",
    "upload.choose": "Escolher arquivo de vídeo",
    "upload.url.hint":
      "Cole um link público do YouTube, Vimeo ou Google Drive. Respeite direitos autorais e termos das plataformas.",
    "upload.url.download": "Baixar vídeo",
    "upload.url.downloading": "Baixando…",
    "upload.url.ready": "Pronto",
    "upload.url.openFolder": "Abrir pasta",
    "upload.llm": "Provedor LLM",
    "upload.model": "Modelo",
    "upload.clips": "Número de clipes",
    "upload.generate": "Gerar Clipes",
    "upload.processing": "Processando...",
    "upload.loadingProviders": "Carregando provedores…",
    "upload.apiKeyHint":
      "Este provedor precisa de uma chave de API. Adicione em Configurações antes de gerar clipes.",
    "results.title": "Resultados",
    "results.noClips": "Nenhum clipe gerado.",
    "results.noClipsHint":
      "A IA não encontrou janelas válidas. Tente novamente com outro provedor ou verifique a transcrição.",
    "progress.title": "Progresso do pipeline",
    "progress.expand": "Ver etapas",
    "progress.collapse": "Ocultar etapas",
    "stage.extract_audio": "Extrair áudio",
    "stage.transcribe": "Transcrever",
    "stage.detect_scenes": "Detectar cenas",
    "stage.select_clips": "Selecionar clipes (IA)",
    "stage.track_faces": "Rastrear rostos",
    "stage.render_clips": "Renderizar clipes",
    "stage.done": "Concluído",
    "stage.status.done": "Concluída",
    "stage.status.active": "Em andamento",
    "stage.status.pending": "Pendente",
    "notify.complete": "Geração de clipes concluída!",
    "notify.stage": "Etapa concluída: {stage}",
    "notify.importComplete": "Download do vídeo concluído!",
    "banner.import": "Baixando vídeo… {pct}%",
    "banner.generating": "Gerando clipes… {pct}%",
    "banner.view": "Ver progresso",
    "settings.title": "Configurações",
    "settings.language": "Idioma",
    "settings.systemStatus": "Status do sistema",
    "settings.llm": "Provedor LLM",
    "settings.save": "Salvar",
    "settings.test": "Testar conexão",
    "locale.en": "English (US)",
    "locale.pt": "Português (BR)",
  },
} as const;

export type TranslationKey = keyof typeof translations["en-US"];

function readStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en-US" || stored === "pt-BR") return stored;
  return navigator.language.startsWith("pt") ? "pt-BR" : "en-US";
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text: string = translations[locale][key] ?? translations["en-US"][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
