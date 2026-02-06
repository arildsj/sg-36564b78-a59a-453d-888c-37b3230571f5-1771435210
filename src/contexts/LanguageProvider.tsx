import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "no" | "en" | "de" | "fr" | "es" | "it" | "pl";

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
    de: string;
    fr: string;
    es: string;
    it: string;
    pl: string;
  };
};

// Translation dictionary
const translations: Translations = {
  // Navigation
  "nav.dashboard": { 
    no: "Dashboard", 
    en: "Dashboard", 
    de: "Dashboard", 
    fr: "Tableau de bord", 
    es: "Panel de control", 
    it: "Dashboard",
    pl: "Panel główny"
  },
  "nav.inbox": { 
    no: "Innboks", 
    en: "Inbox", 
    de: "Posteingang", 
    fr: "Boîte de réception", 
    es: "Bandeja de entrada", 
    it: "Posta in arrivo",
    pl: "Skrzynka odbiorcza"
  },
  "nav.contacts": { 
    no: "Kontakter", 
    en: "Contacts", 
    de: "Kontakte", 
    fr: "Contacts", 
    es: "Contactos", 
    it: "Contatti",
    pl: "Kontakty"
  },
  "nav.send": { 
    no: "Send melding", 
    en: "Send message", 
    de: "Nachricht senden", 
    fr: "Envoyer un message", 
    es: "Enviar mensaje", 
    it: "Invia messaggio",
    pl: "Wyślij wiadomość"
  },
  "nav.campaigns": { 
    no: "Kampanjer", 
    en: "Campaigns", 
    de: "Kampagnen", 
    fr: "Campagnes", 
    es: "Campañas", 
    it: "Campagne",
    pl: "Kampanie"
  },
  "nav.simulate": { 
    no: "Simulering", 
    en: "Simulation", 
    de: "Simulation", 
    fr: "Simulation", 
    es: "Simulación", 
    it: "Simulazione",
    pl: "Symulacja"
  },
  "nav.admin": { 
    no: "Administrasjon", 
    en: "Administration", 
    de: "Verwaltung", 
    fr: "Administration", 
    es: "Administración", 
    it: "Amministrazione",
    pl: "Administracja"
  },
  "nav.settings": { 
    no: "Innstillinger", 
    en: "Settings", 
    de: "Einstellungen", 
    fr: "Paramètres", 
    es: "Configuración", 
    it: "Impostazioni",
    pl: "Ustawienia"
  },
  "nav.logout": { 
    no: "Logg ut", 
    en: "Log out", 
    de: "Abmelden", 
    fr: "Se déconnecter", 
    es: "Cerrar sesión", 
    it: "Disconnetti",
    pl: "Wyloguj"
  },
  
  // Theme
  "theme.light": { 
    no: "Light", 
    en: "Light", 
    de: "Hell", 
    fr: "Clair", 
    es: "Claro", 
    it: "Chiaro",
    pl: "Jasny"
  },
  "theme.dark": { 
    no: "Dark", 
    en: "Dark", 
    de: "Dunkel", 
    fr: "Sombre", 
    es: "Oscuro", 
    it: "Scuro",
    pl: "Ciemny"
  },
  "theme.system": { 
    no: "System", 
    en: "System", 
    de: "System", 
    fr: "Système", 
    es: "Sistema", 
    it: "Sistema",
    pl: "System"
  },
  "theme.toggle": { 
    no: "Bytt tema", 
    en: "Toggle theme", 
    de: "Design wechseln", 
    fr: "Changer le thème", 
    es: "Cambiar tema", 
    it: "Cambia tema",
    pl: "Przełącz motyw"
  },
  
  // Common
  "common.loading": { 
    no: "Laster...", 
    en: "Loading...", 
    de: "Laden...", 
    fr: "Chargement...", 
    es: "Cargando...", 
    it: "Caricamento...",
    pl: "Ładowanie..."
  },
  "common.save": { 
    no: "Lagre", 
    en: "Save", 
    de: "Speichern", 
    fr: "Enregistrer", 
    es: "Guardar", 
    it: "Salva",
    pl: "Zapisz"
  },
  "common.cancel": { 
    no: "Avbryt", 
    en: "Cancel", 
    de: "Abbrechen", 
    fr: "Annuler", 
    es: "Cancelar", 
    it: "Annulla",
    pl: "Anuluj"
  },
  "common.delete": { 
    no: "Slett", 
    en: "Delete", 
    de: "Löschen", 
    fr: "Supprimer", 
    es: "Eliminar", 
    it: "Elimina",
    pl: "Usuń"
  },
  "common.edit": { 
    no: "Rediger", 
    en: "Edit", 
    de: "Bearbeiten", 
    fr: "Modifier", 
    es: "Editar", 
    it: "Modifica",
    pl: "Edytuj"
  },
  "common.close": { 
    no: "Lukk", 
    en: "Close", 
    de: "Schließen", 
    fr: "Fermer", 
    es: "Cerrar", 
    it: "Chiudi",
    pl: "Zamknij"
  },
  "common.search": { 
    no: "Søk", 
    en: "Search", 
    de: "Suchen", 
    fr: "Rechercher", 
    es: "Buscar", 
    it: "Cerca",
    pl: "Szukaj"
  },
  
  // Dashboard
  "dashboard.title": { 
    no: "Dashboard", 
    en: "Dashboard", 
    de: "Dashboard", 
    fr: "Tableau de bord", 
    es: "Panel de control", 
    it: "Dashboard",
    pl: "Panel główny"
  },
  "dashboard.description": { 
    no: "Oversikt over meldinger og operasjoner", 
    en: "Overview of messages and operations", 
    de: "Übersicht über Nachrichten und Operationen", 
    fr: "Aperçu des messages et opérations", 
    es: "Resumen de mensajes y operaciones", 
    it: "Panoramica di messaggi e operazioni",
    pl: "Przegląd wiadomości i operacji"
  },
  "dashboard.unhandled_messages": { 
    no: "Ubehandlede meldinger", 
    en: "Unhandled messages", 
    de: "Unbearbeitete Nachrichten", 
    fr: "Messages non traités", 
    es: "Mensajes sin manejar", 
    it: "Messaggi non gestiti",
    pl: "Nieobsłużone wiadomości"
  },
  "dashboard.awaiting_confirmation": { 
    no: "Venter på bekreftelse", 
    en: "Awaiting confirmation", 
    de: "Warten auf Bestätigung", 
    fr: "En attente de confirmation", 
    es: "Esperando confirmación", 
    it: "In attesa di conferma",
    pl: "Oczekiwanie na potwierdzenie"
  },
  "dashboard.operational_groups": { 
    no: "Operative grupper", 
    en: "Operational groups", 
    de: "Operative Gruppen", 
    fr: "Groupes opérationnels", 
    es: "Grupos operativos", 
    it: "Gruppi operativi",
    pl: "Grupy operacyjne"
  },
  "dashboard.active_inboxes": { 
    no: "Aktive innbokser", 
    en: "Active inboxes", 
    de: "Aktive Posteingänge", 
    fr: "Boîtes actives", 
    es: "Bandejas activas", 
    it: "Caselle attive",
    pl: "Aktywne skrzynki"
  },
  "dashboard.on_duty_users": { 
    no: "On-duty brukere", 
    en: "On-duty users", 
    de: "Diensthabende Benutzer", 
    fr: "Utilisateurs de garde", 
    es: "Usuarios de guardia", 
    it: "Utenti di turno",
    pl: "Użytkownicy na dyżurze"
  },
  "dashboard.active_operators": { 
    no: "Aktive operatører", 
    en: "Active operators", 
    de: "Aktive Betreiber", 
    fr: "Opérateurs actifs", 
    es: "Operadores activos", 
    it: "Operatori attivi",
    pl: "Aktywni operatorzy"
  },
  "dashboard.avg_response_time": { 
    no: "Gjennomsnittlig svartid", 
    en: "Average response time", 
    de: "Durchschnittliche Antwortzeit", 
    fr: "Temps de réponse moyen", 
    es: "Tiempo de respuesta promedio", 
    it: "Tempo medio di risposta",
    pl: "Średni czas odpowiedzi"
  },
  "dashboard.last_24h": { 
    no: "Siste 24 timer", 
    en: "Last 24 hours", 
    de: "Letzte 24 Stunden", 
    fr: "Dernières 24 heures", 
    es: "Últimas 24 horas", 
    it: "Ultime 24 ore",
    pl: "Ostatnie 24 godziny"
  },
  "dashboard.recent_messages": { 
    no: "Siste meldinger", 
    en: "Recent messages", 
    de: "Neueste Nachrichten", 
    fr: "Messages récents", 
    es: "Mensajes recientes", 
    it: "Messaggi recenti",
    pl: "Ostatnie wiadomości"
  },
  "dashboard.newest_inbound": { 
    no: "Nyeste inngående meldinger på tvers av grupper", 
    en: "Newest inbound messages across groups", 
    de: "Neueste eingehende Nachrichten gruppenübergreifend", 
    fr: "Derniers messages entrants dans tous les groupes", 
    es: "Mensajes entrantes más recientes en todos los grupos", 
    it: "Messaggi in arrivo più recenti in tutti i gruppi",
    pl: "Najnowsze wiadomości przychodzące we wszystkich grupach"
  },
  "dashboard.no_messages": { 
    no: "Ingen meldinger ennå", 
    en: "No messages yet", 
    de: "Noch keine Nachrichten", 
    fr: "Aucun message pour le moment", 
    es: "No hay mensajes aún", 
    it: "Nessun messaggio ancora",
    pl: "Brak wiadomości"
  },
  "dashboard.see_all_messages": { 
    no: "Se alle meldinger", 
    en: "See all messages", 
    de: "Alle Nachrichten anzeigen", 
    fr: "Voir tous les messages", 
    es: "Ver todos los mensajes", 
    it: "Vedi tutti i messaggi",
    pl: "Zobacz wszystkie wiadomości"
  },
  "dashboard.duty_status": { 
    no: "Vakt-status", 
    en: "Duty status", 
    de: "Dienststatus", 
    fr: "État de service", 
    es: "Estado de guardia", 
    it: "Stato di servizio",
    pl: "Status dyżuru"
  },
  "dashboard.on_duty_coverage": { 
    no: "Oversikt over on-duty dekning per gruppe", 
    en: "Overview of on-duty coverage per group", 
    de: "Übersicht über Dienstabdeckung pro Gruppe", 
    fr: "Aperçu de la couverture de garde par groupe", 
    es: "Resumen de cobertura de guardia por grupo", 
    it: "Panoramica della copertura di turno per gruppo",
    pl: "Przegląd pokrycia dyżurów według grup"
  },
  "dashboard.no_operational_groups": { 
    no: "Ingen operative grupper opprettet", 
    en: "No operational groups created", 
    de: "Keine operativen Gruppen erstellt", 
    fr: "Aucun groupe opérationnel créé", 
    es: "No se han creado grupos operativos", 
    it: "Nessun gruppo operativo creato",
    pl: "Nie utworzono grup operacyjnych"
  },
  "dashboard.create_first_group": { 
    no: "Opprett første gruppe", 
    en: "Create first group", 
    de: "Erste Gruppe erstellen", 
    fr: "Créer le premier groupe", 
    es: "Crear primer grupo", 
    it: "Crea primo gruppo",
    pl: "Utwórz pierwszą grupę"
  },
  "dashboard.manage_groups": { 
    no: "Administrer grupper", 
    en: "Manage groups", 
    de: "Gruppen verwalten", 
    fr: "Gérer les groupes", 
    es: "Administrar grupos", 
    it: "Gestisci gruppi",
    pl: "Zarządzaj grupami"
  },
  "dashboard.on_duty": { 
    no: "on-duty", 
    en: "on-duty", 
    de: "im Dienst", 
    fr: "de garde", 
    es: "de guardia", 
    it: "di turno",
    pl: "na dyżurze"
  },
  "dashboard.open": { 
    no: "Åpen", 
    en: "Open", 
    de: "Offen", 
    fr: "Ouvert", 
    es: "Abierto", 
    it: "Aperto",
    pl: "Otwarte"
  },
  "dashboard.closed": { 
    no: "Stengt", 
    en: "Closed", 
    de: "Geschlossen", 
    fr: "Fermé", 
    es: "Cerrado", 
    it: "Chiuso",
    pl: "Zamknięte"
  },
  
  // Inbox/Conversations
  "inbox.title": { 
    no: "Samtaler", 
    en: "Conversations", 
    de: "Unterhaltungen", 
    fr: "Conversations", 
    es: "Conversaciones", 
    it: "Conversazioni",
    pl: "Rozmowy"
  },
  "inbox.description": { 
    no: "Håndter meldinger fra dine grupper.", 
    en: "Manage messages from your groups.", 
    de: "Verwalten Sie Nachrichten aus Ihren Gruppen.", 
    fr: "Gérez les messages de vos groupes.", 
    es: "Gestionar mensajes de sus grupos.", 
    it: "Gestisci i messaggi dai tuoi gruppi.",
    pl: "Zarządzaj wiadomościami z grup."
  },
  "inbox.all_conversations": { 
    no: "Alle samtaler", 
    en: "All conversations", 
    de: "Alle Unterhaltungen", 
    fr: "Toutes les conversations", 
    es: "Todas las conversaciones", 
    it: "Tutte le conversazioni",
    pl: "Wszystkie rozmowy"
  },
  "inbox.unknown_senders": { 
    no: "Ukjente avsendere", 
    en: "Unknown senders", 
    de: "Unbekannte Absender", 
    fr: "Expéditeurs inconnus", 
    es: "Remitentes desconocidos", 
    it: "Mittenti sconosciuti",
    pl: "Nieznani nadawcy"
  },
  "inbox.escalated": { 
    no: "Eskalerte", 
    en: "Escalated", 
    de: "Eskaliert", 
    fr: "Escaladés", 
    es: "Escalados", 
    it: "Escalati",
    pl: "Eskalowane"
  },
  "inbox.filter_by_group": { 
    no: "Filtrer etter gruppe", 
    en: "Filter by group", 
    de: "Nach Gruppe filtern", 
    fr: "Filtrer par groupe", 
    es: "Filtrar por grupo", 
    it: "Filtra per gruppo",
    pl: "Filtruj według grupy"
  },
  "inbox.all_groups": { 
    no: "Alle grupper", 
    en: "All groups", 
    de: "Alle Gruppen", 
    fr: "Tous les groupes", 
    es: "Todos los grupos", 
    it: "Tutti i gruppi",
    pl: "Wszystkie grupy"
  },
  "inbox.conversations_count": { 
    no: "Samtaler", 
    en: "Conversations", 
    de: "Unterhaltungen", 
    fr: "Conversations", 
    es: "Conversaciones", 
    it: "Conversazioni",
    pl: "Rozmowy"
  },
  "inbox.no_conversations": { 
    no: "Ingen samtaler", 
    en: "No conversations", 
    de: "Keine Unterhaltungen", 
    fr: "Aucune conversation", 
    es: "No hay conversaciones", 
    it: "Nessuna conversazione",
    pl: "Brak rozmów"
  },
  "inbox.no_unknown": { 
    no: "Ingen ukjente avsendere for øyeblikket", 
    en: "No unknown senders at the moment", 
    de: "Derzeit keine unbekannten Absender", 
    fr: "Aucun expéditeur inconnu pour le moment", 
    es: "No hay remitentes desconocidos en este momento", 
    it: "Nessun mittente sconosciuto al momento",
    pl: "Brak nieznanych nadawców"
  },
  "inbox.no_escalated": { 
    no: "Ingen eskalerte meldinger", 
    en: "No escalated messages", 
    de: "Keine eskalierten Nachrichten", 
    fr: "Aucun message escaladé", 
    es: "No hay mensajes escalados", 
    it: "Nessun messaggio escalato",
    pl: "Brak eskalowanych wiadomości"
  },
  "inbox.messages_appear": { 
    no: "Meldinger vil vises her når de ankommer", 
    en: "Messages will appear here when they arrive", 
    de: "Nachrichten werden hier angezeigt, wenn sie eintreffen", 
    fr: "Les messages apparaîtront ici à leur arrivée", 
    es: "Los mensajes aparecerán aquí cuando lleguen", 
    it: "I messaggi appariranno qui quando arrivano",
    pl: "Wiadomości pojawią się tutaj po otrzymaniu"
  },
  "inbox.no_found": { 
    no: "Ingen samtaler funnet", 
    en: "No conversations found", 
    de: "Keine Unterhaltungen gefunden", 
    fr: "Aucune conversation trouvée", 
    es: "No se encontraron conversaciones", 
    it: "Nessuna conversazione trovata",
    pl: "Nie znaleziono rozmów"
  },
  "inbox.bulk": { 
    no: "Bulk", 
    en: "Bulk", 
    de: "Massen", 
    fr: "Groupé", 
    es: "Masivo", 
    it: "Massa",
    pl: "Masowe"
  },
  "inbox.responses": { 
    no: "svar", 
    en: "responses", 
    de: "Antworten", 
    fr: "réponses", 
    es: "respuestas", 
    it: "risposte",
    pl: "odpowiedzi"
  },
  "inbox.unknown": { 
    no: "Ukjent", 
    en: "Unknown", 
    de: "Unbekannt", 
    fr: "Inconnu", 
    es: "Desconocido", 
    it: "Sconosciuto",
    pl: "Nieznany"
  },
  "inbox.select_conversation": { 
    no: "Velg en samtale", 
    en: "Select a conversation", 
    de: "Wählen Sie eine Unterhaltung", 
    fr: "Sélectionnez une conversation", 
    es: "Seleccionar una conversación", 
    it: "Seleziona una conversazione",
    pl: "Wybierz rozmowę"
  },
  "inbox.select_help": { 
    no: "Velg en samtale fra listen til venstre for å se meldingshistorikk og svare.", 
    en: "Select a conversation from the list on the left to view message history and reply.", 
    de: "Wählen Sie eine Unterhaltung aus der Liste links, um den Nachrichtenverlauf anzuzeigen und zu antworten.", 
    fr: "Sélectionnez une conversation dans la liste de gauche pour voir l'historique et répondre.", 
    es: "Seleccione una conversación de la lista de la izquierda para ver el historial y responder.", 
    it: "Seleziona una conversazione dall'elenco a sinistra per visualizzare la cronologia e rispondere.",
    pl: "Wybierz rozmowę z listy po lewej, aby zobaczyć historię i odpowiedzieć."
  },
  "inbox.resolve": { 
    no: "Løs", 
    en: "Resolve", 
    de: "Lösen", 
    fr: "Résoudre", 
    es: "Resolver", 
    it: "Risolvi",
    pl: "Rozwiąż"
  },
  "inbox.move": { 
    no: "Flytt", 
    en: "Move", 
    de: "Verschieben", 
    fr: "Déplacer", 
    es: "Mover", 
    it: "Sposta",
    pl: "Przenieś"
  },
  "inbox.write_reply": { 
    no: "Skriv et svar...", 
    en: "Write a reply...", 
    de: "Antwort schreiben...", 
    fr: "Écrire une réponse...", 
    es: "Escribir una respuesta...", 
    it: "Scrivi una risposta...",
    pl: "Napisz odpowiedź..."
  },
  "inbox.loading_messages": { 
    no: "Laster meldinger...", 
    en: "Loading messages...", 
    de: "Nachrichten werden geladen...", 
    fr: "Chargement des messages...", 
    es: "Cargando mensajes...", 
    it: "Caricamento messaggi...",
    pl: "Ładowanie wiadomości..."
  },
  "inbox.no_messages_thread": { 
    no: "Ingen meldinger i denne tråden", 
    en: "No messages in this thread", 
    de: "Keine Nachrichten in diesem Thread", 
    fr: "Aucun message dans ce fil", 
    es: "No hay mensajes en este hilo", 
    it: "Nessun messaggio in questa discussione",
    pl: "Brak wiadomości w tym wątku"
  },
  "inbox.you": { 
    no: "Du", 
    en: "You", 
    de: "Sie", 
    fr: "Vous", 
    es: "Tú", 
    it: "Tu",
    pl: "Ty"
  },
  
  // Contacts
  "contacts.title": { 
    no: "Kontakter", 
    en: "Contacts", 
    de: "Kontakte", 
    fr: "Contacts", 
    es: "Contactos", 
    it: "Contatti",
    pl: "Kontakty"
  },
  "contacts.description": { 
    no: "Administrer kontakter og søk i historikk", 
    en: "Manage contacts and search history", 
    de: "Kontakte verwalten und Verlauf durchsuchen", 
    fr: "Gérer les contacts et rechercher l'historique", 
    es: "Administrar contactos y buscar historial", 
    it: "Gestisci contatti e cerca cronologia",
    pl: "Zarządzaj kontaktami i przeszukuj historię"
  },
  "contacts.new_contact": { 
    no: "Ny kontakt", 
    en: "New contact", 
    de: "Neuer Kontakt", 
    fr: "Nouveau contact", 
    es: "Nuevo contacto", 
    it: "Nuovo contatto",
    pl: "Nowy kontakt"
  },
  "contacts.search_filter": { 
    no: "Søk og filtrer", 
    en: "Search and filter", 
    de: "Suchen und filtern", 
    fr: "Rechercher et filtrer", 
    es: "Buscar y filtrar", 
    it: "Cerca e filtra",
    pl: "Szukaj i filtruj"
  },
  "contacts.search_placeholder": { 
    no: "Søk etter navn eller telefonnummer...", 
    en: "Search by name or phone number...", 
    de: "Nach Name oder Telefonnummer suchen...", 
    fr: "Rechercher par nom ou numéro de téléphone...", 
    es: "Buscar por nombre o número de teléfono...", 
    it: "Cerca per nome o numero di telefono...",
    pl: "Szukaj według nazwy lub numeru telefonu..."
  },
  "contacts.count": { 
    no: "kontakter", 
    en: "contacts", 
    de: "Kontakte", 
    fr: "contacts", 
    es: "contactos", 
    it: "contatti",
    pl: "kontakty"
  },
  "contacts.no_found": { 
    no: "Ingen kontakter funnet", 
    en: "No contacts found", 
    de: "Keine Kontakte gefunden", 
    fr: "Aucun contact trouvé", 
    es: "No se encontraron contactos", 
    it: "Nessun contatto trovato",
    pl: "Nie znaleziono kontaktów"
  },
  "contacts.name": { 
    no: "Navn", 
    en: "Name", 
    de: "Name", 
    fr: "Nom", 
    es: "Nombre", 
    it: "Nome",
    pl: "Nazwa"
  },
  "contacts.phone": { 
    no: "Telefon", 
    en: "Phone", 
    de: "Telefon", 
    fr: "Téléphone", 
    es: "Teléfono", 
    it: "Telefono",
    pl: "Telefon"
  },
  "contacts.email": { 
    no: "E-post", 
    en: "Email", 
    de: "E-Mail", 
    fr: "E-mail", 
    es: "Correo electrónico", 
    it: "Email",
    pl: "E-mail"
  },
  "contacts.groups": { 
    no: "Grupper", 
    en: "Groups", 
    de: "Gruppen", 
    fr: "Groupes", 
    es: "Grupos", 
    it: "Gruppi",
    pl: "Grupy"
  },
  "contacts.created": { 
    no: "Opprettet", 
    en: "Created", 
    de: "Erstellt", 
    fr: "Créé", 
    es: "Creado", 
    it: "Creato",
    pl: "Utworzono"
  },
  "contacts.actions": { 
    no: "Handlinger", 
    en: "Actions", 
    de: "Aktionen", 
    fr: "Actions", 
    es: "Acciones", 
    it: "Azioni",
    pl: "Akcje"
  },
  "contacts.edit": { 
    no: "Rediger kontakt", 
    en: "Edit contact", 
    de: "Kontakt bearbeiten", 
    fr: "Modifier le contact", 
    es: "Editar contacto", 
    it: "Modifica contatto",
    pl: "Edytuj kontakt"
  },
  "contacts.add": { 
    no: "Legg til ny kontakt", 
    en: "Add new contact", 
    de: "Neuen Kontakt hinzufügen", 
    fr: "Ajouter un nouveau contact", 
    es: "Añadir nuevo contacto", 
    it: "Aggiungi nuovo contatto",
    pl: "Dodaj nowy kontakt"
  },
  "contacts.update_info": { 
    no: "Oppdater kontaktinformasjon og gruppetilhørighet.", 
    en: "Update contact information and group membership.", 
    de: "Kontaktinformationen und Gruppenzugehörigkeit aktualisieren.", 
    fr: "Mettre à jour les informations de contact et l'appartenance au groupe.", 
    es: "Actualizar información de contacto y pertenencia al grupo.", 
    it: "Aggiorna le informazioni di contatto e l'appartenenza al gruppo.",
    pl: "Zaktualizuj informacje kontaktowe i przynależność do grupy."
  },
  "contacts.create_info": { 
    no: "Opprett en ny kontakt og tildel til relevante grupper.", 
    en: "Create a new contact and assign to relevant groups.", 
    de: "Erstellen Sie einen neuen Kontakt und weisen Sie ihn relevanten Gruppen zu.", 
    fr: "Créer un nouveau contact et l'assigner aux groupes pertinents.", 
    es: "Crear un nuevo contacto y asignarlo a grupos relevantes.", 
    it: "Crea un nuovo contatto e assegnalo ai gruppi pertinenti.",
    pl: "Utwórz nowy kontakt i przypisz do odpowiednich grup."
  },
  "contacts.name_required": { 
    no: "Navn *", 
    en: "Name *", 
    de: "Name *", 
    fr: "Nom *", 
    es: "Nombre *", 
    it: "Nome *",
    pl: "Nazwa *"
  },
  "contacts.phone_required": { 
    no: "Telefon *", 
    en: "Phone *", 
    de: "Telefon *", 
    fr: "Téléphone *", 
    es: "Teléfono *", 
    it: "Telefono *",
    pl: "Telefon *"
  },
  "contacts.group_membership": { 
    no: "Gruppetilhørighet (Routing)", 
    en: "Group membership (Routing)", 
    de: "Gruppenzugehörigkeit (Routing)", 
    fr: "Appartenance au groupe (Routage)", 
    es: "Pertenencia al grupo (Enrutamiento)", 
    it: "Appartenenza al gruppo (Instradamento)",
    pl: "Członkostwo w grupie (Routing)"
  },
  "contacts.no_groups": { 
    no: "Ingen grupper tilgjengelig", 
    en: "No groups available", 
    de: "Keine Gruppen verfügbar", 
    fr: "Aucun groupe disponible", 
    es: "No hay grupos disponibles", 
    it: "Nessun gruppo disponibile",
    pl: "Brak dostępnych grup"
  },
  "contacts.operational_group": { 
    no: "Operasjonell gruppe", 
    en: "Operational group", 
    de: "Operative Gruppe", 
    fr: "Groupe opérationnel", 
    es: "Grupo operativo", 
    it: "Gruppo operativo",
    pl: "Grupa operacyjna"
  },
  "contacts.group_help": { 
    no: "Velg hvilke grupper denne kontakten tilhører. Meldinger fra dette nummeret vil automatisk bli rutet til disse gruppene.", 
    en: "Select which groups this contact belongs to. Messages from this number will be automatically routed to these groups.", 
    de: "Wählen Sie aus, zu welchen Gruppen dieser Kontakt gehört. Nachrichten von dieser Nummer werden automatisch an diese Gruppen weitergeleitet.", 
    fr: "Sélectionnez les groupes auxquels appartient ce contact. Les messages de ce numéro seront automatiquement acheminés vers ces groupes.", 
    es: "Seleccione a qué grupos pertenece este contacto. Los mensajes de este número se enrutarán automáticamente a estos grupos.", 
    it: "Seleziona a quali gruppi appartiene questo contatto. I messaggi da questo numero verranno automaticamente instradati a questi gruppi.",
    pl: "Wybierz grupy, do których należy ten kontakt. Wiadomości z tego numeru zostaną automatycznie przekierowane do tych grup."
  },
  "contacts.saving": { 
    no: "Lagrer...", 
    en: "Saving...", 
    de: "Speichern...", 
    fr: "Enregistrement...", 
    es: "Guardando...", 
    it: "Salvataggio...",
    pl: "Zapisywanie..."
  },
  "contacts.save_changes": { 
    no: "Lagre endringer", 
    en: "Save changes", 
    de: "Änderungen speichern", 
    fr: "Enregistrer les modifications", 
    es: "Guardar cambios", 
    it: "Salva modifiche",
    pl: "Zapisz zmiany"
  },
  "contacts.add_contact": { 
    no: "Legg til kontakt", 
    en: "Add contact", 
    de: "Kontakt hinzufügen", 
    fr: "Ajouter un contact", 
    es: "Añadir contacto", 
    it: "Aggiungi contatto",
    pl: "Dodaj kontakt"
  },
  
  // Login
  "login.title": { 
    no: "Logg inn - SeMSe 2.0", 
    en: "Log in - SeMSe 2.0", 
    de: "Anmelden - SeMSe 2.0", 
    fr: "Se connecter - SeMSe 2.0", 
    es: "Iniciar sesión - SeMSe 2.0", 
    it: "Accedi - SeMSe 2.0",
    pl: "Zaloguj się - SeMSe 2.0"
  },
  "login.description": { 
    no: "Logg inn for å administrere meldinger og operasjoner", 
    en: "Log in to manage messages and operations", 
    de: "Melden Sie sich an, um Nachrichten und Operationen zu verwalten", 
    fr: "Connectez-vous pour gérer les messages et les opérations", 
    es: "Inicie sesión para administrar mensajes y operaciones", 
    it: "Accedi per gestire messaggi e operazioni",
    pl: "Zaloguj się, aby zarządzać wiadomościami i operacjami"
  },
  "login.email": { 
    no: "E-post", 
    en: "Email", 
    de: "E-Mail", 
    fr: "E-mail", 
    es: "Correo electrónico", 
    it: "Email",
    pl: "E-mail"
  },
  "login.password": { 
    no: "Passord", 
    en: "Password", 
    de: "Passwort", 
    fr: "Mot de passe", 
    es: "Contraseña", 
    it: "Password",
    pl: "Hasło"
  },
  "login.button": { 
    no: "Logg inn", 
    en: "Log in", 
    de: "Anmelden", 
    fr: "Se connecter", 
    es: "Iniciar sesión", 
    it: "Accedi",
    pl: "Zaloguj się"
  },
  "login.logging_in": { 
    no: "Logger inn...", 
    en: "Logging in...", 
    de: "Anmeldung...", 
    fr: "Connexion...", 
    es: "Iniciando sesión...", 
    it: "Accesso...",
    pl: "Logowanie..."
  },
  "login.no_account": { 
    no: "Har du ikke en konto? Kom i gang her", 
    en: "Don't have an account? Get started here", 
    de: "Haben Sie kein Konto? Hier starten", 
    fr: "Vous n'avez pas de compte? Commencez ici", 
    es: "¿No tienes una cuenta? Comienza aquí", 
    it: "Non hai un account? Inizia qui",
    pl: "Nie masz konta? Zacznij tutaj"
  },
  "login.forgot_password": { 
    no: "Glemt passord? Kontakt administrator", 
    en: "Forgot password? Contact administrator", 
    de: "Passwort vergessen? Administrator kontaktieren", 
    fr: "Mot de passe oublié? Contactez l'administrateur", 
    es: "¿Olvidaste la contraseña? Contacta al administrador", 
    it: "Password dimenticata? Contatta l'amministratore",
    pl: "Zapomniałeś hasła? Skontaktuj się z administratorem"
  },
  "login.demo": { 
    no: "Demo", 
    en: "Demo", 
    de: "Demo", 
    fr: "Démo", 
    es: "Demo", 
    it: "Demo",
    pl: "Demo"
  },
  
  // Errors
  "error.email_not_confirmed": { 
    no: "E-posten din er ikke bekreftet. Sjekk innboksen din for bekreftelseslenke.", 
    en: "Your email is not confirmed. Check your inbox for confirmation link.", 
    de: "Ihre E-Mail ist nicht bestätigt. Überprüfen Sie Ihren Posteingang auf den Bestätigungslink.", 
    fr: "Votre e-mail n'est pas confirmé. Vérifiez votre boîte de réception pour le lien de confirmation.", 
    es: "Tu correo electrónico no está confirmado. Verifica tu bandeja de entrada para el enlace de confirmación.", 
    it: "La tua email non è confermata. Controlla la tua casella di posta per il link di conferma.",
    pl: "Twój e-mail nie jest potwierdzony. Sprawdź skrzynkę odbiorczą w celu znalezienia linku potwierdzającego."
  },
  "error.invalid_credentials": { 
    no: "Feil e-post eller passord. Prøv igjen.", 
    en: "Invalid email or password. Try again.", 
    de: "Ungültige E-Mail oder Passwort. Versuchen Sie es erneut.", 
    fr: "E-mail ou mot de passe invalide. Réessayez.", 
    es: "Correo electrónico o contraseña inválidos. Intenta de nuevo.", 
    it: "Email o password non validi. Riprova.",
    pl: "Nieprawidłowy e-mail lub hasło. Spróbuj ponownie."
  },
  "error.login_failed": { 
    no: "Pålogging feilet. Prøv igjen.", 
    en: "Login failed. Try again.", 
    de: "Anmeldung fehlgeschlagen. Versuchen Sie es erneut.", 
    fr: "Connexion échouée. Réessayez.", 
    es: "Error de inicio de sesión. Intenta de nuevo.", 
    it: "Accesso fallito. Riprova.",
    pl: "Logowanie nie powiodło się. Spróbuj ponownie."
  },
  "error.unexpected": { 
    no: "En uventet feil oppstod. Prøv igjen.", 
    en: "An unexpected error occurred. Try again.", 
    de: "Ein unerwarteter Fehler ist aufgetreten. Versuchen Sie es erneut.", 
    fr: "Une erreur inattendue s'est produite. Réessayez.", 
    es: "Ocurrió un error inesperado. Intenta de nuevo.", 
    it: "Si è verificato un errore imprevisto. Riprova.",
    pl: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
  },

  // Campaigns
  "campaigns.title": { 
    no: "Kampanjer", 
    en: "Campaigns", 
    de: "Kampagnen", 
    fr: "Campagnes", 
    es: "Campañas", 
    it: "Campagne",
    pl: "Kampanie"
  },
  "campaigns.description": { 
    no: "Oversikt over bulk-utsendelser og responser", 
    en: "Overview of bulk sends and responses", 
    de: "Übersicht über Massenversendungen und Antworten", 
    fr: "Aperçu des envois groupés et réponses", 
    es: "Resumen de envíos masivos y respuestas", 
    it: "Panoramica di invii di massa e risposte",
    pl: "Przegląd masowych wysyłek i odpowiedzi"
  },
  "campaigns.new": { 
    no: "Ny kampanje", 
    en: "New campaign", 
    de: "Neue Kampagne", 
    fr: "Nouvelle campagne", 
    es: "Nueva campaña", 
    it: "Nuova campagna",
    pl: "Nowa kampania"
  },
  "campaigns.no_campaigns": { 
    no: "Ingen kampanjer ennå", 
    en: "No campaigns yet", 
    de: "Noch keine Kampagnen", 
    fr: "Aucune campagne pour le moment", 
    es: "No hay campañas aún", 
    it: "Nessuna campagna ancora",
    pl: "Brak kampanii"
  },
  "campaigns.first_campaign": { 
    no: "Send din første bulk-melding for å komme i gang", 
    en: "Send your first bulk message to get started", 
    de: "Senden Sie Ihre erste Massennachricht, um zu beginnen", 
    fr: "Envoyez votre premier message groupé pour commencer", 
    es: "Envía tu primer mensaje masivo para comenzar", 
    it: "Invia il tuo primo messaggio di massa per iniziare",
    pl: "Wyślij swoją pierwszą wiadomość masową, aby rozpocząć"
  },
  "campaigns.send_bulk": { 
    no: "Send bulk-melding", 
    en: "Send bulk message", 
    de: "Massennachricht senden", 
    fr: "Envoyer un message groupé", 
    es: "Enviar mensaje masivo", 
    it: "Invia messaggio di massa",
    pl: "Wyślij wiadomość masową"
  },
  "campaigns.recipients": { 
    no: "Mottakere", 
    en: "Recipients", 
    de: "Empfänger", 
    fr: "Destinataires", 
    es: "Destinatarios", 
    it: "Destinatari",
    pl: "Odbiorcy"
  },
  "campaigns.sent": { 
    no: "Sendt", 
    en: "Sent", 
    de: "Gesendet", 
    fr: "Envoyé", 
    es: "Enviado", 
    it: "Inviato",
    pl: "Wysłano"
  },
  "campaigns.failed": { 
    no: "Feilet", 
    en: "Failed", 
    de: "Fehlgeschlagen", 
    fr: "Échoué", 
    es: "Fallido", 
    it: "Fallito",
    pl: "Niepowodzenie"
  },
  "campaigns.success": { 
    no: "Suksess", 
    en: "Success", 
    de: "Erfolg", 
    fr: "Succès", 
    es: "Éxito", 
    it: "Successo",
    pl: "Sukces"
  },
  "campaigns.status.draft": { 
    no: "Utkast", 
    en: "Draft", 
    de: "Entwurf", 
    fr: "Brouillon", 
    es: "Borrador", 
    it: "Bozza",
    pl: "Szkic"
  },
  "campaigns.status.scheduled": { 
    no: "Planlagt", 
    en: "Scheduled", 
    de: "Geplant", 
    fr: "Planifié", 
    es: "Programado", 
    it: "Programmato",
    pl: "Zaplanowano"
  },
  "campaigns.status.sending": { 
    no: "Sender", 
    en: "Sending", 
    de: "Sendet", 
    fr: "Envoi en cours", 
    es: "Enviando", 
    it: "Invio in corso",
    pl: "Wysyłanie"
  },
  "campaigns.status.completed": { 
    no: "Fullført", 
    en: "Completed", 
    de: "Abgeschlossen", 
    fr: "Terminé", 
    es: "Completado", 
    it: "Completato",
    pl: "Ukończono"
  },
  "campaigns.status.failed": { 
    no: "Feilet", 
    en: "Failed", 
    de: "Fehlgeschlagen", 
    fr: "Échoué", 
    es: "Fallido", 
    it: "Fallito",
    pl: "Niepowodzenie"
  },
  "campaigns.message_sent": { 
    no: "Melding sendt", 
    en: "Message sent", 
    de: "Nachricht gesendet", 
    fr: "Message envoyé", 
    es: "Mensaje enviado", 
    it: "Messaggio inviato",
    pl: "Wiadomość wysłana"
  },
  "campaigns.responses_coming": { 
    no: "Respons-visning kommer i neste steg...", 
    en: "Response view coming in next step...", 
    de: "Antwortansicht kommt im nächsten Schritt...", 
    fr: "Vue des réponses à venir dans la prochaine étape...", 
    es: "Vista de respuestas próximamente...", 
    it: "Vista risposte in arrivo nel prossimo passaggio...",
    pl: "Widok odpowiedzi wkrótce..."
  },

  // Admin
  "admin.title": { 
    no: "Administrasjon", 
    en: "Administration", 
    de: "Verwaltung", 
    fr: "Administration", 
    es: "Administración", 
    it: "Amministrazione",
    pl: "Administracja"
  },
  "admin.description": { 
    no: "Administrer brukere, grupper, gateways og systeminnstillinger.", 
    en: "Manage users, groups, gateways and system settings.", 
    de: "Benutzer, Gruppen, Gateways und Systemeinstellungen verwalten.", 
    fr: "Gérer les utilisateurs, groupes, passerelles et paramètres système.", 
    es: "Administrar usuarios, grupos, pasarelas y configuración del sistema.", 
    it: "Gestisci utenti, gruppi, gateway e impostazioni di sistema.",
    pl: "Zarządzaj użytkownikami, grupami, bramkami i ustawieniami systemu."
  },
  "admin.create_group": { 
    no: "Opprett ny gruppe", 
    en: "Create new group", 
    de: "Neue Gruppe erstellen", 
    fr: "Créer un nouveau groupe", 
    es: "Crear nuevo grupo", 
    it: "Crea nuovo gruppo",
    pl: "Utwórz nową grupę"
  },
  "admin.new_group": { 
    no: "Ny gruppe", 
    en: "New group", 
    de: "Neue Gruppe", 
    fr: "Nouveau groupe", 
    es: "Nuevo grupo", 
    it: "Nuovo gruppo",
    pl: "Nowa grupa"
  },
  "admin.new_user": { 
    no: "Ny bruker", 
    en: "New user", 
    de: "Neuer Benutzer", 
    fr: "Nouvel utilisateur", 
    es: "Nuevo usuario", 
    it: "Nuovo utente",
    pl: "Nowy użytkownik"
  },
  "admin.tabs.groups": { 
    no: "Grupper", 
    en: "Groups", 
    de: "Gruppen", 
    fr: "Groupes", 
    es: "Grupos", 
    it: "Gruppi",
    pl: "Grupy"
  },
  "admin.tabs.users": { 
    no: "Brukere", 
    en: "Users", 
    de: "Benutzer", 
    fr: "Utilisateurs", 
    es: "Usuarios", 
    it: "Utenti",
    pl: "Użytkownicy"
  },
  "admin.tabs.gateways": { 
    no: "Gateways", 
    en: "Gateways", 
    de: "Gateways", 
    fr: "Passerelles", 
    es: "Pasarelas", 
    it: "Gateway",
    pl: "Bramki"
  },
  "admin.on_duty": { 
    no: "På vakt", 
    en: "On duty", 
    de: "Im Dienst", 
    fr: "De garde", 
    es: "De guardia", 
    it: "Di turno",
    pl: "Na dyżurze"
  },
  "admin.total": { 
    no: "Totalt", 
    en: "Total", 
    de: "Gesamt", 
    fr: "Total", 
    es: "Total", 
    it: "Totale",
    pl: "Łącznie"
  },
  "admin.parent": { 
    no: "Overordnet", 
    en: "Parent", 
    de: "Übergeordnet", 
    fr: "Parent", 
    es: "Principal", 
    it: "Genitore",
    pl: "Nadrzędny"
  },
  "admin.actions": { 
    no: "Handlinger", 
    en: "Actions", 
    de: "Aktionen", 
    fr: "Actions", 
    es: "Acciones", 
    it: "Azioni",
    pl: "Akcje"
  },
  "admin.no_groups": { 
    no: "Ingen grupper opprettet ennå", 
    en: "No groups created yet", 
    de: "Noch keine Gruppen erstellt", 
    fr: "Aucun groupe créé pour le moment", 
    es: "No se han creado grupos aún", 
    it: "Nessun gruppo creato ancora",
    pl: "Nie utworzono jeszcze grup"
  },
  "admin.loading_groups": { 
    no: "Laster grupper...", 
    en: "Loading groups...", 
    de: "Gruppen werden geladen...", 
    fr: "Chargement des groupes...", 
    es: "Cargando grupos...", 
    it: "Caricamento gruppi...",
    pl: "Ładowanie grup..."
  },
  "admin.role": { 
    no: "Rolle", 
    en: "Role", 
    de: "Rolle", 
    fr: "Rôle", 
    es: "Rol", 
    it: "Ruolo",
    pl: "Rola"
  },
  "admin.status": { 
    no: "Status", 
    en: "Status", 
    de: "Status", 
    fr: "Statut", 
    es: "Estado", 
    it: "Stato",
    pl: "Status"
  },
  "admin.no_users": { 
    no: "Ingen brukere funnet", 
    en: "No users found", 
    de: "Keine Benutzer gefunden", 
    fr: "Aucun utilisateur trouvé", 
    es: "No se encontraron usuarios", 
    it: "Nessun utente trovato",
    pl: "Nie znaleziono użytkowników"
  },
  "admin.loading_users": { 
    no: "Laster brukere...", 
    en: "Loading users...", 
    de: "Benutzer werden geladen...", 
    fr: "Chargement des utilisateurs...", 
    es: "Cargando usuarios...", 
    it: "Caricamento utenti...",
    pl: "Ładowanie użytkowników..."
  },
  "admin.manage_groups": { 
    no: "Administrer grupper", 
    en: "Manage groups", 
    de: "Gruppen verwalten", 
    fr: "Gérer les groupes", 
    es: "Administrar grupos", 
    it: "Gestisci gruppi",
    pl: "Zarządzaj grupami"
  },
  "admin.active_user": { 
    no: "Aktiv bruker (Demo)", 
    en: "Active user (Demo)", 
    de: "Aktiver Benutzer (Demo)", 
    fr: "Utilisateur actif (Démo)", 
    es: "Usuario activo (Demo)", 
    it: "Utente attivo (Demo)",
    pl: "Aktywny użytkownik (Demo)"
  },
  "admin.demo_mode": { 
    no: "Demo-modus aktivert", 
    en: "Demo mode activated", 
    de: "Demo-Modus aktiviert", 
    fr: "Mode démo activé", 
    es: "Modo demo activado", 
    it: "Modalità demo attivata",
    pl: "Tryb demo aktywowany"
  },
  "admin.demo_description": { 
    no: "Du viser systemet som", 
    en: "You are viewing the system as", 
    de: "Sie sehen das System als", 
    fr: "Vous visualisez le système en tant que", 
    es: "Estás viendo el sistema como", 
    it: "Stai visualizzando il sistema come",
    pl: "Przeglądasz system jako"
  },
  "admin.exit_demo": { 
    no: "Gå tilbake til", 
    en: "Return to", 
    de: "Zurück zu", 
    fr: "Retour à", 
    es: "Volver a", 
    it: "Torna a",
    pl: "Powrót do"
  },
  "admin.role.tenant_admin": { 
    no: "Tenant-admin", 
    en: "Tenant admin", 
    de: "Tenant-Administrator", 
    fr: "Administrateur locataire", 
    es: "Administrador de inquilino", 
    it: "Amministratore tenant",
    pl: "Administrator najemcy"
  },
  "admin.role.group_admin": { 
    no: "Gruppe-admin", 
    en: "Group admin", 
    de: "Gruppenadministrator", 
    fr: "Administrateur de groupe", 
    es: "Administrador de grupo", 
    it: "Amministratore gruppo",
    pl: "Administrator grupy"
  },
  "admin.role.member": { 
    no: "Medlem", 
    en: "Member", 
    de: "Mitglied", 
    fr: "Membre", 
    es: "Miembro", 
    it: "Membro",
    pl: "Członek"
  },

  // Settings
  "settings.title": { 
    no: "Innstillinger", 
    en: "Settings", 
    de: "Einstellungen", 
    fr: "Paramètres", 
    es: "Configuración", 
    it: "Impostazioni",
    pl: "Ustawienia"
  },
  "settings.description": { 
    no: "Konfigurer åpningstider, automatiske svar og varslinger for dine grupper.", 
    en: "Configure opening hours, automatic replies and notifications for your groups.", 
    de: "Konfigurieren Sie Öffnungszeiten, automatische Antworten und Benachrichtigungen für Ihre Gruppen.", 
    fr: "Configurez les heures d'ouverture, réponses automatiques et notifications pour vos groupes.", 
    es: "Configure horarios de apertura, respuestas automáticas y notificaciones para sus grupos.", 
    it: "Configura orari di apertura, risposte automatiche e notifiche per i tuoi gruppi.",
    pl: "Skonfiguruj godziny otwarcia, automatyczne odpowiedzi i powiadomienia dla swoich grup."
  },
  "settings.tabs.hours": { 
    no: "Åpningstider", 
    en: "Opening hours", 
    de: "Öffnungszeiten", 
    fr: "Heures d'ouverture", 
    es: "Horarios de apertura", 
    it: "Orari di apertura",
    pl: "Godziny otwarcia"
  },
  "settings.tabs.replies": { 
    no: "Auto-svar", 
    en: "Auto-replies", 
    de: "Automatische Antworten", 
    fr: "Réponses automatiques", 
    es: "Respuestas automáticas", 
    it: "Risposte automatiche",
    pl: "Automatyczne odpowiedzi"
  },
  "settings.tabs.notifications": { 
    no: "Varsler", 
    en: "Notifications", 
    de: "Benachrichtigungen", 
    fr: "Notifications", 
    es: "Notificaciones", 
    it: "Notifiche",
    pl: "Powiadomienia"
  },
  "settings.tabs.routing": { 
    no: "Routing", 
    en: "Routing", 
    de: "Routing", 
    fr: "Routage", 
    es: "Enrutamiento", 
    it: "Instradamento",
    pl: "Routing"
  },
  "settings.select_group": { 
    no: "Velg gruppe", 
    en: "Select group", 
    de: "Gruppe wählen", 
    fr: "Sélectionner un groupe", 
    es: "Seleccionar grupo", 
    it: "Seleziona gruppo",
    pl: "Wybierz grupę"
  },
  "settings.weekly_schedule": { 
    no: "Ukentlig timeplan", 
    en: "Weekly schedule", 
    de: "Wochenplan", 
    fr: "Horaire hebdomadaire", 
    es: "Horario semanal", 
    it: "Programma settimanale",
    pl: "Harmonogram tygodniowy"
  },
  "settings.from": { 
    no: "Fra", 
    en: "From", 
    de: "Von", 
    fr: "De", 
    es: "Desde", 
    it: "Da",
    pl: "Od"
  },
  "settings.to": { 
    no: "Til", 
    en: "To", 
    de: "Bis", 
    fr: "À", 
    es: "Hasta", 
    it: "A",
    pl: "Do"
  },
  "settings.open": { 
    no: "Åpen", 
    en: "Open", 
    de: "Offen", 
    fr: "Ouvert", 
    es: "Abierto", 
    it: "Aperto",
    pl: "Otwarte"
  },
  "settings.save": { 
    no: "Lagre", 
    en: "Save", 
    de: "Speichern", 
    fr: "Enregistrer", 
    es: "Guardar", 
    it: "Salva",
    pl: "Zapisz"
  },
  "settings.save_hours": { 
    no: "Lagre åpningstider", 
    en: "Save opening hours", 
    de: "Öffnungszeiten speichern", 
    fr: "Enregistrer les heures d'ouverture", 
    es: "Guardar horarios", 
    it: "Salva orari",
    pl: "Zapisz godziny otwarcia"
  },
  "settings.save_replies": { 
    no: "Lagre auto-svar", 
    en: "Save auto-replies", 
    de: "Automatische Antworten speichern", 
    fr: "Enregistrer les réponses automatiques", 
    es: "Guardar respuestas automáticas", 
    it: "Salva risposte automatiche",
    pl: "Zapisz automatyczne odpowiedzi"
  },
  "settings.save_settings": { 
    no: "Lagre innstillinger", 
    en: "Save settings", 
    de: "Einstellungen speichern", 
    fr: "Enregistrer les paramètres", 
    es: "Guardar configuración", 
    it: "Salva impostazioni",
    pl: "Zapisz ustawienia"
  },
  "settings.special_days": { 
    no: "Spesielle dager (unntak)", 
    en: "Special days (exceptions)", 
    de: "Besondere Tage (Ausnahmen)", 
    fr: "Jours spéciaux (exceptions)", 
    es: "Días especiales (excepciones)", 
    it: "Giorni speciali (eccezioni)",
    pl: "Dni specjalne (wyjątki)"
  },
  "settings.special_days_help": { 
    no: "Legg til helligdager eller andre spesielle datoer hvor åpningstidene avviker.", 
    en: "Add holidays or other special dates where opening hours differ.", 
    de: "Fügen Sie Feiertage oder andere besondere Daten hinzu, an denen die Öffnungszeiten abweichen.", 
    fr: "Ajoutez des jours fériés ou autres dates spéciales où les heures d'ouverture diffèrent.", 
    es: "Agregue días festivos u otras fechas especiales donde los horarios difieren.", 
    it: "Aggiungi festività o altre date speciali dove gli orari differiscono.",
    pl: "Dodaj święta lub inne specjalne daty, w których godziny otwarcia są inne."
  },
  "settings.add_exception": { 
    no: "Legg til unntak", 
    en: "Add exception", 
    de: "Ausnahme hinzufügen", 
    fr: "Ajouter une exception", 
    es: "Añadir excepción", 
    it: "Aggiungi eccezione",
    pl: "Dodaj wyjątek"
  },
  "settings.outside_hours": { 
    no: "Utenfor åpningstid", 
    en: "Outside opening hours", 
    de: "Außerhalb der Öffnungszeiten", 
    fr: "Hors heures d'ouverture", 
    es: "Fuera de horario", 
    it: "Fuori orario",
    pl: "Poza godzinami otwarcia"
  },
  "settings.outside_hours_help": { 
    no: "Send automatisk melding når vi er stengt.", 
    en: "Send automatic message when we are closed.", 
    de: "Automatische Nachricht senden, wenn wir geschlossen sind.", 
    fr: "Envoyer un message automatique lorsque nous sommes fermés.", 
    es: "Enviar mensaje automático cuando estamos cerrados.", 
    it: "Invia messaggio automatico quando siamo chiusi.",
    pl: "Wyślij automatyczną wiadomość, gdy jesteśmy zamknięci."
  },
  "settings.first_message": { 
    no: "Første melding", 
    en: "First message", 
    de: "Erste Nachricht", 
    fr: "Premier message", 
    es: "Primer mensaje", 
    it: "Primo messaggio",
    pl: "Pierwsza wiadomość"
  },
  "settings.first_message_help": { 
    no: "Send velkomstmelding til nye kontakter.", 
    en: "Send welcome message to new contacts.", 
    de: "Willkommensnachricht an neue Kontakte senden.", 
    fr: "Envoyer un message de bienvenue aux nouveaux contacts.", 
    es: "Enviar mensaje de bienvenida a nuevos contactos.", 
    it: "Invia messaggio di benvenuto ai nuovi contatti.",
    pl: "Wyślij wiadomość powitalną do nowych kontaktów."
  },
  "settings.keyword_based": { 
    no: "Nøkkelord-basert", 
    en: "Keyword-based", 
    de: "Schlüsselwortbasiert", 
    fr: "Basé sur les mots-clés", 
    es: "Basado en palabras clave", 
    it: "Basato su parole chiave",
    pl: "Na podstawie słów kluczowych"
  },
  "settings.keyword_based_help": { 
    no: "Send spesifikk melding når visse nøkkelord oppdages.", 
    en: "Send specific message when certain keywords are detected.", 
    de: "Spezifische Nachricht senden, wenn bestimmte Schlüsselwörter erkannt werden.", 
    fr: "Envoyer un message spécifique lorsque certains mots-clés sont détectés.", 
    es: "Enviar mensaje específico cuando se detectan ciertas palabras clave.", 
    it: "Invia messaggio specifico quando vengono rilevate determinate parole chiave.",
    pl: "Wyślij konkretną wiadomość po wykryciu określonych słów kluczowych."
  },
  "settings.keywords": { 
    no: "Nøkkelord (kommaseparert)", 
    en: "Keywords (comma-separated)", 
    de: "Schlüsselwörter (durch Kommas getrennt)", 
    fr: "Mots-clés (séparés par des virgules)", 
    es: "Palabras clave (separadas por comas)", 
    it: "Parole chiave (separate da virgole)",
    pl: "Słowa kluczowe (oddzielone przecinkami)"
  },
  "settings.message": { 
    no: "Melding", 
    en: "Message", 
    de: "Nachricht", 
    fr: "Message", 
    es: "Mensaje", 
    it: "Messaggio",
    pl: "Wiadomość"
  },
  "settings.email_notifications": { 
    no: "E-postvarsler", 
    en: "Email notifications", 
    de: "E-Mail-Benachrichtigungen", 
    fr: "Notifications par e-mail", 
    es: "Notificaciones por correo", 
    it: "Notifiche email",
    pl: "Powiadomienia e-mail"
  },
  "settings.email_notifications_help": { 
    no: "Motta varsler på e-post om nye meldinger.", 
    en: "Receive email notifications about new messages.", 
    de: "E-Mail-Benachrichtigungen über neue Nachrichten erhalten.", 
    fr: "Recevoir des notifications par e-mail sur les nouveaux messages.", 
    es: "Recibir notificaciones por correo sobre nuevos mensajes.", 
    it: "Ricevi notifiche email sui nuovi messaggi.",
    pl: "Otrzymuj powiadomienia e-mail o nowych wiadomościach."
  },
  "settings.push_notifications": { 
    no: "Push-varsler", 
    en: "Push notifications", 
    de: "Push-Benachrichtigungen", 
    fr: "Notifications push", 
    es: "Notificaciones push", 
    it: "Notifiche push",
    pl: "Powiadomienia push"
  },
  "settings.push_notifications_help": { 
    no: "Motta push-varsler i nettleseren.", 
    en: "Receive push notifications in the browser.", 
    de: "Push-Benachrichtigungen im Browser erhalten.", 
    fr: "Recevoir des notifications push dans le navigateur.", 
    es: "Recibir notificaciones push en el navegador.", 
    it: "Ricevi notifiche push nel browser.",
    pl: "Otrzymuj powiadomienia push w przeglądarce."
  },
  "settings.sms_notifications": { 
    no: "SMS-varsler", 
    en: "SMS notifications", 
    de: "SMS-Benachrichtigungen", 
    fr: "Notifications SMS", 
    es: "Notificaciones SMS", 
    it: "Notifiche SMS",
    pl: "Powiadomienia SMS"
  },
  "settings.sms_notifications_help": { 
    no: "Motta SMS-varsler for kritiske meldinger.", 
    en: "Receive SMS notifications for critical messages.", 
    de: "SMS-Benachrichtigungen für kritische Nachrichten erhalten.", 
    fr: "Recevoir des notifications SMS pour les messages critiques.", 
    es: "Recibir notificaciones SMS para mensajes críticos.", 
    it: "Ricevi notifiche SMS per messaggi critici.",
    pl: "Otrzymuj powiadomienia SMS dla krytycznych wiadomości."
  },
  "settings.only_on_duty": { 
    no: "Kun når på vakt", 
    en: "Only when on duty", 
    de: "Nur im Dienst", 
    fr: "Seulement en service", 
    es: "Solo cuando esté de guardia", 
    it: "Solo quando esté de guardia",
    pl: "Tylko podczas dyżuru"
  },
  "settings.only_on_duty_help": { 
    no: "Motta bare varsler når du er markert som på vakt.", 
    en: "Only receive notifications when marked as on duty.", 
    de: "Benachrichtigungen nur erhalten, wenn als im Dienst markiert.", 
    fr: "Recevoir des notifications uniquement lorsque marqué en service.", 
    es: "Recibir notificaciones solo cuando esté marcado de guardia.", 
    it: "Ricevi notifiche solo quando sei di turno.",
    pl: "Otrzymuj powiadomienia tylko podczas dyżuru."
  },

  // Days of the week
  "days.monday": { 
    no: "Mandag", 
    en: "Monday", 
    de: "Montag", 
    fr: "Lundi", 
    es: "Lunes", 
    it: "Lunedì",
    pl: "Poniedziałek"
  },
  "days.tuesday": { 
    no: "Tirsdag", 
    en: "Tuesday", 
    de: "Dienstag", 
    fr: "Mardi", 
    es: "Martes", 
    it: "Martedì",
    pl: "Wtorek"
  },
  "days.wednesday": { 
    no: "Onsdag", 
    en: "Wednesday", 
    de: "Mittwoch", 
    fr: "Mercredi", 
    es: "Miércoles", 
    it: "Mercoledì",
    pl: "Środa"
  },
  "days.thursday": { 
    no: "Torsdag", 
    en: "Thursday", 
    de: "Donnerstag", 
    fr: "Jeudi", 
    es: "Jueves", 
    it: "Giovedì",
    pl: "Czwartek"
  },
  "days.friday": { 
    no: "Fredag", 
    en: "Friday", 
    de: "Freitag", 
    fr: "Vendredi", 
    es: "Viernes", 
    it: "Venerdì",
    pl: "Piątek"
  },
  "days.saturday": { 
    no: "Lørdag", 
    en: "Saturday", 
    de: "Samstag", 
    fr: "Samedi", 
    es: "Sábado", 
    it: "Sabato",
    pl: "Sobota"
  },
  "days.sunday": { 
    no: "Søndag", 
    en: "Sunday", 
    de: "Sonntag", 
    fr: "Dimanche", 
    es: "Domingo", 
    it: "Domenica",
    pl: "Niedziela"
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("no");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("semse-language") as Language;
    if (savedLanguage && ["no", "en", "de", "fr", "es", "it", "pl"].includes(savedLanguage)) {
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