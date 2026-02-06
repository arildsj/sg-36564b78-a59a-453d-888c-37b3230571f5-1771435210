import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "no" | "en";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

type Translations = {
  [key: string]: {
    no: string;
    en: string;
  };
};

// Translation dictionary
const translations: Translations = {
  // Navigation
  "nav.dashboard": { no: "Dashboard", en: "Dashboard" },
  "nav.inbox": { no: "Innboks", en: "Inbox" },
  "nav.contacts": { no: "Kontakter", en: "Contacts" },
  "nav.send": { no: "Send melding", en: "Send message" },
  "nav.campaigns": { no: "Kampanjer", en: "Campaigns" },
  "nav.simulate": { no: "Simulering", en: "Simulation" },
  "nav.admin": { no: "Administrasjon", en: "Administration" },
  "nav.settings": { no: "Innstillinger", en: "Settings" },
  "nav.logout": { no: "Logg ut", en: "Log out" },
  
  // Theme
  "theme.light": { no: "Light", en: "Light" },
  "theme.dark": { no: "Dark", en: "Dark" },
  "theme.system": { no: "System", en: "System" },
  "theme.toggle": { no: "Bytt tema", en: "Toggle theme" },
  
  // Common
  "common.loading": { no: "Laster...", en: "Loading..." },
  "common.save": { no: "Lagre", en: "Save" },
  "common.cancel": { no: "Avbryt", en: "Cancel" },
  "common.delete": { no: "Slett", en: "Delete" },
  "common.edit": { no: "Rediger", en: "Edit" },
  "common.close": { no: "Lukk", en: "Close" },
  "common.search": { no: "Søk", en: "Search" },
  
  // Login
  "login.title": { no: "Logg inn - SeMSe 2.0", en: "Log in - SeMSe 2.0" },
  "login.description": { no: "Logg inn for å administrere meldinger og operasjoner", en: "Log in to manage messages and operations" },
  "login.email": { no: "E-post", en: "Email" },
  "login.password": { no: "Passord", en: "Password" },
  "login.button": { no: "Logg inn", en: "Log in" },
  "login.logging_in": { no: "Logger inn...", en: "Logging in..." },
  "login.no_account": { no: "Har du ikke en konto? Kom i gang her", en: "Don't have an account? Get started here" },
  "login.forgot_password": { no: "Glemt passord? Kontakt administrator", en: "Forgot password? Contact administrator" },
  "login.demo": { no: "Demo", en: "Demo" },
  
  // Errors
  "error.email_not_confirmed": { no: "E-posten din er ikke bekreftet. Sjekk innboksen din for bekreftelseslenke.", en: "Your email is not confirmed. Check your inbox for confirmation link." },
  "error.invalid_credentials": { no: "Feil e-post eller passord. Prøv igjen.", en: "Invalid email or password. Try again." },
  "error.login_failed": { no: "Pålogging feilet. Prøv igjen.", en: "Login failed. Try again." },
  "error.unexpected": { no: "En uventet feil oppstod. Prøv igjen.", en: "An unexpected error occurred. Try again." },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("no");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("semse-language") as Language;
    if (savedLanguage && (savedLanguage === "no" || savedLanguage === "en")) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("semse-language", lang);
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation for key: ${key}`);
      return key;
    }
    return translation[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}