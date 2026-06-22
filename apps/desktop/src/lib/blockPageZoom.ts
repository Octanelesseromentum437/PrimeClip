function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

/** Block native browser/webview zoom so editor timeline shortcuts only affect the timeline. */
export function installPageZoomBlock(): () => void {
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "-" || e.key === "=" || e.key === "+" || e.key === "0") {
      e.preventDefault();
    }
  };

  document.addEventListener("wheel", onWheel, { passive: false, capture: true });
  document.addEventListener("keydown", onKeyDown, { capture: true });

  return () => {
    document.removeEventListener("wheel", onWheel, { capture: true });
    document.removeEventListener("keydown", onKeyDown, { capture: true });
  };
}
