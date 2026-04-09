import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Building2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageProvider";

interface ValidationErrors {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  organization_name?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    organization_name: ""
  });

  // CRITICAL: Clear any old sessions on mount to ensure clean onboarding
  useEffect(() => {
    const clearOldSession = async () => {
      try {
        console.log("🧹 Clearing any old sessions before onboarding...");
        await supabase.auth.signOut();
        console.log("✅ Old sessions cleared");
      } catch (error) {
        console.error("❌ Error clearing sessions:", error);
      }
    };

    clearOldSession();
  }, []);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = t("onboarding.full_name_required");
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = t("onboarding.name_min_length");
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = t("onboarding.email_required");
    } else if (!validateEmail(formData.email)) {
      newErrors.email = t("onboarding.invalid_email");
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = t("onboarding.phone_required");
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = t("onboarding.phone_format");
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t("onboarding.password_required");
    } else if (formData.password.length < 6) {
      newErrors.password = t("onboarding.password_min_length");
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t("onboarding.confirm_password_required");
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("onboarding.passwords_no_match");
    }

    // Organization name validation
    if (!formData.organization_name.trim()) {
      newErrors.organization_name = t("onboarding.org_name_required");
    } else if (formData.organization_name.trim().length < 2) {
      newErrors.organization_name = t("onboarding.org_name_min_length");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    try {
      // Validate form before proceeding
      if (!validateForm()) {
        toast({
          title: t("onboarding.validation_error"),
          description: t("onboarding.fix_errors"),
          variant: "destructive"
        });
        return;
      }

      setLoading(true);

      console.log("🚀 Starting signup process...");

      // Sign up with Supabase Auth directly
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name.trim(),
            phone: formData.phone.trim(),
            organization_name: formData.organization_name.trim()
          }
        }
      });

      if (error) {
        console.error("❌ Signup error:", error);
        toast({
          title: t("onboarding.registration_error"),
          description: error.message || t("onboarding.could_not_create_account"),
          variant: "destructive"
        });
        return;
      }

      if (!data.user) {
        console.error("❌ No user returned from signup");
        toast({
          title: t("onboarding.registration_error"),
          description: t("onboarding.could_not_create_user"),
          variant: "destructive"
        });
        return;
      }

      console.log("✅ Auth user created:", data.user.id);
      console.log("📤 Calling onboard API...");

      const onboardPayload = {
        user_id: data.user.id,
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        organization_name: formData.organization_name.trim()
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
        let errorMessage = onboardData.message || t("onboarding.could_not_complete_registration");
        
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
          title: t("onboarding.creation_error"),
          description: errorMessage,
          variant: "destructive",
          duration: 10000
        });
        return;
      }

      console.log("✅ Onboarding successful!");

      // CRITICAL: Sign in the user explicitly to establish session
      console.log("🔐 Signing in user...");
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password
      });

      if (signInError) {
        console.error("❌ Sign in error after onboarding:", signInError);
        toast({
          title: t("onboarding.login_error"),
          description: t("onboarding.account_created_login_failed"),
          variant: "destructive",
          duration: 5000
        });
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }

      if (!signInData.session) {
        console.error("❌ No session after sign in");
        toast({
          title: t("onboarding.session_error"),
          description: t("onboarding.please_login_manually"),
          variant: "destructive"
        });
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        return;
      }

      console.log("✅ User signed in successfully with session!");

      // Success - user is now authenticated with valid session
      toast({
        title: t("onboarding.account_created"),
        description: t("onboarding.redirecting_dashboard"),
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
        title: t("onboarding.critical_error"),
        description: `${t("onboarding.unexpected_error_prefix")} ${error.message || t("onboarding.unknown_error")}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Real-time validation on blur
  const handleBlur = (field: keyof ValidationErrors) => {
    const newErrors = { ...errors };

    switch (field) {
      case 'email':
        if (!formData.email.trim()) {
          newErrors.email = t("onboarding.email_required");
        } else if (!validateEmail(formData.email)) {
          newErrors.email = t("onboarding.invalid_email_short");
        } else {
          delete newErrors.email;
        }
        break;

      case 'phone':
        if (!formData.phone.trim()) {
          newErrors.phone = t("onboarding.phone_required");
        } else if (!validatePhone(formData.phone)) {
          newErrors.phone = t("onboarding.invalid_phone");
        } else {
          delete newErrors.phone;
        }
        break;

      case 'password':
        if (!formData.password) {
          newErrors.password = t("onboarding.password_required");
        } else if (formData.password.length < 6) {
          newErrors.password = t("onboarding.password_min_length");
        } else {
          delete newErrors.password;
        }
        break;

      case 'confirmPassword':
        if (!formData.confirmPassword) {
          newErrors.confirmPassword = t("onboarding.confirm_password_required");
        } else if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = t("onboarding.passwords_no_match");
        } else {
          delete newErrors.confirmPassword;
        }
        break;
    }

    setErrors(newErrors);
  };

  const isFormValid = () => {
    return formData.full_name.trim() &&
           formData.email.trim() &&
           validateEmail(formData.email) &&
           formData.phone.trim() &&
           validatePhone(formData.phone) &&
           formData.password.length >= 6 &&
           formData.password === formData.confirmPassword &&
           formData.organization_name.trim() &&
           Object.keys(errors).length === 0;
  };

  return (
    <>
      <Head>
        <title>Onboarding - SeMSe</title>
      </Head>

      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">{t("onboarding.welcome_title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("onboarding.welcome_description")}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {t("onboarding.create_account_title")}
              </CardTitle>
              <CardDescription>
                {t("onboarding.create_account_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("onboarding.personal_info")}</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="full-name">{t("onboarding.full_name_label")}</Label>
                  <Input
                    id="full-name"
                    placeholder="Ola Nordmann"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className={errors.full_name ? "border-red-500" : ""}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.full_name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("onboarding.email_label")}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ola@minskole.no"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => handleBlur('email')}
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email}
                    </p>
                  )}
                  {!errors.email && formData.email && (
                    <p className="text-xs text-green-600">{t("onboarding.valid_email")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("onboarding.phone_label")}</Label>
                  <Input
                    id="phone"
                    placeholder="+4791234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={() => handleBlur('phone')}
                    className={errors.phone ? "border-red-500" : ""}
                  />
                  {errors.phone && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.phone}
                    </p>
                  )}
                  {!errors.phone && formData.phone && validatePhone(formData.phone) && (
                    <p className="text-xs text-green-600">{t("onboarding.valid_phone")}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Format: +4791234567 (E.164)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t("onboarding.password_label")}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("onboarding.password_placeholder")}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    onBlur={() => handleBlur('password')}
                    className={errors.password ? "border-red-500" : ""}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.password}
                    </p>
                  )}
                  {!errors.password && formData.password.length >= 6 && (
                    <p className="text-xs text-green-600">{t("onboarding.password_strong")}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t("onboarding.confirm_password_label")}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder={t("onboarding.confirm_password_placeholder")}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    onBlur={() => handleBlur('confirmPassword')}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.confirmPassword}
                    </p>
                  )}
                  {!errors.confirmPassword && formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-xs text-green-600">{t("onboarding.passwords_match")}</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("onboarding.org_info")}</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="organization-name">{t("onboarding.org_name_label")}</Label>
                  <Input
                    id="organization-name"
                    placeholder="Min Skole"
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    className={errors.organization_name ? "border-red-500" : ""}
                  />
                  {errors.organization_name && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.organization_name}
                    </p>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleRegister} 
                className="w-full"
                disabled={loading || !isFormValid()}
              >
                {loading ? t("onboarding.creating_account") : t("onboarding.create_account_button")}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t("onboarding.already_have_account")}{" "}
                <button
                  onClick={() => router.push("/login")}
                  className="text-primary hover:underline"
                >
                  {t("onboarding.login_here")}
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}