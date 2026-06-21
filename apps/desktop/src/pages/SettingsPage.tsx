import { useEffect, useState } from "react";
import { Nav } from "../components/Nav";
import { fetchHealth, fetchProviders, testProvider } from "../lib/api";
import {
  deleteApiKey,
  getApiKey,
  getBundleProfile,
  listConfiguredProviders,
  storeApiKey,
} from "../lib/credentials";
import type { HealthResponse, ProviderDescriptor, ProviderKind } from "../lib/types";

export function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [bundleProfile, setBundleProfile] = useState("lite");
  const [selectedKind, setSelectedKind] = useState<ProviderKind>("claude");
  const [apiKey, setApiKey] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");

  const refresh = async () => {
    setHealth(await fetchHealth());
    setBundleProfile(await getBundleProfile());
    const configured = await listConfiguredProviders();
    setProviders(await fetchProviders(configured));
    const existing = await getApiKey(selectedKind);
    setApiKey(existing || "");
  };

  useEffect(() => {
    refresh();
  }, [selectedKind]);

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
    try {
      const result = await testProvider({
        kind: selectedKind,
        model: p?.default_model || "qwen3",
        api_key: apiKey || null,
        base_url: selectedKind === "ollama" ? ollamaUrl : null,
      });
      setTestResult(result.ok ? `OK (${result.latency_ms?.toFixed(0)}ms)` : result.error || "Failed");
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Test failed");
    }
  };

  const selected = providers.find((p) => p.kind === selectedKind);

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
            onChange={(e) => setSelectedKind(e.target.value as ProviderKind)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"
          >
            {providers.map((p) => (
              <option key={p.kind} value={p.kind}>
                {p.display_name}
              </option>
            ))}
          </select>

          {selectedKind === "ollama" && (
            <input
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="Ollama URL"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"
            />
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
