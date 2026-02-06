import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "no" | "en" | "de" | "fr" | "es" | "it";

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
    it: "Dashboard" 
  },
  "nav.inbox": { 
    no: "Innboks", 
    en: "Inbox", 
    de: "Posteingang", 
    fr: "Boîte de réception", 
    es: "Bandeja de entrada", 
    it: "Posta in arrivo" 
  },
  "nav.contacts": { 
    no: "Kontakter", 
    en: "Contacts", 
    de: "Kontakte", 
    fr: "Contacts", 
    es: "Contactos", 
    it: "Contatti" 
  },
  "nav.send": { 
    no: "Send melding", 
    en: "Send message", 
    de: "Nachricht senden", 
    fr: "Envoyer un message", 
    es: "Enviar mensaje", 
    it: "Invia messaggio" 
  },
  "nav.campaigns": { 
    no: "Kampanjer", 
    en: "Campaigns", 
    de: "Kampagnen", 
    fr: "Campagnes", 
    es: "Campañas", 
    it: "Campagne" 
  },
  "nav.simulate": { 
    no: "Simulering", 
    en: "Simulation", 
    de: "Simulation", 
    fr: "Simulation", 
    es: "Simulación", 
    it: "Simulazione" 
  },
  "nav.admin": { 
    no: "Administrasjon", 
    en: "Administration", 
    de: "Verwaltung", 
    fr: "Administration", 
    es: "Administración", 
    it: "Amministrazione" 
  },
  "nav.settings": { 
    no: "Innstillinger", 
    en: "Settings", 
    de: "Einstellungen", 
    fr: "Paramètres", 
    es: "Configuración", 
    it: "Impostazioni" 
  },
  "nav.logout": { 
    no: "Logg ut", 
    en: "Log out", 
    de: "Abmelden", 
    fr: "Se déconnecter", 
    es: "Cerrar sesión", 
    it: "Disconnetti" 
  },
  
  // Theme
  "theme.light": { 
    no: "Light", 
    en: "Light", 
    de: "Hell", 
    fr: "Clair", 
    es: "Claro", 
    it: "Chiaro" 
  },
  "theme.dark": { 
    no: "Dark", 
    en: "Dark", 
    de: "Dunkel", 
    fr: "Sombre", 
    es: "Oscuro", 
    it: "Scuro" 
  },
  "theme.system": { 
    no: "System", 
    en: "System", 
    de: "System", 
    fr: "Système", 
    es: "Sistema", 
    it: "Sistema" 
  },
  "theme.toggle": { 
    no: "Bytt tema", 
    en: "Toggle theme", 
    de: "Design wechseln", 
    fr: "Changer le thème", 
    es: "Cambiar tema", 
    it: "Cambia tema" 
  },
  
  // Common
  "common.loading": { 
    no: "Laster...", 
    en: "Loading...", 
    de: "Laden...", 
    fr: "Chargement...", 
    es: "Cargando...", 
    it: "Caricamento..." 
  },
  "common.save": { 
    no: "Lagre", 
    en: "Save", 
    de: "Speichern", 
    fr: "Enregistrer", 
    es: "Guardar", 
    it: "Salva" 
  },
  "common.cancel": { 
    no: "Avbryt", 
    en: "Cancel", 
    de: "Abbrechen", 
    fr: "Annuler", 
    es: "Cancelar", 
    it: "Annulla" 
  },
  "common.delete": { 
    no: "Slett", 
    en: "Delete", 
    de: "Löschen", 
    fr: "Supprimer", 
    es: "Eliminar", 
    it: "Elimina" 
  },
  "common.edit": { 
    no: "Rediger", 
    en: "Edit", 
    de: "Bearbeiten", 
    fr: "Modifier", 
    es: "Editar", 
    it: "Modifica" 
  },
  "common.close": { 
    no: "Lukk", 
    en: "Close", 
    de: "Schließen", 
    fr: "Fermer", 
    es: "Cerrar", 
    it: "Chiudi" 
  },
  "common.search": { 
    no: "Søk", 
    en: "Search", 
    de: "Suchen", 
    fr: "Rechercher", 
    es: "Buscar", 
    it: "Cerca" 
  },
  
  // Dashboard
  "dashboard.title": { 
    no: "Dashboard", 
    en: "Dashboard", 
    de: "Dashboard", 
    fr: "Tableau de bord", 
    es: "Panel de control", 
    it: "Dashboard" 
  },
  "dashboard.description": { 
    no: "Oversikt over meldinger og operasjoner", 
    en: "Overview of messages and operations", 
    de: "Übersicht über Nachrichten und Operationen", 
    fr: "Aperçu des messages et opérations", 
    es: "Resumen de mensajes y operaciones", 
    it: "Panoramica di messaggi e operazioni" 
  },
  "dashboard.unhandled_messages": { 
    no: "Ubehandlede meldinger", 
    en: "Unhandled messages", 
    de: "Unbearbeitete Nachrichten", 
    fr: "Messages non traités", 
    es: "Mensajes sin manejar", 
    it: "Messaggi non gestiti" 
  },
  "dashboard.awaiting_confirmation": { 
    no: "Venter på bekreftelse", 
    en: "Awaiting confirmation", 
    de: "Warten auf Bestätigung", 
    fr: "En attente de confirmation", 
    es: "Esperando confirmación", 
    it: "In attesa di conferma" 
  },
  "dashboard.operational_groups": { 
    no: "Operative grupper", 
    en: "Operational groups", 
    de: "Operative Gruppen", 
    fr: "Groupes opérationnels", 
    es: "Grupos operativos", 
    it: "Gruppi operativi" 
  },
  "dashboard.active_inboxes": { 
    no: "Aktive innbokser", 
    en: "Active inboxes", 
    de: "Aktive Posteingänge", 
    fr: "Boîtes actives", 
    es: "Bandejas activas", 
    it: "Caselle attive" 
  },
  "dashboard.on_duty_users": { 
    no: "On-duty brukere", 
    en: "On-duty users", 
    de: "Diensthabende Benutzer", 
    fr: "Utilisateurs de garde", 
    es: "Usuarios de guardia", 
    it: "Utenti di turno" 
  },
  "dashboard.active_operators": { 
    no: "Aktive operatører", 
    en: "Active operators", 
    de: "Aktive Betreiber", 
    fr: "Opérateurs actifs", 
    es: "Operadores activos", 
    it: "Operatori attivi" 
  },
  "dashboard.avg_response_time": { 
    no: "Gjennomsnittlig svartid", 
    en: "Average response time", 
    de: "Durchschnittliche Antwortzeit", 
    fr: "Temps de réponse moyen", 
    es: "Tiempo de respuesta promedio", 
    it: "Tempo medio di risposta" 
  },
  "dashboard.last_24h": { 
    no: "Siste 24 timer", 
    en: "Last 24 hours", 
    de: "Letzte 24 Stunden", 
    fr: "Dernières 24 heures", 
    es: "Últimas 24 horas", 
    it: "Ultime 24 ore" 
  },
  "dashboard.recent_messages": { 
    no: "Siste meldinger", 
    en: "Recent messages", 
    de: "Neueste Nachrichten", 
    fr: "Messages récents", 
    es: "Mensajes recientes", 
    it: "Messaggi recenti" 
  },
  "dashboard.newest_inbound": { 
    no: "Nyeste inngående meldinger på tvers av grupper", 
    en: "Newest inbound messages across groups", 
    de: "Neueste eingehende Nachrichten gruppenübergreifend", 
    fr: "Derniers messages entrants dans tous les groupes", 
    es: "Mensajes entrantes más recientes en todos los grupos", 
    it: "Messaggi in arrivo più recenti in tutti i gruppi" 
  },
  "dashboard.no_messages": { 
    no: "Ingen meldinger ennå", 
    en: "No messages yet", 
    de: "Noch keine Nachrichten", 
    fr: "Aucun message pour le moment", 
    es: "No hay mensajes aún", 
    it: "Nessun messaggio ancora" 
  },
  "dashboard.see_all_messages": { 
    no: "Se alle meldinger", 
    en: "See all messages", 
    de: "Alle Nachrichten anzeigen", 
    fr: "Voir tous les messages", 
    es: "Ver todos los mensajes", 
    it: "Vedi tutti i messaggi" 
  },
  "dashboard.duty_status": { 
    no: "Vakt-status", 
    en: "Duty status", 
    de: "Dienststatus", 
    fr: "État de service", 
    es: "Estado de guardia", 
    it: "Stato di servizio" 
  },
  "dashboard.on_duty_coverage": { 
    no: "Oversikt over on-duty dekning per gruppe", 
    en: "Overview of on-duty coverage per group", 
    de: "Übersicht über Dienstabdeckung pro Gruppe", 
    fr: "Aperçu de la couverture de garde par groupe", 
    es: "Resumen de cobertura de guardia por grupo", 
    it: "Panoramica della copertura di turno per gruppo" 
  },
  "dashboard.no_operational_groups": { 
    no: "Ingen operative grupper opprettet", 
    en: "No operational groups created", 
    de: "Keine operativen Gruppen erstellt", 
    fr: "Aucun groupe opérationnel créé", 
    es: "No se han creado grupos operativos", 
    it: "Nessun gruppo operativo creato" 
  },
  "dashboard.create_first_group": { 
    no: "Opprett første gruppe", 
    en: "Create first group", 
    de: "Erste Gruppe erstellen", 
    fr: "Créer le premier groupe", 
    es: "Crear primer grupo", 
    it: "Crea primo gruppo" 
  },
  "dashboard.manage_groups": { 
    no: "Administrer grupper", 
    en: "Manage groups", 
    de: "Gruppen verwalten", 
    fr: "Gérer les groupes", 
    es: "Administrar grupos", 
    it: "Gestisci gruppi" 
  },
  "dashboard.on_duty": { 
    no: "on-duty", 
    en: "on-duty", 
    de: "im Dienst", 
    fr: "de garde", 
    es: "de guardia", 
    it: "di turno" 
  },
  "dashboard.open": { 
    no: "Åpen", 
    en: "Open", 
    de: "Offen", 
    fr: "Ouvert", 
    es: "Abierto", 
    it: "Aperto" 
  },
  "dashboard.closed": { 
    no: "Stengt", 
    en: "Closed", 
    de: "Geschlossen", 
    fr: "Fermé", 
    es: "Cerrado", 
    it: "Chiuso" 
  },
  
  // Inbox/Conversations
  "inbox.title": { 
    no: "Samtaler", 
    en: "Conversations", 
    de: "Unterhaltungen", 
    fr: "Conversations", 
    es: "Conversaciones", 
    it: "Conversazioni" 
  },
  "inbox.description": { 
    no: "Håndter meldinger fra dine grupper.", 
    en: "Manage messages from your groups.", 
    de: "Verwalten Sie Nachrichten aus Ihren Gruppen.", 
    fr: "Gérez les messages de vos groupes.", 
    es: "Gestionar mensajes de sus grupos.", 
    it: "Gestisci i messaggi dai tuoi gruppi." 
  },
  "inbox.all_conversations": { 
    no: "Alle samtaler", 
    en: "All conversations", 
    de: "Alle Unterhaltungen", 
    fr: "Toutes les conversations", 
    es: "Todas las conversaciones", 
    it: "Tutte le conversazioni" 
  },
  "inbox.unknown_senders": { 
    no: "Ukjente avsendere", 
    en: "Unknown senders", 
    de: "Unbekannte Absender", 
    fr: "Expéditeurs inconnus", 
    es: "Remitentes desconocidos", 
    it: "Mittenti sconosciuti" 
  },
  "inbox.escalated": { 
    no: "Eskalerte", 
    en: "Escalated", 
    de: "Eskaliert", 
    fr: "Escaladés", 
    es: "Escalados", 
    it: "Escalati" 
  },
  "inbox.filter_by_group": { 
    no: "Filtrer etter gruppe", 
    en: "Filter by group", 
    de: "Nach Gruppe filtern", 
    fr: "Filtrer par groupe", 
    es: "Filtrar por grupo", 
    it: "Filtra per gruppo" 
  },
  "inbox.all_groups": { 
    no: "Alle grupper", 
    en: "All groups", 
    de: "Alle Gruppen", 
    fr: "Tous les groupes", 
    es: "Todos los grupos", 
    it: "Tutti i gruppi" 
  },
  "inbox.conversations_count": { 
    no: "Samtaler", 
    en: "Conversations", 
    de: "Unterhaltungen", 
    fr: "Conversations", 
    es: "Conversaciones", 
    it: "Conversazioni" 
  },
  "inbox.no_conversations": { 
    no: "Ingen samtaler", 
    en: "No conversations", 
    de: "Keine Unterhaltungen", 
    fr: "Aucune conversation", 
    es: "No hay conversaciones", 
    it: "Nessuna conversazione" 
  },
  "inbox.no_unknown": { 
    no: "Ingen ukjente avsendere for øyeblikket", 
    en: "No unknown senders at the moment", 
    de: "Derzeit keine unbekannten Absender", 
    fr: "Aucun expéditeur inconnu pour le moment", 
    es: "No hay remitentes desconocidos en este momento", 
    it: "Nessun mittente sconosciuto al momento" 
  },
  "inbox.no_escalated": { 
    no: "Ingen eskalerte meldinger", 
    en: "No escalated messages", 
    de: "Keine eskalierten Nachrichten", 
    fr: "Aucun message escaladé", 
    es: "No hay mensajes escalados", 
    it: "Nessun messaggio escalato" 
  },
  "inbox.messages_appear": { 
    no: "Meldinger vil vises her når de ankommer", 
    en: "Messages will appear here when they arrive", 
    de: "Nachrichten werden hier angezeigt, wenn sie eintreffen", 
    fr: "Les messages apparaîtront ici à leur arrivée", 
    es: "Los mensajes aparecerán aquí cuando lleguen", 
    it: "I messaggi appariranno qui quando arrivano" 
  },
  "inbox.no_found": { 
    no: "Ingen samtaler funnet", 
    en: "No conversations found", 
    de: "Keine Unterhaltungen gefunden", 
    fr: "Aucune conversation trouvée", 
    es: "No se encontraron conversaciones", 
    it: "Nessuna conversazione trovata" 
  },
  "inbox.bulk": { 
    no: "Bulk", 
    en: "Bulk", 
    de: "Massen", 
    fr: "Groupé", 
    es: "Masivo", 
    it: "Massa" 
  },
  "inbox.responses": { 
    no: "svar", 
    en: "responses", 
    de: "Antworten", 
    fr: "réponses", 
    es: "respuestas", 
    it: "risposte" 
  },
  "inbox.unknown": { 
    no: "Ukjent", 
    en: "Unknown", 
    de: "Unbekannt", 
    fr: "Inconnu", 
    es: "Desconocido", 
    it: "Sconosciuto" 
  },
  "inbox.select_conversation": { 
    no: "Velg en samtale", 
    en: "Select a conversation", 
    de: "Wählen Sie eine Unterhaltung", 
    fr: "Sélectionnez une conversation", 
    es: "Seleccionar una conversación", 
    it: "Seleziona una conversazione" 
  },
  "inbox.select_help": { 
    no: "Velg en samtale fra listen til venstre for å se meldingshistorikk og svare.", 
    en: "Select a conversation from the list on the left to view message history and reply.", 
    de: "Wählen Sie eine Unterhaltung aus der Liste links, um den Nachrichtenverlauf anzuzeigen und zu antworten.", 
    fr: "Sélectionnez une conversation dans la liste de gauche pour voir l'historique et répondre.", 
    es: "Seleccione una conversación de la lista de la izquierda para ver el historial y responder.", 
    it: "Seleziona una conversazione dall'elenco a sinistra per visualizzare la cronologia e rispondere." 
  },
  "inbox.resolve": { 
    no: "Løs", 
    en: "Resolve", 
    de: "Lösen", 
    fr: "Résoudre", 
    es: "Resolver", 
    it: "Risolvi" 
  },
  "inbox.move": { 
    no: "Flytt", 
    en: "Move", 
    de: "Verschieben", 
    fr: "Déplacer", 
    es: "Mover", 
    it: "Sposta" 
  },
  "inbox.write_reply": { 
    no: "Skriv et svar...", 
    en: "Write a reply...", 
    de: "Antwort schreiben...", 
    fr: "Écrire une réponse...", 
    es: "Escribir una respuesta...", 
    it: "Scrivi una risposta..." 
  },
  "inbox.loading_messages": { 
    no: "Laster meldinger...", 
    en: "Loading messages...", 
    de: "Nachrichten werden geladen...", 
    fr: "Chargement des messages...", 
    es: "Cargando mensajes...", 
    it: "Caricamento messaggi..." 
  },
  "inbox.no_messages_thread": { 
    no: "Ingen meldinger i denne tråden", 
    en: "No messages in this thread", 
    de: "Keine Nachrichten in diesem Thread", 
    fr: "Aucun message dans ce fil", 
    es: "No hay mensajes en este hilo", 
    it: "Nessun messaggio in questa discussione" 
  },
  "inbox.you": { 
    no: "Du", 
    en: "You", 
    de: "Sie", 
    fr: "Vous", 
    es: "Tú", 
    it: "Tu" 
  },
  
  // Contacts
  "contacts.title": { 
    no: "Kontakter", 
    en: "Contacts", 
    de: "Kontakte", 
    fr: "Contacts", 
    es: "Contactos", 
    it: "Contatti" 
  },
  "contacts.description": { 
    no: "Administrer kontakter og søk i historikk", 
    en: "Manage contacts and search history", 
    de: "Kontakte verwalten und Verlauf durchsuchen", 
    fr: "Gérer les contacts et rechercher l'historique", 
    es: "Administrar contactos y buscar historial", 
    it: "Gestisci contatti e cerca cronologia" 
  },
  "contacts.new_contact": { 
    no: "Ny kontakt", 
    en: "New contact", 
    de: "Neuer Kontakt", 
    fr: "Nouveau contact", 
    es: "Nuevo contacto", 
    it: "Nuovo contatto" 
  },
  "contacts.search_filter": { 
    no: "Søk og filtrer", 
    en: "Search and filter", 
    de: "Suchen und filtern", 
    fr: "Rechercher et filtrer", 
    es: "Buscar y filtrar", 
    it: "Cerca e filtra" 
  },
  "contacts.search_placeholder": { 
    no: "Søk etter navn eller telefonnummer...", 
    en: "Search by name or phone number...", 
    de: "Nach Name oder Telefonnummer suchen...", 
    fr: "Rechercher par nom ou numéro de téléphone...", 
    es: "Buscar por nombre o número de teléfono...", 
    it: "Cerca per nome o numero di telefono..." 
  },
  "contacts.count": { 
    no: "kontakter", 
    en: "contacts", 
    de: "Kontakte", 
    fr: "contacts", 
    es: "contactos", 
    it: "contatti" 
  },
  "contacts.no_found": { 
    no: "Ingen kontakter funnet", 
    en: "No contacts found", 
    de: "Keine Kontakte gefunden", 
    fr: "Aucun contact trouvé", 
    es: "No se encontraron contactos", 
    it: "Nessun contatto trovato" 
  },
  "contacts.name": { 
    no: "Navn", 
    en: "Name", 
    de: "Name", 
    fr: "Nom", 
    es: "Nombre", 
    it: "Nome" 
  },
  "contacts.phone": { 
    no: "Telefon", 
    en: "Phone", 
    de: "Telefon", 
    fr: "Téléphone", 
    es: "Teléfono", 
    it: "Telefono" 
  },
  "contacts.email": { 
    no: "E-post", 
    en: "Email", 
    de: "E-Mail", 
    fr: "E-mail", 
    es: "Correo electrónico", 
    it: "Email" 
  },
  "contacts.groups": { 
    no: "Grupper", 
    en: "Groups", 
    de: "Gruppen", 
    fr: "Groupes", 
    es: "Grupos", 
    it: "Gruppi" 
  },
  "contacts.created": { 
    no: "Opprettet", 
    en: "Created", 
    de: "Erstellt", 
    fr: "Créé", 
    es: "Creado", 
    it: "Creato" 
  },
  "contacts.actions": { 
    no: "Handlinger", 
    en: "Actions", 
    de: "Aktionen", 
    fr: "Actions", 
    es: "Acciones", 
    it: "Azioni" 
  },
  "contacts.edit": { 
    no: "Rediger kontakt", 
    en: "Edit contact", 
    de: "Kontakt bearbeiten", 
    fr: "Modifier le contact", 
    es: "Editar contacto", 
    it: "Modifica contatto" 
  },
  "contacts.add": { 
    no: "Legg til ny kontakt", 
    en: "Add new contact", 
    de: "Neuen Kontakt hinzufügen", 
    fr: "Ajouter un nouveau contact", 
    es: "Añadir nuevo contacto", 
    it: "Aggiungi nuovo contatto" 
  },
  "contacts.update_info": { 
    no: "Oppdater kontaktinformasjon og gruppetilhørighet.", 
    en: "Update contact information and group membership.", 
    de: "Kontaktinformationen und Gruppenzugehörigkeit aktualisieren.", 
    fr: "Mettre à jour les informations de contact et l'appartenance au groupe.", 
    es: "Actualizar información de contacto y pertenencia al grupo.", 
    it: "Aggiorna le informazioni di contatto e l'appartenenza al gruppo." 
  },
  "contacts.create_info": { 
    no: "Opprett en ny kontakt og tildel til relevante grupper.", 
    en: "Create a new contact and assign to relevant groups.", 
    de: "Erstellen Sie einen neuen Kontakt und weisen Sie ihn relevanten Gruppen zu.", 
    fr: "Créer un nouveau contact et l'assigner aux groupes pertinents.", 
    es: "Crear un nuevo contacto y asignarlo a grupos relevantes.", 
    it: "Crea un nuovo contatto e assegnalo ai gruppi pertinenti." 
  },
  "contacts.name_required": { 
    no: "Navn *", 
    en: "Name *", 
    de: "Name *", 
    fr: "Nom *", 
    es: "Nombre *", 
    it: "Nome *" 
  },
  "contacts.phone_required": { 
    no: "Telefon *", 
    en: "Phone *", 
    de: "Telefon *", 
    fr: "Téléphone *", 
    es: "Teléfono *", 
    it: "Telefono *" 
  },
  "contacts.group_membership": { 
    no: "Gruppetilhørighet (Routing)", 
    en: "Group membership (Routing)", 
    de: "Gruppenzugehörigkeit (Routing)", 
    fr: "Appartenance au groupe (Routage)", 
    es: "Pertenencia al grupo (Enrutamiento)", 
    it: "Appartenenza al gruppo (Instradamento)" 
  },
  "contacts.no_groups": { 
    no: "Ingen grupper tilgjengelig", 
    en: "No groups available", 
    de: "Keine Gruppen verfügbar", 
    fr: "Aucun groupe disponible", 
    es: "No hay grupos disponibles", 
    it: "Nessun gruppo disponibile" 
  },
  "contacts.operational_group": { 
    no: "Operasjonell gruppe", 
    en: "Operational group", 
    de: "Operative Gruppe", 
    fr: "Groupe opérationnel", 
    es: "Grupo operativo", 
    it: "Gruppo operativo" 
  },
  "contacts.group_help": { 
    no: "Velg hvilke grupper denne kontakten tilhører. Meldinger fra dette nummeret vil automatisk bli rutet til disse gruppene.", 
    en: "Select which groups this contact belongs to. Messages from this number will be automatically routed to these groups.", 
    de: "Wählen Sie aus, zu welchen Gruppen dieser Kontakt gehört. Nachrichten von dieser Nummer werden automatisch an diese Gruppen weitergeleitet.", 
    fr: "Sélectionnez les groupes auxquels appartient ce contact. Les messages de ce numéro seront automatiquement acheminés vers ces groupes.", 
    es: "Seleccione a qué grupos pertenece este contacto. Los mensajes de este número se enrutarán automáticamente a estos grupos.", 
    it: "Seleziona a quali gruppi appartiene questo contatto. I messaggi da questo numero verranno automaticamente instradati a questi gruppi." 
  },
  "contacts.saving": { 
    no: "Lagrer...", 
    en: "Saving...", 
    de: "Speichern...", 
    fr: "Enregistrement...", 
    es: "Guardando...", 
    it: "Salvataggio..." 
  },
  "contacts.save_changes": { 
    no: "Lagre endringer", 
    en: "Save changes", 
    de: "Änderungen speichern", 
    fr: "Enregistrer les modifications", 
    es: "Guardar cambios", 
    it: "Salva modifiche" 
  },
  "contacts.add_contact": { 
    no: "Legg til kontakt", 
    en: "Add contact", 
    de: "Kontakt hinzufügen", 
    fr: "Ajouter un contact", 
    es: "Añadir contacto", 
    it: "Aggiungi contatto" 
  },
  
  // Login
  "login.title": { 
    no: "Logg inn - SeMSe 2.0", 
    en: "Log in - SeMSe 2.0", 
    de: "Anmelden - SeMSe 2.0", 
    fr: "Se connecter - SeMSe 2.0", 
    es: "Iniciar sesión - SeMSe 2.0", 
    it: "Accedi - SeMSe 2.0" 
  },
  "login.description": { 
    no: "Logg inn for å administrere meldinger og operasjoner", 
    en: "Log in to manage messages and operations", 
    de: "Melden Sie sich an, um Nachrichten und Operationen zu verwalten", 
    fr: "Connectez-vous pour gérer les messages et les opérations", 
    es: "Inicie sesión para administrar mensajes y operaciones", 
    it: "Accedi per gestire messaggi e operazioni" 
  },
  "login.email": { 
    no: "E-post", 
    en: "Email", 
    de: "E-Mail", 
    fr: "E-mail", 
    es: "Correo electrónico", 
    it: "Email" 
  },
  "login.password": { 
    no: "Passord", 
    en: "Password", 
    de: "Passwort", 
    fr: "Mot de passe", 
    es: "Contraseña", 
    it: "Password" 
  },
  "login.button": { 
    no: "Logg inn", 
    en: "Log in", 
    de: "Anmelden", 
    fr: "Se connecter", 
    es: "Iniciar sesión", 
    it: "Accedi" 
  },
  "login.logging_in": { 
    no: "Logger inn...", 
    en: "Logging in...", 
    de: "Anmeldung...", 
    fr: "Connexion...", 
    es: "Iniciando sesión...", 
    it: "Accesso..." 
  },
  "login.no_account": { 
    no: "Har du ikke en konto? Kom i gang her", 
    en: "Don't have an account? Get started here", 
    de: "Haben Sie kein Konto? Hier starten", 
    fr: "Vous n'avez pas de compte? Commencez ici", 
    es: "¿No tienes una cuenta? Comienza aquí", 
    it: "Non hai un account? Inizia qui" 
  },
  "login.forgot_password": { 
    no: "Glemt passord? Kontakt administrator", 
    en: "Forgot password? Contact administrator", 
    de: "Passwort vergessen? Administrator kontaktieren", 
    fr: "Mot de passe oublié? Contactez l'administrateur", 
    es: "¿Olvidaste la contraseña? Contacta al administrador", 
    it: "Password dimenticata? Contatta l'amministratore" 
  },
  "login.demo": { 
    no: "Demo", 
    en: "Demo", 
    de: "Demo", 
    fr: "Démo", 
    es: "Demo", 
    it: "Demo" 
  },
  
  // Errors
  "error.email_not_confirmed": { 
    no: "E-posten din er ikke bekreftet. Sjekk innboksen din for bekreftelseslenke.", 
    en: "Your email is not confirmed. Check your inbox for confirmation link.", 
    de: "Ihre E-Mail ist nicht bestätigt. Überprüfen Sie Ihren Posteingang auf den Bestätigungslink.", 
    fr: "Votre e-mail n'est pas confirmé. Vérifiez votre boîte de réception pour le lien de confirmation.", 
    es: "Tu correo electrónico no está confirmado. Verifica tu bandeja de entrada para el enlace de confirmación.", 
    it: "La tua email non è confermata. Controlla la tua casella di posta per il link di conferma." 
  },
  "error.invalid_credentials": { 
    no: "Feil e-post eller passord. Prøv igjen.", 
    en: "Invalid email or password. Try again.", 
    de: "Ungültige E-Mail oder Passwort. Versuchen Sie es erneut.", 
    fr: "E-mail ou mot de passe invalide. Réessayez.", 
    es: "Correo electrónico o contraseña inválidos. Intenta de nuevo.", 
    it: "Email o password non validi. Riprova." 
  },
  "error.login_failed": { 
    no: "Pålogging feilet. Prøv igjen.", 
    en: "Login failed. Try again.", 
    de: "Anmeldung fehlgeschlagen. Versuchen Sie es erneut.", 
    fr: "Connexion échouée. Réessayez.", 
    es: "Error de inicio de sesión. Intenta de nuevo.", 
    it: "Accesso fallito. Riprova." 
  },
  "error.unexpected": { 
    no: "En uventet feil oppstod. Prøv igjen.", 
    en: "An unexpected error occurred. Try again.", 
    de: "Ein unerwarteter Fehler ist aufgetreten. Versuchen Sie es erneut.", 
    fr: "Une erreur inattendue s'est produite. Réessayez.", 
    es: "Ocurrió un error inesperado. Intenta de nuevo.", 
    it: "Si è verificato un errore imprevisto. Riprova." 
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("no");

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("semse-language") as Language;
    if (savedLanguage && ["no", "en", "de", "fr", "es", "it"].includes(savedLanguage)) {
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