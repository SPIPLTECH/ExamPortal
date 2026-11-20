/**
 * Exam lock: fullscreen + Keyboard Lock (what a web page can do; it is not a
 * lockdown browser). Ported from the ProctorGuard frontend.
 *
 * - Fullscreen must start from a user gesture (a click).
 * - Keyboard Lock (Chrome/Edge, fullscreen only) delivers system shortcuts
 *   (Esc, Alt+Tab, Win key, Win+Shift+S) to the page so it can block/record
 *   them. Users can still leave fullscreen by HOLDING Esc (~2s) or the browser
 *   exit button — no web page can disable that — so exits are detected and
 *   recorded as violations.
 */
interface KeyboardLockApi {
  lock?: (keys?: string[]) => Promise<void>;
  unlock?: () => void;
}

function keyboardApi(): KeyboardLockApi | undefined {
  return (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard;
}

export function isFullscreenSupported(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen)
  );
}

export function isKeyboardLockSupported(): boolean {
  return typeof keyboardApi()?.lock === "function";
}

export interface ExamLockState {
  fullscreen: boolean;
  keyboardLocked: boolean;
}

/** Call from a click handler. Never throws. */
export async function enterExamLock(): Promise<ExamLockState> {
  let fullscreen = Boolean(document.fullscreenElement);
  if (!fullscreen && isFullscreenSupported()) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      fullscreen = true;
    } catch {
      fullscreen = false;
    }
  }
  let keyboardLocked = false;
  const kb = keyboardApi();
  if (fullscreen && kb?.lock) {
    try {
      await kb.lock();
      keyboardLocked = true;
    } catch {
      keyboardLocked = false;
    }
  }
  return { fullscreen, keyboardLocked };
}

/** Releases the keyboard and leaves fullscreen (exam finished). Never throws. */
export function releaseExamLock(): void {
  try {
    keyboardApi()?.unlock?.();
  } catch {
    /* ignore */
  }
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}
