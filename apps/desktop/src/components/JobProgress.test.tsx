import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { JobProgress } from "./JobProgress";
import { LocaleProvider } from "../lib/i18n";

function renderWithLocale(ui: ReactElement) {
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

describe("JobProgress", () => {
  it("shows progress percentage and current stage", () => {
    renderWithLocale(<JobProgress progress={42} stage="transcribe" status="running" />);
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Transcribe")).toBeInTheDocument();
  });

  it("expands pipeline steps on click", async () => {
    const user = userEvent.setup();
    renderWithLocale(<JobProgress progress={10} stage="detect_scenes" status="running" />);

    await user.click(screen.getByRole("button", { name: /show steps/i }));
    expect(screen.getByText("Extract audio")).toBeInTheDocument();
    expect(screen.getAllByText("Detect scenes").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("shows render clip detail when stage includes index", () => {
    renderWithLocale(
      <JobProgress progress={90} stage="render_clips:2/5" status="running" />,
    );
    expect(screen.getByText(/\(2\/5\)/)).toBeInTheDocument();
  });
});
