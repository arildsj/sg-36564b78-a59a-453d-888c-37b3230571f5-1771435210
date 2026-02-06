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
  
  // Dashboard
  "dashboard.title": { no: "Dashboard", en: "Dashboard" },
  "dashboard.description": { no: "Oversikt over meldinger og operasjoner", en: "Overview of messages and operations" },
  "dashboard.unhandled_messages": { no: "Ubehandlede meldinger", en: "Unhandled messages" },
  "dashboard.awaiting_confirmation": { no: "Venter på bekreftelse", en: "Awaiting confirmation" },
  "dashboard.operational_groups": { no: "Operative grupper", en: "Operational groups" },
  "dashboard.active_inboxes": { no: "Aktive innbokser", en: "Active inboxes" },
  "dashboard.on_duty_users": { no: "On-duty brukere", en: "On-duty users" },
  "dashboard.active_operators": { no: "Aktive operatører", en: "Active operators" },
  "dashboard.avg_response_time": { no: "Gjennomsnittlig svartid", en: "Average response time" },
  "dashboard.last_24h": { no: "Siste 24 timer", en: "Last 24 hours" },
  "dashboard.recent_messages": { no: "Siste meldinger", en: "Recent messages" },
  "dashboard.newest_inbound": { no: "Nyeste inngående meldinger på tvers av grupper", en: "Newest inbound messages across groups" },
  "dashboard.no_messages": { no: "Ingen meldinger ennå", en: "No messages yet" },
  "dashboard.see_all_messages": { no: "Se alle meldinger", en: "See all messages" },
  "dashboard.duty_status": { no: "Vakt-status", en: "Duty status" },
  "dashboard.on_duty_coverage": { no: "Oversikt over on-duty dekning per gruppe", en: "Overview of on-duty coverage per group" },
  "dashboard.no_operational_groups": { no: "Ingen operative grupper opprettet", en: "No operational groups created" },
  "dashboard.create_first_group": { no: "Opprett første gruppe", en: "Create first group" },
  "dashboard.manage_groups": { no: "Administrer grupper", en: "Manage groups" },
  "dashboard.on_duty": { no: "on-duty", en: "on-duty" },
  "dashboard.open": { no: "Åpen", en: "Open" },
  "dashboard.closed": { no: "Stengt", en: "Closed" },
  
  // Inbox/Conversations
  "inbox.title": { no: "Samtaler", en: "Conversations" },
  "inbox.description": { no: "Håndter meldinger fra dine grupper.", en: "Manage messages from your groups." },
  "inbox.all_conversations": { no: "Alle samtaler", en: "All conversations" },
  "inbox.unknown_senders": { no: "Ukjente avsendere", en: "Unknown senders" },
  "inbox.escalated": { no: "Eskalerte", en: "Escalated" },
  "inbox.filter_by_group": { no: "Filtrer etter gruppe", en: "Filter by group" },
  "inbox.all_groups": { no: "Alle grupper", en: "All groups" },
  "inbox.conversations_count": { no: "Samtaler", en: "Conversations" },
  "inbox.no_conversations": { no: "Ingen samtaler", en: "No conversations" },
  "inbox.no_unknown": { no: "Ingen ukjente avsendere for øyeblikket", en: "No unknown senders at the moment" },
  "inbox.no_escalated": { no: "Ingen eskalerte meldinger", en: "No escalated messages" },
  "inbox.messages_appear": { no: "Meldinger vil vises her når de ankommer", en: "Messages will appear here when they arrive" },
  "inbox.no_found": { no: "Ingen samtaler funnet", en: "No conversations found" },
  "inbox.bulk": { no: "Bulk", en: "Bulk" },
  "inbox.responses": { no: "svar", en: "responses" },
  "inbox.unknown": { no: "Ukjent", en: "Unknown" },
  "inbox.select_conversation": { no: "Velg en samtale", en: "Select a conversation" },
  "inbox.select_help": { no: "Velg en samtale fra listen til venstre for å se meldingshistorikk og svare.", en: "Select a conversation from the list on the left to view message history and reply." },
  "inbox.resolve": { no: "Løs", en: "Resolve" },
  "inbox.move": { no: "Flytt", en: "Move" },
  "inbox.write_reply": { no: "Skriv et svar...", en: "Write a reply..." },
  "inbox.loading_messages": { no: "Laster meldinger...", en: "Loading messages..." },
  "inbox.no_messages_thread": { no: "Ingen meldinger i denne tråden", en: "No messages in this thread" },
  "inbox.you": { no: "Du", en: "You" },
  
  // Contacts
  "contacts.title": { no: "Kontakter", en: "Contacts" },
  "contacts.description": { no: "Administrer kontakter og søk i historikk", en: "Manage contacts and search history" },
  "contacts.new_contact": { no: "Ny kontakt", en: "New contact" },
  "contacts.search_filter": { no: "Søk og filtrer", en: "Search and filter" },
  "contacts.search_placeholder": { no: "Søk etter navn eller telefonnummer...", en: "Search by name or phone number..." },
  "contacts.count": { no: "kontakter", en: "contacts" },
  "contacts.no_found": { no: "Ingen kontakter funnet", en: "No contacts found" },
  "contacts.name": { no: "Navn", en: "Name" },
  "contacts.phone": { no: "Telefon", en: "Phone" },
  "contacts.email": { no: "E-post", en: "Email" },
  "contacts.groups": { no: "Grupper", en: "Groups" },
  "contacts.created": { no: "Opprettet", en: "Created" },
  "contacts.actions": { no: "Handlinger", en: "Actions" },
  "contacts.edit": { no: "Rediger kontakt", en: "Edit contact" },
  "contacts.add": { no: "Legg til ny kontakt", en: "Add new contact" },
  "contacts.update_info": { no: "Oppdater kontaktinformasjon og gruppetilhørighet.", en: "Update contact information and group membership." },
  "contacts.create_info": { no: "Opprett en ny kontakt og tildel til relevante grupper.", en: "Create a new contact and assign to relevant groups." },
  "contacts.name_required": { no: "Navn *", en: "Name *" },
  "contacts.phone_required": { no: "Telefon *", en: "Phone *" },
  "contacts.group_membership": { no: "Gruppetilhørighet (Routing)", en: "Group membership (Routing)" },
  "contacts.no_groups": { no: "Ingen grupper tilgjengelig", en: "No groups available" },
  "contacts.operational_group": { no: "Operasjonell gruppe", en: "Operational group" },
  "contacts.group_help": { no: "Velg hvilke grupper denne kontakten tilhører. Meldinger fra dette nummeret vil automatisk bli rutet til disse gruppene.", en: "Select which groups this contact belongs to. Messages from this number will be automatically routed to these groups." },
  "contacts.saving": { no: "Lagrer...", en: "Saving..." },
  "contacts.save_changes": { no: "Lagre endringer", en: "Save changes" },
  "contacts.add_contact": { no: "Legg til kontakt", en: "Add contact" },
  
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