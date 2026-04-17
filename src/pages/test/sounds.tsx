import Head from "next/head";
import { useRouter } from "next/router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Volume2, ArrowLeft } from "lucide-react";
import { playAlert } from "@/services/SoundService";

const SOUNDS = [
  { id: "incoming",   label: "Innkommende melding" },
  { id: "activation", label: "Aktivering"          },
  { id: "escalation", label: "Eskalering"          },
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
              {SOUNDS.map(({ id, label }) => (
                <div key={id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <span className="font-medium">{label}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => playAlert(id)}
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
