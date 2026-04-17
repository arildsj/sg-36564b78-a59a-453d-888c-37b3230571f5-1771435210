// TODO: Replace with Capacitor native audio when wrapping as native app

// ─── Singleton AudioContext ───────────────────────────────────────────────────
// A single context is reused across all calls.  Reusing avoids the iOS Safari
// problem where every freshly constructed AudioContext starts "suspended" and
// requires a new user-gesture to resume.  Calling ctx.resume() inside the
// button-click handler (which triggers playAlert) is enough to unlock audio on
// iOS without any click-listener gymnastics.
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) {
    _ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  }
  return _ctx;
}

// ─── Turdus philomelos note primitive ────────────────────────────────────────
//
// Approximates the flute-like timbre of the song thrush using:
//   • Sine-wave primary oscillator (fundamental)
//   • Subtle FM modulator at freq×1.5 — adds a breathy, slightly non-pure
//     quality without needing extra audio files
//   • Vibrato LFO at 5.5 Hz, ±30 Hz depth that fades in after the attack —
//     matches the organic feel of a real thrush phrase
//
// `startFreq` / `endFreq`: when endFreq differs from startFreq the pitch
// glides linearly over 80 % of the note duration, mimicking a slurred interval.
//
function fluteNote(
  ctx: AudioContext,
  startFreq: number,
  endFreq: number,   // pass same value as startFreq for no glide
  start: number,     // seconds relative to ctx.currentTime
  dur: number,       // note duration in seconds
  vol: number = 0.28
): void {
  const t = ctx.currentTime + start;
  const stop = t + dur + 0.05; // a little past envelope end

  // — Primary oscillator —
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startFreq, t);
  if (endFreq !== startFreq) {
    osc.frequency.linearRampToValueAtTime(endFreq, t + dur * 0.8);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);

  // — FM for breathiness (modulator at freq × 1.5, depth 22 Hz) —
  const fm = ctx.createOscillator();
  const fmGain = ctx.createGain();
  fm.type = "sine";
  fm.frequency.value = startFreq * 1.5;
  fmGain.gain.value = 22;
  fm.connect(fmGain);
  fmGain.connect(osc.frequency);

  // — Vibrato LFO (5.5 Hz, ±30 Hz) — fades in after attack —
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 5.5;
  lfoGain.gain.setValueAtTime(0, t);
  lfoGain.gain.linearRampToValueAtTime(30, t + 0.05); // 50 ms fade-in
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  // — Amplitude envelope: soft 18 ms attack, natural exponential decay —
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.018);
  gain.gain.setValueAtTime(vol, t + dur * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  fm.start(t);  fm.stop(stop);
  lfo.start(t); lfo.stop(stop);
  osc.start(t); osc.stop(stop);
}

// ─── Turdus philomelos phrase definitions ────────────────────────────────────
//
// Each phrase models a single song-thrush figure.  The thrush repeats a phrase
// 2–4 times before switching, so callers control repetition count; each
// function only schedules one phrase starting at `offset` seconds.
//
// Frequencies chosen within the 2–8 kHz range typical of Turdus philomelos:
//   2637 Hz = E7   3136 Hz = G7   3520 Hz = A7
//   4186 Hz = C8   4699 Hz = D8   4978 Hz = D#8   5274 Hz = E8
//   5588 Hz = F8   5919 Hz = F#8  6272 Hz = G8    7040 Hz = A8
//

/**
 * Phrase: INCOMING — calm, 1.3–1.8 kHz.
 * "tu-weee-wee": soft staccato, rising glide, settle.
 * Duration ≈ 600 ms
 */
function phraseIncoming(ctx: AudioContext, offset: number): void {
  fluteNote(ctx, 1319, 1319, offset,         0.119, 0.20); // E6  — short soft call
  fluteNote(ctx, 1568, 1760, offset + 0.168, 0.231, 0.27); // G6→A6 rising glide
  fluteNote(ctx, 1397, 1397, offset + 0.448, 0.154, 0.20); // F6  — settle
}
const INCOMING_DUR = 0.602;
const INCOMING_GAP = 0.588; // gap between phrase repetitions

/**
 * Phrase: ACTIVATION — brighter, 2–3 kHz, slightly faster.
 * Three-note ascending flourish.
 * Duration ≈ 476 ms
 */
function phraseActivation(ctx: AudioContext, offset: number): void {
  fluteNote(ctx, 2093, 2093, offset,         0.105, 0.24); // C7
  fluteNote(ctx, 2350, 2350, offset + 0.154, 0.105, 0.26); // D7
  fluteNote(ctx, 2637, 2489, offset + 0.308, 0.168, 0.28); // E7→D#7 slight fall
}
const ACTIVATION_DUR = 0.476;
const ACTIVATION_GAP = 0.504;

/**
 * Phrase: ESCALATION — highest register, 2.8–3.5 kHz, urgent staccato.
 * Four rapid notes: rise to peak then drop.
 * Duration ≈ 511 ms
 */
function phraseEscalation(ctx: AudioContext, offset: number): void {
  fluteNote(ctx, 2794, 2794, offset,         0.098, 0.28); // F7
  fluteNote(ctx, 3136, 3136, offset + 0.140, 0.091, 0.30); // G7
  fluteNote(ctx, 3520, 3520, offset + 0.266, 0.091, 0.33); // A7 (peak)
  fluteNote(ctx, 2960, 2960, offset + 0.392, 0.119, 0.26); // F#7 — drop
}
const ESCALATION_DUR = 0.511;
const ESCALATION_GAP = 0.392;

// ─── Sound-ID → phrase + repetition mapping ──────────────────────────────────

function doPlay(soundId: string): void {
  const ctx = getCtx();

  switch (soundId) {

    // ── incoming: 2 repetitions (calm) ──────────────────────────────────────
    case "incoming":
    case "chime":
      phraseIncoming(ctx, 0);
      phraseIncoming(ctx, INCOMING_DUR + INCOMING_GAP);
      break;

    // ── activation: 3 repetitions (brighter) ────────────────────────────────
    case "activation":
    case "incoming_soft":
    case "beep":
      phraseActivation(ctx, 0);
      phraseActivation(ctx,  ACTIVATION_DUR + ACTIVATION_GAP);
      phraseActivation(ctx, (ACTIVATION_DUR + ACTIVATION_GAP) * 2);
      break;

    // ── tick: single phrase (activation register) ───────────────────────────
    case "tick":
      phraseActivation(ctx, 0);
      break;

    // ── incoming_urgent / alarm: 3 reps escalation register ─────────────────
    case "incoming_urgent":
    case "alarm":
      phraseEscalation(ctx, 0);
      phraseEscalation(ctx,  ESCALATION_DUR + ESCALATION_GAP);
      phraseEscalation(ctx, (ESCALATION_DUR + ESCALATION_GAP) * 2);
      break;

    // ── escalation: 4 repetitions (most urgent) ─────────────────────────────
    case "escalation": {
      const step = ESCALATION_DUR + ESCALATION_GAP;
      phraseEscalation(ctx, 0);
      phraseEscalation(ctx, step);
      phraseEscalation(ctx, step * 2);
      phraseEscalation(ctx, step * 3);
      break;
    }

    default:
      phraseIncoming(ctx, 0);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Play a notification sound by ID.
 *
 * On iOS Safari the AudioContext starts suspended; calling ctx.resume()
 * inside this function (which must be invoked from a user-gesture handler)
 * unlocks audio without needing a separate click listener.
 */
export function playAlert(soundId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      ctx.resume()
        .then(() => doPlay(soundId))
        .catch((e) => console.warn("SoundService: resume failed", e));
      return;
    }
    doPlay(soundId);
  } catch (e) {
    console.warn("SoundService: audio playback failed", e);
  }
}

export const AVAILABLE_SOUNDS = [
  { id: "incoming",        label: "Innkommende (× 2, rolig)"     },
  { id: "activation",      label: "Aktivering (× 3, lysere)"     },
  { id: "escalation",      label: "Eskalering (× 4, høyest)"     },
  { id: "tick",            label: "Tick (× 1)"                   },
  { id: "incoming_urgent", label: "Urgent (× 3, høyt register)"  },
  { id: "chime",           label: "Klokke"                       },
  { id: "beep",            label: "Pip"                          },
  { id: "alarm",           label: "Alarm"                        },
  { id: "incoming_soft",   label: "Myk varsling"                 },
] as const;
