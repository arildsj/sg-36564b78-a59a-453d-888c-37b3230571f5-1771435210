// TODO: Replace with Capacitor native audio when wrapping as native app
// This is the ONLY file in the codebase that handles alert sounds.
// All audio playback must go through this module.

type AlertSoundType = "incoming" | "activation" | "escalation";

// Paths relative to /public — add corresponding .mp3 files before shipping
const SOUND_URLS: Record<AlertSoundType, string> = {
  incoming:   "/sounds/incoming.mp3",
  activation: "/sounds/activation.mp3",
  escalation: "/sounds/escalation.mp3",
};

/**
 * Play an alert sound by type.
 * Silently ignores errors if the audio file is missing or autoplay is blocked.
 */
export function playAlert(soundType: AlertSoundType): void {
  if (typeof window === "undefined") return;

  const url = SOUND_URLS[soundType];
  const audio = new Audio(url);

  audio.play().catch((err: Error) => {
    console.warn(`[SoundService] Could not play sound "${soundType}":`, err.message);
  });
}
