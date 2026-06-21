import { useCallback, useEffect, useState } from "react";
import { Nav } from "../components/Nav";
import { fetchHealth, testProvider } from "../lib/api";
import {
  deleteApiKey,
  getApiKey,
  getBundleProfile,
  storeApiKey,
} from "../lib/credentials";
import { loadProviders, resolveModelForProvider } from "../lib/providers";
import type { HealthResponse, ProviderDescriptor, ProviderKind } from "../lib/types";

export function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [bundleProfile, setBundleProfile] = useState("lite");
  const [selectedKind, setSelectedKind] = useState<ProviderKind>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

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
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Settings</h1>
          <span className="text-xs uppercase tracking-wide text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {bundleProfile} build
          </span>
        </div>

        {health && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
            <h2 className="font-semibold">System Status</h2>
            {Object.entries(health.dependencies).map(([key, dep]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span>{dep.name}</span>
                <span className={dep.ok ? "text-green-400" : "text-amber-400"}>
                  {dep.ok ? "OK" : dep.message || "Missing"}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
          <h2 className="font-semibold">LLM Provider</h2>
          <select
            value={selectedKind}
            disabled={providersLoading || providers.length === 0}
            onChange={(e) => onProviderChange(e.target.value as ProviderKind)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 disabled:opacity-50"
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
            <p className="text-sm text-slate-500">Loading providers…</p>
          )}

          {providersError && (
            <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200 space-y-2">
              <p>{providersError}</p>
              <button
                type="button"
                onClick={refreshProviders}
                className="text-amber-100 underline underline-offset-2"
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
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"
              />
              {modelOptions.length > 0 && (
                <p className="text-sm text-slate-400">
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
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={saveKey}
              className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm font-medium"
            >
              Save
            </button>
            <button
              onClick={runTest}
              className="flex-1 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm"
            >
              Test Connection
            </button>
          </div>
          {testResult && <p className="text-sm text-slate-400">{testResult}</p>}
        </section>
      </main>
    </div>
  );
}
