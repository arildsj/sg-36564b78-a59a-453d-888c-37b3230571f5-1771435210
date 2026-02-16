import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OnboardingStep = "register" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("register");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    organization_name: ""
  });

  const steps: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
    { id: "register", label: "Registrering", icon: <Building2 className="h-5 w-5" /> },
    { id: "complete", label: "Fullført", icon: <CheckCircle2 className="h-5 w-5" /> },
  ];

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

      // Success - show completion step
      setCurrentStep("complete");
      
      toast({ 
        title: "Konto opprettet!", 
        description: "Din organisasjon og administrator-konto er nå klar", 
        duration: 5000 
      });

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
        <title>Onboarding - SeMSe 2.0</title>
      </Head>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Velkommen til SeMSe 2.0</h1>
            <p className="text-muted-foreground mt-2">
              Opprett din organisasjon og kom i gang med SMS-håndtering
            </p>
          </div>

          <div className="flex items-center justify-center mb-8 gap-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex flex-col items-center ${
                    currentStep === step.id
                      ? "text-primary"
                      : steps.findIndex((s) => s.id === currentStep) > idx
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                      currentStep === step.id
                        ? "border-primary bg-primary/10"
                        : steps.findIndex((s) => s.id === currentStep) > idx
                        ? "border-primary bg-primary text-white"
                        : "border-muted"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span className="text-xs mt-2 font-medium">{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-24 h-0.5 mx-2 ${
                      steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {currentStep === "register" && (
            <Card>
              <CardHeader>
                <CardTitle>Opprett konto</CardTitle>
                <CardDescription>
                  Fyll inn informasjonen under for å opprette din organisasjon og administrator-konto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Personlig informasjon</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Fullt navn *</Label>
                    <Input
                      id="full-name"
                      placeholder="Ola Nordmann"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-post *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ola@minskole.no"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon *</Label>
                    <Input
                      id="phone"
                      placeholder="+4791234567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: +4791234567 (E.164)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Passord *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minst 6 tegn"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Bekreft passord *</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Skriv inn passordet på nytt"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Organisasjonsinformasjon</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="organization-name">Organisasjonsnavn *</Label>
                    <Input
                      id="organization-name"
                      placeholder="Min Skole"
                      value={formData.organization_name}
                      onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleRegister} 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Oppretter konto..." : "Opprett konto"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Har du allerede konto?{" "}
                  <button
                    onClick={() => router.push("/login")}
                    className="text-primary hover:underline"
                  >
                    Logg inn her
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {currentStep === "complete" && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  Organisasjon opprettet!
                </CardTitle>
                <CardDescription>
                  Din organisasjon og administrator-konto er nå klar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm text-green-900 dark:text-green-100">
                    ✅ Alt er klart!
                  </h3>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Du kan nå logge inn og begynne å bruke SeMSe 2.0
                  </p>
                </div>
                
                <Button onClick={() => router.push("/login")} className="w-full">
                  Logg inn nå
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}