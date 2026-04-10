// TODO: Replace with Capacitor native audio when wrapping as native app
// This is the ONLY file in the codebase that handles alert sounds.
// All audio playback must go through this module.

type AlertSoundType = "incoming" | "activation" | "escalation";

const SOUND_URLS: Record<AlertSoundType, string> = {
  incoming:   "/sounds/incoming.mp3",
  activation: "/sounds/activation.mp3",
  escalation: "/sounds/escalation.mp3",
};

// Queued sound to play on next user interaction (when autoplay is blocked)
let deferredSound: AlertSoundType | null = null;

/** Play a short synthetic beep using the Web Audio API (no file needed). */
function playBeepFallback(): void {
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
    console.log("[SoundService] Web Audio beep played as fallback");
  } catch (e) {
    console.warn("[SoundService] Web Audio API fallback failed:", e);
  }
}

/** Try to play a sound file; fall back to beep; queue for next interaction if still blocked. */
function tryPlay(soundType: AlertSoundType): void {
  const url = SOUND_URLS[soundType];
  const audio = new Audio(url);

  audio.play()
    .then(() => {
      console.log(`[SoundService] Playing mp3: ${soundType}`);
    })
    .catch((err: Error) => {
      console.warn(
        `[SoundService] Autoplay blocked for "${soundType}": ${err.message} — trying Web Audio beep`
      );
      playBeepFallback();
      // Also queue for next user interaction in case beep also failed
      deferredSound = soundType;
    });
}

// Register persistent interaction listeners that flush the deferred sound.
// Uses passive + capture:false so it doesn't interfere with UI events.
if (typeof window !== "undefined") {
  const flushDeferred = () => {
    if (!deferredSound) return;
    const s = deferredSound;
    deferredSound = null;
    console.log(`[SoundService] Playing deferred sound on user interaction: ${s}`);
    const audio = new Audio(SOUND_URLS[s]);
    audio.play().catch(() => playBeepFallback());
  };
  (["click", "keydown", "touchstart"] as const).forEach((evt) => {
    window.addEventListener(evt, flushDeferred, { passive: true });
  });
}

/**
 * Play an alert sound by type.
 * Falls back to a Web Audio beep if the mp3 is blocked by autoplay policy.
 * If everything is blocked, plays on the next user interaction.
 */
export function playAlert(soundType: AlertSoundType): void {
  if (typeof window === "undefined") return;
  console.log(`[SoundService] playAlert("${soundType}") called`);
  tryPlay(soundType);
}
