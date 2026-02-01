import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import { Building2, UserCog, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OnboardingStep = "tenant" | "admin" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("tenant");
  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [tenantData, setTenantData] = useState({ 
    name: "",
    timezone: "Europe/Oslo"
  });
  
  const [adminData, setAdminData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const steps: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
    { id: "tenant", label: "Organisasjon", icon: <Building2 className="h-5 w-5" /> },
    { id: "admin", label: "Administrator", icon: <UserCog className="h-5 w-5" /> },
    { id: "complete", label: "Fullført", icon: <CheckCircle2 className="h-5 w-5" /> },
  ];

  const handleCreateTenant = async () => {
    try {
      setLoading(true);
      
      if (!tenantData.name.trim()) {
        toast({ title: "Mangler navn", description: "Fyll ut organisasjonsnavn", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from("tenants")
        .insert({ 
          name: tenantData.name
        })
        .select()
        .single();

      if (error) throw error;
      
      setTenantId(data.id);
      setCurrentStep("admin");
      toast({ title: "Organisasjon opprettet" });
    } catch (error) {
      console.error("Failed to create tenant:", error);
      toast({ title: "Feil", description: "Kunne ikke opprette organisasjon", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      setLoading(true);

      // Validation
      if (!adminData.name || !adminData.email || !adminData.phone || !adminData.password) {
        toast({ title: "Mangler info", description: "Alle felt må fylles ut", variant: "destructive" });
        return;
      }

      if (adminData.password !== adminData.confirmPassword) {
        toast({ title: "Feil", description: "Passordene matcher ikke", variant: "destructive" });
        return;
      }

      if (adminData.password.length < 6) {
        toast({ title: "Svakt passord", description: "Passordet må være minst 6 tegn", variant: "destructive" });
        return;
      }

      // Create Supabase Auth user
      const { user, error: signUpError } = await authService.signUp(
        adminData.email, 
        adminData.password
      );

      if (signUpError) {
        console.error("Sign up error:", signUpError);
        toast({ title: "Feil ved opprettelse", description: signUpError.message, variant: "destructive" });
        return;
      }

      if (!user) {
        toast({ title: "Feil", description: "Bruker ble ikke opprettet", variant: "destructive" });
        return;
      }

      // Create user record in database
      const { error: userError } = await supabase.from("users").insert({
        id: user.id,
        tenant_id: tenantId,
        name: adminData.name,
        email: adminData.email,
        phone_number: adminData.phone,
        role: "tenant_admin",
        status: "active",
      });

      if (userError) throw userError;

      // Try to sign in automatically (will fail if email confirmation is required)
      const { user: signedInUser, error: signInError } = await authService.signIn(
        adminData.email,
        adminData.password
      );

      if (signInError) {
        // Email confirmation required - provide clear instructions
        if (signInError.message?.includes("Email not confirmed")) {
          toast({ 
            title: "Sjekk e-posten din!", 
            description: "Bekreftelsese-post er sendt. Du må bekrefte før du logger inn.",
            duration: 10000 
          });
          setCurrentStep("complete");
          return;
        }
        
        console.error("Sign in error:", signInError);
        toast({ title: "Obs", description: "Bruker opprettet, men automatisk pålogging feilet. Logg inn manuelt.", variant: "warning" });
        setCurrentStep("complete");
        return;
      }

      // Successfully signed in - go to complete
      setCurrentStep("complete");
      toast({ title: "Administrator opprettet!", description: "Velkommen til SeMSe." });
    } catch (error) {
      console.error("Failed to create admin:", error);
      toast({ title: "Kritisk feil", description: "Feil ved opprettelse av administrator", variant: "destructive" });
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Velkommen til SeMSe 2.0</h1>
            <p className="text-muted-foreground mt-2">
              La oss sette opp organisasjonen din steg for steg
            </p>
          </div>

          <div className="flex items-center justify-between mb-8">
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
                    className={`w-16 h-0.5 mx-2 ${
                      steps.findIndex((s) => s.id === currentStep) > idx
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {currentStep === "tenant" && (
            <Card>
              <CardHeader>
                <CardTitle>Opprett organisasjon</CardTitle>
                <CardDescription>
                  Dette er toppnivået i hierarkiet ditt. Alt tilhører en organisasjon (tenant).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Organisasjonsnavn *</Label>
                  <Input
                    id="tenant-name"
                    placeholder="Fair Teknologi AS"
                    value={tenantData.name}
                    onChange={(e) => setTenantData({ ...tenantData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-timezone">Tidssone</Label>
                  <select
                    id="tenant-timezone"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={tenantData.timezone}
                    onChange={(e) => setTenantData({ ...tenantData, timezone: e.target.value })}
                  >
                    <option value="Europe/Oslo">Europe/Oslo (Norge)</option>
                    <option value="Europe/Stockholm">Europe/Stockholm (Sverige)</option>
                    <option value="Europe/Copenhagen">Europe/Copenhagen (Danmark)</option>
                    <option value="UTC">UTC</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Tidssonen brukes for åpningstider og rapporter
                  </p>
                </div>
                <Button 
                  onClick={handleCreateTenant} 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Oppretter..." : "Neste: Opprett administrator"}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle>Opprett Tenant-administrator</CardTitle>
                <CardDescription>
                  Dette er hovedadministratoren for organisasjonen. Du vil bli automatisk logget inn etter opprettelse.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Fullt navn *</Label>
                  <Input
                    id="admin-name"
                    placeholder="Ola Nordmann"
                    value={adminData.name}
                    onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">E-post *</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="ola@fairteknologi.no"
                    value={adminData.email}
                    onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dette vil være din påloggings-e-post
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-phone">Telefon *</Label>
                  <Input
                    id="admin-phone"
                    placeholder="+4791234567"
                    value={adminData.phone}
                    onChange={(e) => setAdminData({ ...adminData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Passord *</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Minst 6 tegn"
                    value={adminData.password}
                    onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-confirm-password">Bekreft passord *</Label>
                  <Input
                    id="admin-confirm-password"
                    type="password"
                    placeholder="Skriv inn passordet på nytt"
                    value={adminData.confirmPassword}
                    onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })}
                  />
                </div>
                <Button 
                  onClick={handleCreateAdmin} 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Oppretter..." : "Fullfør oppsett"}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "complete" && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                  Grunnleggende oppsett fullført!
                </CardTitle>
                <CardDescription>
                  Organisasjonen og administratoren er opprettet. Du kan nå logge inn og fullføre konfigurasjonen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                    ✅ Hva er gjort så langt:
                  </h3>
                  <ul className="space-y-1 text-sm list-disc list-inside text-blue-800 dark:text-blue-200">
                    <li>Organisasjonen "{tenantData.name}" er opprettet</li>
                    <li>Tenant-administrator "{adminData.name}" er opprettet</li>
                    <li>Du er klar til å logge inn og fortsette</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">📋 Neste steg etter pålogging:</h3>
                  <ul className="space-y-1 text-sm list-disc list-inside">
                    <li><strong>Innstillinger:</strong> Konfigurer Fair Gateway (SMS-gateway)</li>
                    <li><strong>Admin-panel:</strong> Opprett grupper (Support, Salg, osv.)</li>
                    <li><strong>Admin-panel:</strong> Legg til brukere og tildel til grupper</li>
                    <li><strong>Admin-panel:</strong> Sett opp åpningstider per gruppe</li>
                    <li><strong>Admin-panel:</strong> Konfigurer routing-regler og auto-svar</li>
                    <li><strong>Simulering:</strong> Test systemet med SMS-simulering</li>
                  </ul>
                </div>
                
                <div className="flex gap-4">
                  <Button onClick={() => router.push("/settings")} className="flex-1">
                    Gå til innlogging
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/")} className="flex-1">
                    Gå til forside
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}