/** Soft UI SFX — best-effort; never blocks the action if audio fails.
 *
 * iOS / installed PWAs only allow audio after a user gesture. We unlock on the
 * first tap anywhere in the app so later overlay plays (after awaits) still work.
 */

export type AppSound = "success" | "paid" | "whoosh";

const SOUND_SRC: Record<AppSound, string> = {
  success: "/sounds/success-bell.mp3",
  paid: "/sounds/paid-swish.mp3",
  whoosh: "/sounds/whoosh.mp3",
};

const cache = new Map<AppSound, HTMLAudioElement>();
let unlocked = false;
let unlockBound = false;

function getAudio(name: AppSound): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(SOUND_SRC[name]);
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    cache.set(name, audio);
  }
  return audio;
}

/** Prime all clips inside a real user gesture so later play() calls succeed. */
export function unlockAudio(): void {
  if (unlocked || typeof Audio === "undefined") return;
  unlocked = true;
  for (const name of Object.keys(SOUND_SRC) as AppSound[]) {
    const audio = getAudio(name);
    if (!audio) continue;
    const wasMuted = audio.muted;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      })
      .catch(() => {
        unlocked = false;
        audio.muted = wasMuted;
      });
  }
}

/** Attach once — first tap/key in the app unlocks Web Audio for the session. */
export function bindAudioUnlock(): () => void {
  if (typeof document === "undefined" || unlockBound) return () => undefined;
  unlockBound = true;
  const onGesture = () => {
    unlockAudio();
    document.removeEventListener("pointerdown", onGesture, true);
    document.removeEventListener("touchstart", onGesture, true);
    document.removeEventListener("keydown", onGesture, true);
  };
  document.addEventListener("pointerdown", onGesture, true);
  document.addEventListener("touchstart", onGesture, true);
  document.addEventListener("keydown", onGesture, true);
  return () => {
    document.removeEventListener("pointerdown", onGesture, true);
    document.removeEventListener("touchstart", onGesture, true);
    document.removeEventListener("keydown", onGesture, true);
    unlockBound = false;
  };
}

/** Play a short UI sound. Safe to call from clicks / overlays. */
export function playSound(name: AppSound): void {
  try {
    if (!unlocked) unlockAudio();
    const audio = getAudio(name);
    if (!audio) return;
    audio.muted = false;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autoplay / user-gesture restrictions — ignore */
    });
  } catch {
    /* ignore */
  }
}
