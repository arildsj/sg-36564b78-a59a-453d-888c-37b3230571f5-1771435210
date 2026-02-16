import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    organization_name: ""
  });

  const handleRegister = async () => {
    try {
      setLoading(true);

      // Frontend validation
      if (!formData.full_name || !formData.email || !formData.phone || !formData.password || !formData.organization_name) {
        toast({ title: "Mangler info", description: "Alle felt må fylles ut", variant: "destructive" });
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        toast({ title: "Feil", description: "Passordene matcher ikke", variant: "destructive" });
        return;
      }

      if (formData.password.length < 6) {
        toast({ title: "Svakt passord", description: "Passordet må være minst 6 tegn", variant: "destructive" });
        return;
      }

      // Validate phone format (E.164)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(formData.phone)) {
        toast({ 
          title: "Ugyldig telefonnummer", 
          description: "Telefonnummer må være i E.164-format (f.eks. +4791234567)", 
          variant: "destructive" 
        });
        return;
      }

      // Call the onboard API endpoint
      const response = await fetch("/api/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          organization_name: formData.organization_name
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Onboard API error:", data);
        toast({ 
          title: "Registreringsfeil", 
          description: data.message || "Kunne ikke opprette konto", 
          variant: "destructive" 
        });
        return;
      }

      // Success
      toast({ 
        title: "Konto opprettet", 
        description: "Din organisasjon og administrator-konto er nå klar", 
      });

      // Redirect to login after short delay
      setTimeout(() => {
        router.push("/login");
      }, 1500);

    } catch (error) {
      console.error("Registration error:", error);
      toast({ 
        title: "Kritisk feil", 
        description: "En uventet feil oppstod", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Registrering - SeMSe 2.0</title>
      </Head>

      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-lg mb-4">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              Velkommen til SeMSe 2.0
            </h1>
            <p className="text-muted-foreground">
              Opprett din organisasjon og kom i gang
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Opprett konto</CardTitle>
              <CardDescription>
                Fyll inn informasjonen under for å komme i gang
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Fullt navn</Label>
                  <Input
                    id="full-name"
                    placeholder="Ola Nordmann"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ola@minskole.no"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    placeholder="+4791234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: +4791234567 (E.164)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Passord</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minst 6 tegn"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Bekreft passord</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Skriv inn passordet på nytt"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organization-name">Organisasjonsnavn</Label>
                  <Input
                    id="organization-name"
                    placeholder="Min Skole"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </div>

              <Button 
                onClick={handleRegister} 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Oppretter konto...
                  </>
                ) : (
                  "Opprett konto"
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Har du allerede konto?{" "}
                <button
                  onClick={() => router.push("/login")}
                  className="text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Logg inn her
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}