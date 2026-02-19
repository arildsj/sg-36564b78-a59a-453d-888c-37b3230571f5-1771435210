import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Building2, CheckCircle2 } from "lucide-react";
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

      console.log("🚀 Starting signup process...");

      // Sign up with Supabase Auth directly
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
            phone: formData.phone,
            organization_name: formData.organization_name
          }
        }
      });

      if (error) {
        console.error("❌ Signup error:", error);
        toast({ 
          title: "Registreringsfeil", 
          description: error.message || "Kunne ikke opprette konto", 
          variant: "destructive" 
        });
        return;
      }

      if (!data.user) {
        console.error("❌ No user returned from signup");
        toast({ 
          title: "Registreringsfeil", 
          description: "Kunne ikke opprette bruker", 
          variant: "destructive" 
        });
        return;
      }

      console.log("✅ Auth user created:", data.user.id);
      console.log("📤 Calling onboard API...");

      const onboardPayload = {
        user_id: data.user.id,
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone,
        organization_name: formData.organization_name
      };

      console.log("📦 Onboard payload:", onboardPayload);

      // Call onboard API to create tenant and user_profile
      const onboardResponse = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardPayload)
      });

      const onboardData = await onboardResponse.json();

      console.log("📥 Onboard API response:", {
        status: onboardResponse.status,
        ok: onboardResponse.ok,
        data: onboardData
      });

      if (!onboardResponse.ok) {
        console.error("❌ Onboard API error:", onboardData);
        
        // Log full error details to console
        if (onboardData.debug) {
          console.error("🔍 Debug info:", JSON.stringify(onboardData.debug, null, 2));
        }

        // Show detailed error message including debug info
        let errorMessage = onboardData.message || "Kunne ikke fullføre registrering";
        
        // If there's debug info, show it in a more readable format
        if (onboardData.debug) {
          const debugInfo = onboardData.debug;
          
          // Check for tenant error
          if (debugInfo.tenantError) {
            console.error("🔴 Tenant Error:", debugInfo.tenantError);
            errorMessage += `\n\nTenant feil: ${debugInfo.tenantError.message}`;
            if (debugInfo.tenantError.code) {
              errorMessage += ` (${debugInfo.tenantError.code})`;
            }
          }
          
          // Check for user error
          if (debugInfo.userError) {
            console.error("🔴 User Error:", debugInfo.userError);
            errorMessage += `\n\nBruker feil: ${debugInfo.userError.message}`;
            if (debugInfo.userError.code) {
              errorMessage += ` (${debugInfo.userError.code})`;
            }
          }

          // Check for environment variable issues
          if (debugInfo.hasUrl === false || debugInfo.hasKey === false) {
            console.error("🔴 Environment variables missing!");
            errorMessage += "\n\n⚠️ Server configuration problem: Missing environment variables";
          }

          // Generic error info
          if (debugInfo.error) {
            console.error("🔴 Generic Error:", debugInfo.error);
            errorMessage += `\n\nFeil: ${debugInfo.error}`;
          }
        }

        toast({ 
          title: "Feil ved opprettelse", 
          description: errorMessage, 
          variant: "destructive",
          duration: 10000
        });
        return;
      }

      console.log("✅ Onboarding successful!");

      // Success - since email confirmation is disabled, log user in immediately
      toast({ 
        title: "Konto opprettet!", 
        description: "Du sendes til dashboardet...", 
        duration: 2000 
      });

      // Wait a moment for toast to show, then redirect to dashboard
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (error: any) {
      console.error("❌ Registration error:", error);
      console.error("Error stack:", error?.stack);
      toast({ 
        title: "Kritisk feil", 
        description: `En uventet feil oppstod: ${error.message || "Ukjent feil"}`, 
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Opprett konto
              </CardTitle>
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
        </div>
      </div>
    </>
  );
}