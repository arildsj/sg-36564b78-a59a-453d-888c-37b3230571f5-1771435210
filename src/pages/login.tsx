import { useState } from "react";
import { useRouter } from "next/router";
import { authService } from "@/services/authService";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/contexts/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function LoginPage() {
  return (
    <>
      <SEO
        title="Login"
        description="Sign in to SeMSe"
      />
      <LoginPageContent />
    </>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
          setError(signInError.message || t("error.generic"));
        }
        setLoading(false);
        return;
      }

      if (!user) {
        setError(t("error.generic"));
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      console.error("Login error:", err);
      setError(t("error.generic"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>

      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">SeMSe 2.0</h1>
            <p className="text-slate-400">{t("login.description")}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                {t("login.email")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                placeholder={t("login.email_placeholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                {t("login.password")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
                placeholder={t("login.password_placeholder")}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? t("login.logging_in") : t("login.button")}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <a
              href="#"
              className="text-sm text-blue-400 hover:text-blue-300 block"
            >
              {t("login.no_account")}
            </a>
            <a
              href="#"
              className="text-sm text-slate-400 hover:text-slate-300 block"
            >
              {t("login.forgot_password")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}