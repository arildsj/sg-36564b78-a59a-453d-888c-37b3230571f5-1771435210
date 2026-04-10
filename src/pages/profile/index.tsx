import React, { useState, useEffect } from "react";
import Head from "next/head";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageProvider";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertCircle, User, Lock, Settings } from "lucide-react";

const db = supabase as any;

export default function ProfilePage() {
  const { t } = useLanguage();

  // ── Profile state ─────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Password state ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");

      const { data: profile } = await db
        .from("user_profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
      }
      setProfileLoading(false);
    };
    load();
  }, []);

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await db
        .from("user_profiles")
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq("id", user.id);

      if (error) throw error;
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message ?? t("profile.save_error"));
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    setPasswordSuccess(false);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.password_mismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Nytt passord må ha minst 8 tegn.");
      return;
    }

    setPasswordSaving(true);
    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError(t("profile.password_wrong"));
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message ?? t("profile.save_error"));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <AppLayout>
      <Head>
        <title>{t("profile.title")} – SeMSe</title>
      </Head>

      <div className="max-w-xl space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          {t("profile.title")}
        </h1>

        {/* ── Section 1: Personal information ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("profile.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileLoading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">{t("profile.name")}</Label>
                  <Input
                    id="profile-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ditt fulle navn"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-email">{t("profile.email")}</Label>
                  <Input
                    id="profile-email"
                    value={email}
                    readOnly
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("profile.email_readonly_hint")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profile-phone">{t("profile.phone")}</Label>
                  <Input
                    id="profile-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+47 123 45 678"
                  />
                </div>

                {profileSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {t("profile.saved")}
                  </div>
                )}
                {profileError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {profileError}
                  </div>
                )}

                <Button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="w-full sm:w-auto"
                >
                  {profileSaving ? t("common.loading") : t("profile.save")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 2: Change password ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {t("profile.change_password")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">{t("profile.current_password")}</Label>
              <Input
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-pw">{t("profile.new_password")}</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">{t("profile.confirm_password")}</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {passwordSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {t("profile.password_updated")}
              </div>
            )}
            {passwordError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {passwordError}
              </div>
            )}

            <Button
              onClick={handleChangePassword}
              disabled={
                passwordSaving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="w-full sm:w-auto"
            >
              {passwordSaving ? t("common.loading") : t("profile.save")}
            </Button>
          </CardContent>
        </Card>

        {/* ── Section 3: Preferences ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t("nav.settings")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("common.language")}</p>
                <LanguageSwitch />
              </div>
              <Separator orientation="vertical" className="h-10 hidden sm:block" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("common.theme")}</p>
                <ThemeSwitch />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
