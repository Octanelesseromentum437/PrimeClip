import { useCallback, useEffect, useState } from "react";
import { fetchHealth, testProvider } from "../lib/api";
import {
  deleteApiKey,
  getApiKey,
  getBundleProfile,
  storeApiKey,
} from "../lib/credentials";
import {
  applyIconShape,
  readStoredIconShape,
  type IconShape,
} from "../lib/iconShape";
import { useLocale, type Locale } from "../lib/i18n";
import { loadProviders, resolveModelForProvider } from "../lib/providers";
import type { HealthResponse, ProviderDescriptor, ProviderKind } from "../lib/types";

export function SettingsPage() {
  const { t, locale, setLocale } = useLocale();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [bundleProfile, setBundleProfile] = useState("lite");
  const [selectedKind, setSelectedKind] = useState<ProviderKind>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [iconShape, setIconShape] = useState<IconShape>(() => readStoredIconShape());

  const onIconShapeChange = async (next: IconShape) => {
    setIconShape(next);
    try {
      await applyIconShape(next);
    } catch {
      setIconShape(readStoredIconShape());
    }
  };

  const iconShapeOptions: IconShape[] = ["square", "rounded", "circle"];

  const refreshProviders = useCallback(async () => {
    setProvidersLoading(true);
    const { providers: list, error } = await loadProviders();
    setProviders(list);
    setProvidersError(error);
    setProvidersLoading(false);
    return list;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setHealth(await fetchHealth());
    } catch {
      setHealth(null);
    }

    try {
      setBundleProfile(await getBundleProfile());
    } catch {
      setBundleProfile("lite");
    }

    await refreshProviders();
    const existing = await getApiKey(selectedKind).catch(() => null);
    setApiKey(existing || "");
  }, [refreshProviders, selectedKind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onProviderChange = async (nextKind: ProviderKind) => {
    setSelectedKind(nextKind);
    setTestResult(null);
    const existing = await getApiKey(nextKind).catch(() => null);
    setApiKey(existing || "");
  };

  const saveKey = async () => {
    if (apiKey.trim()) {
      await storeApiKey(selectedKind, apiKey.trim());
    } else {
      await deleteApiKey(selectedKind);
    }
    await refresh();
  };

  const runTest = async () => {
    setTestResult(null);
    const p = providers.find((x) => x.kind === selectedKind);
    const model = resolveModelForProvider(p, p?.default_model || "qwen3");
    try {
      const result = await testProvider({
        kind: selectedKind,
        model,
        api_key: apiKey || null,
        base_url: selectedKind === "ollama" ? ollamaUrl : null,
      });
      setTestResult(result.ok ? `OK (${result.latency_ms?.toFixed(0)}ms)` : result.error || "Failed");
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Test failed");
    }
  };

  const selected = providers.find((p) => p.kind === selectedKind);
  const modelOptions = selected?.models ?? [];

  return (
    <div className="page-shell max-w-2xl space-y-6">
      <header className="page-header">
        <h1 className="page-title">{t("settings.title")}</h1>
        <span className="text-xs uppercase tracking-wide text-app-fg-subtle bg-app-muted px-2 py-1 rounded-md shrink-0">
          {bundleProfile} build
        </span>
      </header>

        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">{t("settings.language")}</h2>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="input"
          >
            <option value="en-US">{t("locale.en")}</option>
            <option value="pt-BR">{t("locale.pt")}</option>
          </select>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-semibold">{t("settings.iconShape")}</h2>
          <p className="text-sm text-app-fg-muted">{t("settings.iconShapeHint")}</p>
          <div className="grid grid-cols-3 gap-3">
            {iconShapeOptions.map((shape) => (
              <button
                key={shape}
                type="button"
                onClick={() => onIconShapeChange(shape)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                  iconShape === shape
                    ? "border-brand-600 bg-brand-600/10 ring-2 ring-brand-500/40"
                    : "border-app-border hover:border-brand-500/60 hover:bg-app-muted"
                }`}
              >
                <img
                  src={`/icons/${shape}.png`}
                  alt=""
                  className={`h-14 w-14 object-contain bg-app-muted ${
                    shape === "square" ? "rounded-none" : shape === "rounded" ? "rounded-2xl" : "rounded-full"
                  }`}
                />
                <span className="text-xs font-medium">{t(`settings.iconShape.${shape}`)}</span>
              </button>
            ))}
          </div>
        </section>

        {health && (
          <section className="card p-4 space-y-2">
            <h2 className="font-semibold">{t("settings.systemStatus")}</h2>
            {Object.entries(health.dependencies).map(([key, dep]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span>{dep.name}</span>
                <span className={dep.ok ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}>
                  {dep.ok ? "OK" : dep.message || "Missing"}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="card p-4 space-y-4">
          <h2 className="font-semibold">{t("settings.llm")}</h2>
          <select
            value={selectedKind}
            disabled={providersLoading || providers.length === 0}
            onChange={(e) => onProviderChange(e.target.value as ProviderKind)}
            className="input disabled:opacity-50"
          >
            {providers.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.display_name}
                {p.kind === "ollama" && p.configured ? " · online" : ""}
                {p.requires_api_key && p.configured ? " · configured" : ""}
              </option>
            ))}
          </select>

          {providersLoading && (
            <p className="text-sm text-app-fg-subtle">Loading providers…</p>
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

          {selectedKind === "ollama" && (
            <>
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="Ollama URL"
                className="input"
              />
              {modelOptions.length > 0 && (
                <p className="text-sm text-muted">
                  Available models: {modelOptions.join(", ")}
                </p>
              )}
            </>
          )}

          {selected?.requires_api_key && (
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key (stored in OS keychain)"
              className="input"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={saveKey}
              className="flex-1 btn-primary text-sm"
            >
              {t("settings.save")}
            </button>
            <button
              onClick={runTest}
              className="flex-1 btn-outline"
            >
              {t("settings.test")}
            </button>
          </div>
          {testResult && <p className="text-sm text-muted">{testResult}</p>}
        </section>
    </div>
  );
}
