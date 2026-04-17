import Head from "next/head";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Web Audio API synth — the public/sounds/*.mp3 files are stub placeholders
// (all identical, null-byte bodies) so file-based playback produces silence.
// These synthesized tones are triggered by user gesture and have no autoplay
// issues.
// ---------------------------------------------------------------------------

type Tone = { freq: number; duration: number; delay?: number };

function playTones(tones: Tone[]) {
  const ctx = new AudioContext();
  tones.forEach(({ freq, duration, delay = 0 }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.4, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start);
    osc.stop(start + duration);
  });
}

// Distinct tones per event type
const SOUNDS = [
  {
    id: "incoming",
    label: "Innkommende melding",
    // Two-tone ascending chime: C5 → E5
    play: () => playTones([
      { freq: 523, duration: 0.18 },
      { freq: 659, duration: 0.28, delay: 0.15 },
    ]),
  },
  {
    id: "activation",
    label: "Aktivering",
    // Three-tone ascending: C5 → E5 → G5
    play: () => playTones([
      { freq: 523, duration: 0.15 },
      { freq: 659, duration: 0.15, delay: 0.13 },
      { freq: 784, duration: 0.30, delay: 0.26 },
    ]),
  },
  {
    id: "escalation",
    label: "Eskalering",
    // Urgent double-pulse: G5 → G5
    play: () => playTones([
      { freq: 784, duration: 0.12 },
      { freq: 784, duration: 0.20, delay: 0.18 },
    ]),
  },
];

export default function SoundsTestPage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Lydvarsler – SeMSe</title>
      </Head>
      <AppLayout>
        <div className="space-y-6 max-w-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Lydvarsler</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Test varsellyder – Turdus philomelos
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Varsellyder</CardTitle>
              <CardDescription>
                Klikk for å forhåndsvise hver lyd.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SOUNDS.map(({ id, label, play }) => (
                <div key={id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <span className="font-medium">{label}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={play}
                    title={`Spill av: ${label}`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}
