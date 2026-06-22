import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { Nav } from "../components/Nav";
import {
  exchangeDriveCode,
  fetchDriveAuthUrl,
  fetchDriveFiles,
  fetchImportStatus,
  fetchVideo,
  generateClips,
  importFromUrl,
  uploadFromDrive,
  uploadVideo,
  uploadVideoPath,
} from "../lib/api";
import {
  deleteGoogleTokens,
  getApiKey,
  getGoogleAccessToken,
  storeGoogleTokens,
} from "../lib/credentials";
import { useLocale } from "../lib/i18n";
import { loadProviders, resolveModelForProvider } from "../lib/providers";
import { isTauriApp, openFileFolder, pickVideoFile } from "../lib/tauri";
import {
  loadUploadSession,
  patchUploadSession,
  type SourceTab,
} from "../lib/uploadSession";
import type { ProviderDescriptor, ProviderKind, UploadResponse } from "../lib/types";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export function UploadPage() {
  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const session = loadUploadSession();

  const [sourceTab, setSourceTab] = useState<SourceTab>(session.sourceTab);
  const [file, setFile] = useState<File | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState(session.importUrl);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [readyVideo, setReadyVideo] = useState<UploadResponse | null>(session.readyVideo);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<
    { id: string; name: string; mime_type: string; size: number | null }[]
  >([]);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string>("");
  const [authCode, setAuthCode] = useState("");
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [kind, setKind] = useState<ProviderKind>("ollama");
  const [model, setModel] = useState("");
  const [numClips, setNumClips] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshProviders = useCallback(async () => {
    setProvidersLoading(true);
    const { providers: list, error: loadError } = await loadProviders();
    setProviders(list);
    setProvidersError(loadError);
    setProvidersLoading(false);

    if (list.length === 0) return;

    setKind((currentKind) => {
      const active =
        list.find((p) => p.kind === currentKind) ||
        list.find((p) => p.kind === "ollama") ||
        list[0];
      return active.kind;
    });
  }, []);

  useEffect(() => {
    refreshProviders();
  }, [refreshProviders]);

  const selected = providers.find((p) => p.kind === kind);
  const modelOptions = selected?.models ?? [];
  const modelValue = resolveModelForProvider(selected, model);

  useEffect(() => {
    if (!selected) return;
    setModel((current) => resolveModelForProvider(selected, current));
  }, [selected, modelOptions.join(",")]);

  const onProviderChange = (nextKind: ProviderKind) => {
    const provider = providers.find((p) => p.kind === nextKind);
    if (!provider) return;
    setKind(nextKind);
    setModel(resolveModelForProvider(provider, model));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setLocalPath(null);
    }
  }, []);

  const onBrowse = useCallback(async () => {
    if (isTauriApp()) {
      try {
        const path = await pickVideoFile();
        if (path) {
          setLocalPath(path);
          setFile(null);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open file picker");
      }
      return;
    }
    document.getElementById("video-file-input")?.click();
  }, []);

  useEffect(() => {
    refreshProviders();
    getGoogleAccessToken().then(setDriveToken);
  }, [refreshProviders]);

  // Resume URL import if one was in progress
  useEffect(() => {
    const pendingImportId = loadUploadSession().importId;
    if (!pendingImportId) return;

    setUploading(true);
    setImportProgress(0);

    const poll = async () => {
      try {
        const status = await fetchImportStatus(pendingImportId);
        setImportProgress(status.progress_pct);
        if (status.status === "completed" && status.video_id) {
          const video: UploadResponse = {
            video_id: status.video_id,
            filename: status.filename ?? "imported video",
            duration_sec: 0,
          };
          setReadyVideo(video);
          patchUploadSession({ importId: null, readyVideo: video });
          setUploading(false);
          setImportProgress(null);
          void sendNotification({ title: "PrimeClip", body: t("notify.importComplete") });
          if (importPollRef.current) clearInterval(importPollRef.current);
        } else if (status.status === "failed") {
          setError(status.error_message ?? "Import failed");
          patchUploadSession({ importId: null });
          setUploading(false);
          setImportProgress(null);
          if (importPollRef.current) clearInterval(importPollRef.current);
        }
      } catch {
        // keep polling
      }
    };

    poll();
    importPollRef.current = setInterval(poll, 1000);
    return () => {
      if (importPollRef.current) clearInterval(importPollRef.current);
    };
  }, [t]);

  const startDriveAuth = async () => {
    try {
      const url = await fetchDriveAuthUrl();
      window.open(url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Drive auth unavailable");
    }
  };

  const completeDriveAuth = async () => {
    if (!authCode.trim()) return;
    try {
      const tokens = await exchangeDriveCode(authCode.trim());
      await storeGoogleTokens(tokens.access_token, tokens.refresh_token);
      setDriveToken(tokens.access_token);
      setAuthCode("");
      await refreshDriveFiles(tokens.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google auth failed");
    }
  };

  const refreshDriveFiles = async (token?: string) => {
    const accessToken = token ?? driveToken;
    if (!accessToken) return;
    try {
      const files = await fetchDriveFiles(accessToken);
      setDriveFiles(files);
      if (files.length) setSelectedDriveFileId(files[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list Drive files");
    }
  };

  const handleOpenFolder = async (videoId: string) => {
    try {
      const detail = await fetchVideo(videoId);
      await openFileFolder(detail.source_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open folder");
    }
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;
    setUploading(true);
    setError(null);
    setImportProgress(0);
    patchUploadSession({ importUrl: importUrl.trim(), sourceTab: "url" });
    try {
      const { import_id } = await importFromUrl(importUrl.trim());
      patchUploadSession({ importId: import_id });
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        const status = await fetchImportStatus(import_id);
        setImportProgress(status.progress_pct);
        if (status.status === "completed" && status.video_id) {
          const video: UploadResponse = {
            video_id: status.video_id,
            filename: status.filename ?? "imported video",
            duration_sec: 0,
          };
          setReadyVideo(video);
          patchUploadSession({ importId: null, readyVideo: video });
          void sendNotification({ title: "PrimeClip", body: t("notify.importComplete") });
          break;
        }
        if (status.status === "failed") {
          patchUploadSession({ importId: null });
          throw new Error(status.error_message ?? "Import failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setUploading(false);
      setImportProgress(null);
    }
  };

  const resolveUpload = async (): Promise<UploadResponse> => {
    if (readyVideo && sourceTab !== "file") return readyVideo;
    if (sourceTab === "drive") {
      if (!driveToken || !selectedDriveFileId) throw new Error("Select a Google Drive file");
      const selectedFile = driveFiles.find((f) => f.id === selectedDriveFileId);
      return uploadFromDrive(selectedDriveFileId, selectedFile?.name ?? "source.mp4", driveToken);
    }
    if (localPath) return uploadVideoPath(localPath);
    if (file) return uploadVideo(file);
    throw new Error("No video selected");
  };

  const canGenerate =
    sourceTab === "file"
      ? Boolean(file || localPath)
      : sourceTab === "url"
        ? Boolean(readyVideo)
        : Boolean(driveToken && selectedDriveFileId);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setUploading(true);
    setError(null);
    try {
      const upload = await resolveUpload();
      const apiKey = selected?.requires_api_key ? await getApiKey(kind) : null;
      const whisperLang = locale === "pt-BR" ? "pt" : "en";
      const { job_id } = await generateClips(
        upload.video_id,
        {
          kind,
          model: modelValue,
          api_key: apiKey,
          base_url: kind === "ollama" ? DEFAULT_OLLAMA_URL : null,
        },
        numClips,
        whisperLang,
      );
      patchUploadSession({
        activeGeneration: { videoId: upload.video_id, jobId: job_id },
        readyVideo: null,
      });
      navigate(`/results/${upload.video_id}?job=${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleTabChange = (tab: SourceTab) => {
    setSourceTab(tab);
    patchUploadSession({ sourceTab: tab });
  };

  return (
    <div className="page-shell">
      <Nav />
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{t("upload.title")}</h1>

        <div className="flex gap-2 text-sm">
          {(["file", "url", "drive"] as SourceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                sourceTab === tab
                  ? "bg-brand-600 text-white"
                  : "bg-app-muted hover:bg-app-muted-hover"
              }`}
            >
              {tab === "file"
                ? t("upload.tab.file")
                : tab === "url"
                  ? t("upload.tab.url")
                  : t("upload.tab.drive")}
            </button>
          ))}
        </div>

        {sourceTab === "file" && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-app-border rounded-xl p-12 text-center hover:border-brand-500 transition-colors"
          >
            {(localPath?.split(/[/\\]/).pop() ?? file?.name) ? (
              <p>{localPath?.split(/[/\\]/).pop() ?? file?.name}</p>
            ) : (
              <p className="text-muted">{t("upload.drop")}</p>
            )}
            {isTauriApp() ? (
              <button
                type="button"
                onClick={onBrowse}
                className="mt-4 text-sm link-brand underline underline-offset-2"
              >
                {t("upload.choose")}
              </button>
            ) : (
              <input
                id="video-file-input"
                type="file"
                accept="video/*"
                className="mt-4 text-sm"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null;
                  setFile(next);
                  setLocalPath(null);
                }}
              />
            )}
          </div>
        )}

        {sourceTab === "url" && (
          <div className="card p-6 space-y-4">
            <p className="text-sm text-muted">{t("upload.url.hint")}</p>
            <input
              value={importUrl}
              onChange={(e) => {
                setImportUrl(e.target.value);
                patchUploadSession({ importUrl: e.target.value });
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="input p-3"
            />
            <button
              type="button"
              onClick={handleUrlImport}
              disabled={uploading || !importUrl.trim()}
              className="w-full btn-secondary"
            >
              {uploading
                ? `${t("upload.url.downloading")} ${importProgress ?? 0}%`
                : t("upload.url.download")}
            </button>
            {readyVideo && (
              <p className="text-success">
                {t("upload.url.ready")}:{" "}
                {isTauriApp() ? (
                  <button
                    type="button"
                    onClick={() => handleOpenFolder(readyVideo.video_id)}
                    className="underline underline-offset-2 hover:opacity-80"
                    title={t("upload.url.openFolder")}
                  >
                    {readyVideo.filename}
                  </button>
                ) : (
                  readyVideo.filename
                )}
              </p>
            )}
          </div>
        )}

        {sourceTab === "drive" && (
          <div className="card p-6 space-y-4">
            {!driveToken ? (
              <>
                <button
                  type="button"
                  onClick={startDriveAuth}
                  className="w-full btn-secondary"
                >
                  Connect Google Drive
                </button>
                <input
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste authorization code"
                  className="input p-3"
                />
                <button
                  type="button"
                  onClick={completeDriveAuth}
                  className="w-full btn-primary"
                >
                  Complete sign-in
                </button>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => refreshDriveFiles()}
                    className="btn-ghost"
                  >
                    Refresh files
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteGoogleTokens();
                      setDriveToken(null);
                      setDriveFiles([]);
                    }}
                    className="btn-ghost text-red-600 dark:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
                <select
                  value={selectedDriveFileId}
                  onChange={(e) => setSelectedDriveFileId(e.target.value)}
                  className="input"
                >
                  {driveFiles.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="label-muted">{t("upload.llm")}</span>
            <select
              value={kind}
              disabled={providersLoading || providers.length === 0}
              onChange={(e) => onProviderChange(e.target.value as ProviderKind)}
              className="input mt-1 disabled:opacity-50"
            >
              {providers.map((p) => (
                <option key={p.kind} value={p.kind}>
                  {p.display_name}
                  {p.kind === "ollama" && p.configured ? " · online" : ""}
                  {p.requires_api_key && p.configured ? " · configured" : ""}
                </option>
              ))}
            </select>
          </label>

          {providersLoading && (
            <p className="text-sm text-app-fg-subtle">{t("upload.loadingProviders")}</p>
          )}

          {providersError && (
            <div className="alert-warning">
              <p>{providersError}</p>
              <button
                type="button"
                onClick={refreshProviders}
                className="underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          {selected?.requires_api_key && !selected.configured && (
            <p className="text-sm text-amber-600 dark:text-amber-300">
              {t("upload.apiKeyHint")}
            </p>
          )}

          {modelOptions.length ? (
            <label className="block">
              <span className="label-muted">{t("upload.model")}</span>
              <select
                value={modelValue}
                onChange={(e) => setModel(e.target.value)}
                className="input mt-1"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="label-muted">{t("upload.model")}</span>
              <input
                value={modelValue}
                onChange={(e) => setModel(e.target.value)}
                placeholder={selected?.default_model || "model name"}
                className="input mt-1"
              />
            </label>
          )}

          <label className="block">
            <span className="label-muted">
              {t("upload.clips")}: {numClips}
            </span>
            <input
              type="range"
              min={1}
              max={20}
              value={numClips}
              onChange={(e) => setNumClips(Number(e.target.value))}
              className="w-full mt-2 accent-brand-600"
            />
          </label>
        </div>

        {error && <p className="text-error">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || uploading || providersLoading}
          className="w-full py-3 rounded-xl btn-primary"
        >
          {uploading ? t("upload.processing") : t("upload.generate")}
        </button>
      </main>
    </div>
  );
}
