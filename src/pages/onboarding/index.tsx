import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import { Building2, UserCog, Phone, CheckCircle2 } from "lucide-react";

type OnboardingStep = "tenant" | "admin" | "gateway" | "complete";

export default function OnboardingPage() {
  const router = useRouter();
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
  
  const [gateway, setGateway] = useState({ 
    name: "", 
    phone: "" 
  });

  const steps: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
    { id: "tenant", label: "Organisasjon", icon: <Building2 className="h-5 w-5" /> },
    { id: "admin", label: "Administrator", icon: <UserCog className="h-5 w-5" /> },
    { id: "gateway", label: "Gateway", icon: <Phone className="h-5 w-5" /> },
    { id: "complete", label: "Fullført", icon: <CheckCircle2 className="h-5 w-5" /> },
  ];

  const handleCreateTenant = async () => {
    try {
      setLoading(true);
      
      if (!tenantData.name.trim()) {
        alert("Vennligst fyll ut organisasjonsnavn");
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
    } catch (error) {
      console.error("Failed to create tenant:", error);
      alert("Feil ved opprettelse av organisasjon");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      setLoading(true);

      // Validation
      if (!adminData.name || !adminData.email || !adminData.phone || !adminData.password) {
        alert("Vennligst fyll ut alle feltene");
        return;
      }

      if (adminData.password !== adminData.confirmPassword) {
        alert("Passordene matcher ikke");
        return;
      }

      if (adminData.password.length < 6) {
        alert("Passordet må være minst 6 tegn");
        return;
      }

      // Create Supabase Auth user
      const { user, error: signUpError } = await authService.signUp(
        adminData.email, 
        adminData.password
      );

      if (signUpError) {
        console.error("Sign up error:", signUpError);
        alert(`Feil ved opprettelse av bruker: ${signUpError.message}`);
        return;
      }

      if (!user) {
        alert("Bruker ble ikke opprettet");
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
          alert(
            "✅ Bruker opprettet!\n\n" +
            "⚠️ E-postbekreftelse er påkrevd i Supabase.\n\n" +
            "Vennligst gjør ett av følgende:\n" +
            "1. Gå til Supabase Dashboard → Authentication → Providers → Email\n" +
            "   og skru AV 'Confirm email' (Enable email confirmations)\n\n" +
            "2. Eller sjekk e-posten din for bekreftelseslenke\n\n" +
            "Deretter kan du logge inn på /settings og fortsette oppsettet."
          );
          // Skip gateway setup and go straight to complete with manual login instruction
          setCurrentStep("complete");
          return;
        }
        
        console.error("Sign in error:", signInError);
        alert("Bruker opprettet, men automatisk pålogging feilet. Vennligst logg inn manuelt.");
        setCurrentStep("complete");
        return;
      }

      // Successfully signed in - continue to gateway setup
      setCurrentStep("gateway");
    } catch (error) {
      console.error("Failed to create admin:", error);
      alert("Feil ved opprettelse av administrator");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGateway = async () => {
    try {
      setLoading(true);

      if (!gateway.name || !gateway.phone) {
        alert("Vennligst fyll ut gateway-informasjon");
        return;
      }

      const { error } = await supabase.from("gateways").insert({
        tenant_id: tenantId,
        name: gateway.name,
        phone_number: gateway.phone,
        fallback_group_id: null,
        status: "active",
      });

      if (error) throw error;
      
      setCurrentStep("complete");
    } catch (error) {
      console.error("Failed to create gateway:", error);
      alert("Feil ved opprettelse av gateway");
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
                  {loading ? "Oppretter..." : "Neste: Konfigurer gateway"}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === "gateway" && (
            <Card>
              <CardHeader>
                <CardTitle>Konfigurer FairGateway</CardTitle>
                <CardDescription>
                  Gateway som mottar og sender SMS. Telefonnummeret som skal brukes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gateway-name">Gateway-navn *</Label>
                  <Input
                    id="gateway-name"
                    placeholder="FairGateway Hovedkontor"
                    value={gateway.name}
                    onChange={(e) => setGateway({ ...gateway, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gateway-phone">Telefonnummer *</Label>
                  <Input
                    id="gateway-phone"
                    placeholder="+4740123456"
                    value={gateway.phone}
                    onChange={(e) => setGateway({ ...gateway, phone: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dette er nummeret som vil motta og sende SMS-meldinger
                  </p>
                </div>
                <Button 
                  onClick={handleCreateGateway} 
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
                  Administrator opprettet!
                </CardTitle>
                <CardDescription>
                  Brukeren din er opprettet. For å fortsette må du logge inn.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100">
                    ⚠️ E-postbekreftelse påkrevd
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Supabase krever e-postbekreftelse før pålogging. Du har to alternativer:
                  </p>
                  <ol className="space-y-1 text-sm list-decimal list-inside text-yellow-800 dark:text-yellow-200">
                    <li>
                      <strong>For utvikling/testing:</strong> Gå til Supabase Dashboard → 
                      Authentication → Providers → Email og skru AV "Confirm email"
                    </li>
                    <li>
                      <strong>For produksjon:</strong> Sjekk e-posten din ({adminData.email}) 
                      for bekreftelseslenke
                    </li>
                  </ol>
                </div>
                
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">Neste steg etter pålogging:</h3>
                  <ul className="space-y-1 text-sm list-disc list-inside">
                    <li>Gå til Settings og fullfør gateway-oppsett</li>
                    <li>Gå til Admin-panelet for å legge til grupper</li>
                    <li>Opprett brukere og tildel dem til grupper</li>
                    <li>Sett opp åpningstider per gruppe</li>
                    <li>Konfigurer routing-regler og auto-svar</li>
                    <li>Test systemet med SMS-simulering</li>
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