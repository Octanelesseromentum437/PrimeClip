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
    "nav.help": "Help",
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
    "results.cancel": "Cancel generation",
    "results.cancelling": "Cancelling…",
    "results.cancelled": "Generation was cancelled.",
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
    "banner.apiStarting": "Starting PrimeClip API… ({sec}s — first launch can take up to a minute)",
    "banner.apiFailed": "PrimeClip API failed to start. Try quitting and reopening the app.",
    "banner.view": "View progress",
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.systemStatus": "System Status",
    "settings.llm": "LLM Provider",
    "settings.save": "Save",
    "settings.test": "Test Connection",
    "settings.iconShape": "App icon shape",
    "settings.iconShapeHint":
      "Changes the dock/taskbar icon while the app is running. Rebuild the app to update the icon in Applications.",
    "settings.iconShape.square": "Square",
    "settings.iconShape.rounded": "Rounded",
    "settings.iconShape.circle": "Circle",
    "locale.en": "English (US)",
    "locale.pt": "Português (BR)",
    "help.title": "Help",
    "help.intro":
      "PrimeClip turns long-form video into vertical clips for Shorts, Reels, and TikTok using AI.",
    "help.sections.upload.title": "Upload & generate",
    "help.sections.upload.body":
      "On the Upload page, choose a source, pick an LLM provider, and start clip generation.",
    "help.sections.upload.file": "Local file — drag & drop or pick a video from disk.",
    "help.sections.upload.url": "URL — download from YouTube, Vimeo, or a public link (requires yt-dlp in Lite).",
    "help.sections.upload.drive": "Google Drive — import from your Drive account (OAuth in Settings).",
    "help.sections.pipeline.title": "Pipeline",
    "help.sections.pipeline.body":
      "Each job runs locally through these steps. Progress appears in the banner and on the Results page.",
    "help.sections.library.title": "Library",
    "help.sections.library.body":
      "Browse past videos and clips. Open a clip to edit captions or download the rendered MP4.",
    "help.sections.settings.title": "Settings",
    "help.sections.settings.body":
      "Configure language, LLM provider API keys (stored in the OS keychain), icon shape, and check dependency status.",
    "help.sections.requirements.title": "System requirements",
    "help.sections.requirements.intro":
      "PrimeClip ships in Full and Lite variants. Check Settings for your build and dependency status.",
    "help.sections.requirements.full.title": "Full build",
    "help.sections.requirements.full.ffmpeg": "Bundled FFmpeg — no extra install.",
    "help.sections.requirements.full.whisper": "Bundled Whisper base model — no extra download.",
    "help.sections.requirements.full.llm": "Ollama or a cloud API key (Claude, OpenAI, OpenRouter).",
    "help.sections.requirements.lite.title": "Lite build",
    "help.sections.requirements.lite.ffmpeg": "FFmpeg 6+ with libass on your PATH.",
    "help.sections.requirements.lite.whisper": "Whisper model downloaded on first run (via faster-whisper).",
    "help.sections.requirements.lite.llm": "Ollama (local) or a cloud API key — never bundled.",
    "help.sections.requirements.lite.ytdlp": "yt-dlp on PATH for URL imports.",
    "help.sections.requirements.lite.note":
      "You are running the Lite build. Install missing tools and confirm status in Settings → System Status.",
    "help.about.title": "About this build",
    "help.about.branch": "Branch",
    "help.about.commit": "Commit",
    "help.footer": "Need API keys or dependency checks? Open",
  },
  "pt-BR": {
    "nav.upload": "Enviar",
    "nav.library": "Biblioteca",
    "nav.settings": "Configurações",
    "nav.help": "Ajuda",
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
    "results.cancel": "Cancelar geração",
    "results.cancelling": "Cancelando…",
    "results.cancelled": "A geração foi cancelada.",
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
    "banner.apiStarting": "Iniciando a API do PrimeClip… ({sec}s — a primeira abertura pode levar até 1 minuto)",
    "banner.apiFailed": "A API do PrimeClip não iniciou. Feche e abra o app novamente.",
    "banner.view": "Ver progresso",
    "settings.title": "Configurações",
    "settings.language": "Idioma",
    "settings.systemStatus": "Status do sistema",
    "settings.llm": "Provedor LLM",
    "settings.save": "Salvar",
    "settings.test": "Testar conexão",
    "settings.iconShape": "Formato do ícone",
    "settings.iconShapeHint":
      "Altera o ícone no dock/barra de tarefas enquanto o app está aberto. Recompile o app para atualizar o ícone em Aplicativos.",
    "settings.iconShape.square": "Quadrado",
    "settings.iconShape.rounded": "Arredondado",
    "settings.iconShape.circle": "Circular",
    "locale.en": "English (US)",
    "locale.pt": "Português (BR)",
    "help.title": "Ajuda",
    "help.intro":
      "O PrimeClip transforma vídeos longos em clipes verticais para Shorts, Reels e TikTok usando IA.",
    "help.sections.upload.title": "Enviar e gerar",
    "help.sections.upload.body":
      "Na página Enviar, escolha a fonte, o provedor LLM e inicie a geração de clipes.",
    "help.sections.upload.file": "Arquivo local — arraste e solte ou escolha um vídeo do disco.",
    "help.sections.upload.url": "URL — baixe do YouTube, Vimeo ou link público (requer yt-dlp no Lite).",
    "help.sections.upload.drive": "Google Drive — importe da sua conta (OAuth em Configurações).",
    "help.sections.pipeline.title": "Pipeline",
    "help.sections.pipeline.body":
      "Cada job roda localmente nestas etapas. O progresso aparece no banner e na página de Resultados.",
    "help.sections.library.title": "Biblioteca",
    "help.sections.library.body":
      "Veja vídeos e clipes anteriores. Abra um clipe para editar legendas ou baixar o MP4 renderizado.",
    "help.sections.settings.title": "Configurações",
    "help.sections.settings.body":
      "Configure idioma, chaves de API LLM (no keychain do SO), formato do ícone e status das dependências.",
    "help.sections.requirements.title": "Requisitos do sistema",
    "help.sections.requirements.intro":
      "O PrimeClip tem variantes Full e Lite. Veja sua build e o status em Configurações.",
    "help.sections.requirements.full.title": "Build Full",
    "help.sections.requirements.full.ffmpeg": "FFmpeg incluído — sem instalação extra.",
    "help.sections.requirements.full.whisper": "Modelo Whisper base incluído — sem download extra.",
    "help.sections.requirements.full.llm": "Ollama ou chave de API na nuvem (Claude, OpenAI, OpenRouter).",
    "help.sections.requirements.lite.title": "Build Lite",
    "help.sections.requirements.lite.ffmpeg": "FFmpeg 6+ com libass no PATH.",
    "help.sections.requirements.lite.whisper": "Modelo Whisper baixado na primeira execução (faster-whisper).",
    "help.sections.requirements.lite.llm": "Ollama (local) ou chave de API — nunca incluído.",
    "help.sections.requirements.lite.ytdlp": "yt-dlp no PATH para importação por URL.",
    "help.sections.requirements.lite.note":
      "Você está na build Lite. Instale as ferramentas faltantes e confira em Configurações → Status do sistema.",
    "help.about.title": "Sobre esta build",
    "help.about.branch": "Branch",
    "help.about.commit": "Commit",
    "help.footer": "Precisa de chaves de API ou checar dependências? Abra",
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
