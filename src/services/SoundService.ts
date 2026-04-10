// TODO: Replace with Capacitor native audio when wrapping as native app

const getCtx = () =>
  new ((window as any).AudioContext || (window as any).webkitAudioContext)();

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  vol: number = 0.25
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

// TICK — ascending single phrase (short rise A→B)
function playTick(ctx: AudioContext, offset: number = 0) {
  tone(ctx, 1047, offset, 0.12, 0.2);
  tone(ctx, 1319, offset + 0.15, 0.18, 0.25);
}

// NORMAL — descending phrase (B→A→low)
function playNormal(ctx: AudioContext, offset: number = 0) {
  tone(ctx, 1319, offset, 0.15, 0.25);
  tone(ctx, 1047, offset + 0.18, 0.15, 0.22);
  tone(ctx, 784, offset + 0.36, 0.22, 0.18);
}

// VIKTIG — ascending phrase (low→A→B→high)
function playViktig(ctx: AudioContext, offset: number = 0) {
  tone(ctx, 784, offset, 0.12, 0.2);
  tone(ctx, 1047, offset + 0.15, 0.12, 0.22);
  tone(ctx, 1319, offset + 0.3, 0.12, 0.25);
  tone(ctx, 1568, offset + 0.45, 0.2, 0.3);
}

let pendingSound: string | null = null;

function doPlay(soundId: string): void {
  const ctx = getCtx();
  const gap = 0.55;
  switch (soundId) {
    case "incoming":
    case "chime":
      // NORMAL × 3
      playNormal(ctx, 0);
      playNormal(ctx, gap);
      playNormal(ctx, gap * 2);
      break;
    case "activation":
    case "beep":
    case "incoming_soft":
      // TICK × 1
      playTick(ctx, 0);
      break;
    case "incoming_urgent":
    case "alarm":
      // VIKTIG × 3
      playViktig(ctx, 0);
      playViktig(ctx, gap);
      playViktig(ctx, gap * 2);
      break;
    case "escalation": {
      // ESKALERING: Normal×3 → Viktig×3 → Høy×3
      const g = gap;
      playNormal(ctx, 0);
      playNormal(ctx, g);
      playNormal(ctx, g * 2);
      playViktig(ctx, g * 3 + 0.3);
      playViktig(ctx, g * 4 + 0.3);
      playViktig(ctx, g * 5 + 0.3);
      // Høy = Viktig pitched up
      tone(ctx, 1568, g * 6 + 0.6, 0.12, 0.35);
      tone(ctx, 1976, g * 6 + 0.6 + 0.15, 0.12, 0.35);
      tone(ctx, 2349, g * 6 + 0.6 + 0.3, 0.12, 0.38);
      tone(ctx, 2794, g * 6 + 0.6 + 0.45, 0.22, 0.4);
      tone(ctx, 1568, g * 7 + 0.6, 0.12, 0.35);
      tone(ctx, 1976, g * 7 + 0.6 + 0.15, 0.12, 0.35);
      tone(ctx, 2349, g * 7 + 0.6 + 0.3, 0.12, 0.38);
      tone(ctx, 2794, g * 7 + 0.6 + 0.45, 0.22, 0.4);
      tone(ctx, 1568, g * 8 + 0.6, 0.12, 0.35);
      tone(ctx, 1976, g * 8 + 0.6 + 0.15, 0.12, 0.35);
      tone(ctx, 2349, g * 8 + 0.6 + 0.3, 0.12, 0.38);
      tone(ctx, 2794, g * 8 + 0.6 + 0.45, 0.3, 0.45);
      break;
    }
    default:
      playNormal(ctx, 0);
  }
}

export function playAlert(soundId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      pendingSound = soundId;
      document.addEventListener("click", function handler() {
        ctx.resume().then(() => {
          if (pendingSound) doPlay(pendingSound);
          pendingSound = null;
        });
        document.removeEventListener("click", handler);
      });
      return;
    }
    doPlay(soundId);
  } catch (e) {
    console.warn("SoundService: audio playback failed", e);
  }
}

export const AVAILABLE_SOUNDS = [
  { id: "incoming",        label: "Normal (Fallende × 3)" },
  { id: "activation",      label: "Tick (Stigende × 1)" },
  { id: "incoming_urgent", label: "Viktig (Stigende × 3)" },
  { id: "escalation",      label: "Eskalering (full sekvens)" },
  { id: "chime",           label: "Klokke" },
  { id: "beep",            label: "Pip" },
  { id: "alarm",           label: "Alarm" },
  { id: "incoming_soft",   label: "Myk varsling" },
] as const;
