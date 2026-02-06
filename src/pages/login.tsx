import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageProvider";
import { authService } from "@/services/authService";
import { Loader2, AlertCircle } from "lucide-react";

function LoginPageContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { user, error: signInError } = await authService.signIn(email, password);

      if (signInError) {
        if (signInError.message?.includes("Email not confirmed")) {
          setError(t("error.email_not_confirmed"));
        } else if (signInError.message?.includes("Invalid login credentials")) {
          setError(t("error.invalid_credentials"));
        } else {
          setError(signInError.message || t("error.login_failed"));
        }
        setLoading(false);
        return;
      }

      if (user) {
        router.push("/");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(t("error.unexpected"));
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{t("login.title")}</title>
        <meta name="description" content={t("login.description")} />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
        {/* Language and Theme switches in top-right corner */}
        <div className="fixed top-4 right-4 flex gap-2 z-50">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center">SeMSe 2.0</CardTitle>
            <CardDescription className="text-center">
              {t("login.description")}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@epost.no"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full h-11" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("login.logging_in")}
                  </>
                ) : (
                  t("login.button")
                )}
              </Button>

              <div className="text-sm text-center space-y-2">
                <div>
                  <Link href="/onboarding" className="text-primary hover:underline">
                    {t("login.no_account")}
                  </Link>
                </div>
                <div className="text-muted-foreground">
                  {t("login.forgot_password")}
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Demo credentials hint */}
        <div className="absolute bottom-4 left-4 right-4 text-center">
          <div className="inline-block bg-muted/50 backdrop-blur-sm rounded-lg p-3 text-xs text-muted-foreground">
            <strong>{t("login.demo")}:</strong> arild@fair.as
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <LanguageProvider>
      <LoginPageContent />
    </LanguageProvider>
  );
}