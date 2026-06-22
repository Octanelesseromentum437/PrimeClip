import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Nav } from "../components/Nav";
import { getAppInfo, getBundleProfile, type AppInfo } from "../lib/credentials";
import { useLocale } from "../lib/i18n";
import { isTauriApp } from "../lib/tauri";

export function HelpPage() {
  const { t } = useLocale();
  const [bundleProfile, setBundleProfile] = useState("lite");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (isTauriApp()) {
      void getBundleProfile().then(setBundleProfile).catch(() => setBundleProfile("lite"));
      void getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
    }
  }, []);

  const isLite = bundleProfile === "lite";

  return (
    <div className="page-shell">
      <Nav />
      <main className="max-w-3xl mx-auto p-6 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{t("help.title")}</h1>
          <p className="text-app-fg-muted">{t("help.intro")}</p>
        </header>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-lg">{t("help.sections.upload.title")}</h2>
          <p className="text-sm text-app-fg-muted">{t("help.sections.upload.body")}</p>
          <ul className="list-disc pl-5 text-sm space-y-1 text-app-fg-muted">
            <li>{t("help.sections.upload.file")}</li>
            <li>{t("help.sections.upload.url")}</li>
            <li>{t("help.sections.upload.drive")}</li>
          </ul>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-lg">{t("help.sections.pipeline.title")}</h2>
          <p className="text-sm text-app-fg-muted">{t("help.sections.pipeline.body")}</p>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-app-fg-muted">
            <li>{t("stage.extract_audio")}</li>
            <li>{t("stage.transcribe")}</li>
            <li>{t("stage.detect_scenes")}</li>
            <li>{t("stage.select_clips")}</li>
            <li>{t("stage.track_faces")}</li>
            <li>{t("stage.render_clips")}</li>
          </ol>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-lg">{t("help.sections.library.title")}</h2>
          <p className="text-sm text-app-fg-muted">{t("help.sections.library.body")}</p>
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold text-lg">{t("help.sections.settings.title")}</h2>
          <p className="text-sm text-app-fg-muted">{t("help.sections.settings.body")}</p>
        </section>

        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-lg">{t("help.sections.requirements.title")}</h2>
            <span className="text-xs uppercase tracking-wide text-app-fg-subtle bg-app-muted px-2 py-1 rounded shrink-0">
              {bundleProfile} build
            </span>
          </div>
          <p className="text-sm text-app-fg-muted">{t("help.sections.requirements.intro")}</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-app-border p-4 space-y-2">
              <h3 className="font-medium">{t("help.sections.requirements.full.title")}</h3>
              <ul className="list-disc pl-5 text-sm space-y-1 text-app-fg-muted">
                <li>{t("help.sections.requirements.full.ffmpeg")}</li>
                <li>{t("help.sections.requirements.full.whisper")}</li>
                <li>{t("help.sections.requirements.full.llm")}</li>
              </ul>
            </div>
            <div
              className={`rounded-xl border p-4 space-y-2 ${
                isLite ? "border-brand-600/50 bg-brand-600/5" : "border-app-border"
              }`}
            >
              <h3 className="font-medium">{t("help.sections.requirements.lite.title")}</h3>
              <ul className="list-disc pl-5 text-sm space-y-1 text-app-fg-muted">
                <li>{t("help.sections.requirements.lite.ffmpeg")}</li>
                <li>{t("help.sections.requirements.lite.whisper")}</li>
                <li>{t("help.sections.requirements.lite.llm")}</li>
                <li>{t("help.sections.requirements.lite.ytdlp")}</li>
              </ul>
            </div>
          </div>

          {isLite && (
            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              {t("help.sections.requirements.lite.note")}
            </p>
          )}
        </section>

        {appInfo && (
          <section className="card p-5 space-y-2 text-sm text-app-fg-muted">
            <h2 className="font-semibold text-base text-app-fg">{t("help.about.title")}</h2>
            <p>
              {appInfo.name} {appInfo.version}
            </p>
            <p>
              {t("help.about.branch")}: {appInfo.git_branch} · {t("help.about.commit")}: {appInfo.git_commit}
            </p>
            <a
              href={appInfo.repo_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-brand-600 dark:text-brand-400 hover:underline"
            >
              {appInfo.repo_url}
            </a>
          </section>
        )}

        <p className="text-sm text-app-fg-subtle">
          {t("help.footer")}{" "}
          <Link to="/settings" className="text-brand-600 dark:text-brand-400 hover:underline">
            {t("nav.settings")}
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
