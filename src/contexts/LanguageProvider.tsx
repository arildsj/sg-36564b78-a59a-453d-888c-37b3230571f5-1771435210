import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "no" | "en" | "de" | "fr" | "es" | "it" | "pl";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<string, Record<Language, string>> = {
  // Common
  "common.loading": { no: "Laster...", en: "Loading...", de: "Laden...", fr: "Chargement...", es: "Cargando...", it: "Caricamento...", pl: "Ładowanie..." },
  
  // Navigation
  "nav.home": { no: "Hjem", en: "Home", de: "Startseite", fr: "Accueil", es: "Inicio", it: "Home", pl: "Strona główna" },
  "nav.inbox": { no: "Innboks", en: "Inbox", de: "Posteingang", fr: "Boîte de réception", es: "Bandeja de entrada", it: "Posta in arrivo", pl: "Skrzynka odbiorcza" },
  "nav.contacts": { no: "Kontakter", en: "Contacts", de: "Kontakte", fr: "Contacts", es: "Contactos", it: "Contatti", pl: "Kontakty" },
  "nav.sending": { no: "Send Melding", en: "Send Message", de: "Nachricht senden", fr: "Envoyer un message", es: "Enviar mensaje", it: "Invia messaggio", pl: "Wyślij wiadomość" },
  "nav.simulate": { no: "Simuler", en: "Simulate", de: "Simulieren", fr: "Simuler", es: "Simular", it: "Simula", pl: "Symuluj" },
  "nav.print_to_sms": { no: "Print-to-SMS", en: "Print-to-SMS", de: "Print-to-SMS", fr: "Print-to-SMS", es: "Print-to-SMS", it: "Print-to-SMS", pl: "Print-to-SMS" },
  "nav.admin": { no: "Admin", en: "Admin", de: "Admin", fr: "Admin", es: "Admin", it: "Admin", pl: "Admin" },
  "nav.settings": { no: "Innstillinger", en: "Settings", de: "Einstellungen", fr: "Paramètres", es: "Configuración", it: "Impostazioni", pl: "Ustawienia" },
  "nav.logout": { no: "Logg ut", en: "Log out", de: "Abmelden", fr: "Se déconnecter", es: "Cerrar sesión", it: "Disconnettersi", pl: "Wyloguj się" },
  "nav.dashboard": { no: "Kontrollpanel", en: "Dashboard", de: "Übersicht", fr: "Tableau de bord", es: "Panel de control", it: "Cruscotto", pl: "Panel kontrolny" },

  // Dashboard
  "dashboard.title": { no: "Kontrollpanel", en: "Dashboard", de: "Übersicht", fr: "Tableau de bord", es: "Panel de control", it: "Cruscotto", pl: "Panel kontrolny" },
  "dashboard.description": { no: "Oversikt over systemstatus og aktivitet", en: "Overview of system status and activity", de: "Übersicht über Systemstatus und Aktivität", fr: "Aperçu de l'état du système et de l'activité", es: "Resumen del estado del sistema y la actividad", it: "Panoramica dello stato del sistema e dell'attività", pl: "Przegląd statusu systemu i aktywności" },
  "dashboard.unhandled_messages": { no: "Ubehandlede meldinger", en: "Unhandled messages", de: "Unbearbeitete Nachrichten", fr: "Messages non traités", es: "Mensajes sin manejar", it: "Messaggi non gestiti", pl: "Nieobsłużone wiadomości" },
  "dashboard.operational_groups": { no: "Operative grupper", en: "Operational groups", de: "Operative Gruppen", fr: "Groupes opérationnels", es: "Grupos operativos", it: "Gruppi operativi", pl: "Grupy operacyjne" },
  "dashboard.on_duty_users": { no: "Brukere på vakt", en: "On-duty users", de: "Benutzer im Dienst", fr: "Utilisateurs de garde", es: "Usuarios de guardia", it: "Utenti in servizio", pl: "Użytkownicy na dyżurze" },
  "dashboard.avg_response_time": { no: "Gj.snittlig responstid", en: "Avg. response time", de: "Durchschn. Antwortzeit", fr: "Temps de réponse moy.", es: "Tiempo de respuesta prom.", it: "Tempo di risposta medio", pl: "Śr. czas odpowiedzi" },
  "dashboard.awaiting_confirmation": { no: "Venter på bekreftelse", en: "Awaiting confirmation", de: "Wartet auf Bestätigung", fr: "En attente de confirmation", es: "Esperando confirmación", it: "In attesa di conferma", pl: "Oczekuje na potwierdzenie" },
  "dashboard.active_inboxes": { no: "Aktive innbokser", en: "Active inboxes", de: "Aktive Posteingänge", fr: "Boîtes de réception actives", es: "Bandejas de entrada activas", it: "Caselle di posta attive", pl: "Aktywne skrzynki odbiorcze" },
  "dashboard.active_operators": { no: "Aktive operatører", en: "Active operators", de: "Aktive Operatoren", fr: "Opérateurs actifs", es: "Operadores activos", it: "Operatori attivi", pl: "Aktywni operatorzy" },
  "dashboard.last_24h": { no: "Siste 24t", en: "Last 24h", de: "Letzte 24h", fr: "Dernières 24h", es: "Últimas 24h", it: "Ultime 24h", pl: "Ostatnie 24h" },
  "dashboard.recent_messages": { no: "Siste meldinger", en: "Recent messages", de: "Letzte Nachrichten", fr: "Messages récents", es: "Mensajes recientes", it: "Messaggi recenti", pl: "Ostatnie wiadomości" },
  "dashboard.newest_inbound": { no: "Nyeste innkommende", en: "Newest inbound", de: "Neueste eingehende", fr: "Plus récents entrants", es: "Más recientes entrantes", it: "Più recenti in arrivo", pl: "Najnowsze przychodzące" },
  "dashboard.no_messages": { no: "Ingen meldinger", en: "No messages", de: "Keine Nachrichten", fr: "Aucun message", es: "Sin mensajes", it: "Nessun messaggio", pl: "Brak wiadomości" },
  "dashboard.see_all_messages": { no: "Se alle meldinger", en: "See all messages", de: "Alle Nachrichten anzeigen", fr: "Voir tous les messages", es: "Ver todos los mensajes", it: "Vedi tutti i messaggi", pl: "Zobacz wszystkie wiadomości" },
  "dashboard.duty_status": { no: "Vakt-status", en: "Duty status", de: "Dienststatus", fr: "Statut de garde", es: "Estado de guardia", it: "Stato di servizio", pl: "Status dyżuru" },
  "dashboard.on_duty_coverage": { no: "Vaktdekning per gruppe", en: "On-duty coverage per group", de: "Dienstabdeckung pro Gruppe", fr: "Couverture de garde par groupe", es: "Cobertura de guardia por grupo", it: "Copertura di servizio per gruppo", pl: "Pokrycie dyżurów na grupę" },
  "dashboard.on_duty": { no: "på vakt", en: "on duty", de: "im Dienst", fr: "de garde", es: "de guardia", it: "in servizio", pl: "na dyżurze" },
  "dashboard.open": { no: "Åpen", en: "Open", de: "Offen", fr: "Ouvert", es: "Abierto", it: "Aperto", pl: "Otwarte" },
  "dashboard.closed": { no: "Stengt", en: "Closed", de: "Geschlossen", fr: "Fermé", es: "Cerrado", it: "Chiuso", pl: "Zamknięte" },
  "dashboard.no_operational_groups": { no: "Ingen operative grupper", en: "No operational groups", de: "Keine operativen Gruppen", fr: "Aucun groupe opérationnel", es: "Sin grupos operativos", it: "Nessun gruppo operativo", pl: "Brak grup operacyjnych" },
  "dashboard.create_first_group": { no: "Opprett første gruppe", en: "Create first group", de: "Erste Gruppe erstellen", fr: "Créer le premier groupe", es: "Crear primer grupo", it: "Crea primo gruppo", pl: "Utwórz pierwszą grupę" },
  "dashboard.manage_groups": { no: "Administrer grupper", en: "Manage groups", de: "Gruppen verwalten", fr: "Gérer les groupes", es: "Gestionar grupos", it: "Gestisci gruppi", pl: "Zarządzaj grupami" },

  // Home
  "home.title": { no: "Velkommen til SeMSe 2.0", en: "Welcome to SeMSe 2.0", de: "Willkommen bei SeMSe 2.0", fr: "Bienvenue sur SeMSe 2.0", es: "Bienvenido a SeMSe 2.0", it: "Benvenuto in SeMSe 2.0", pl: "Witamy w SeMSe 2.0" },
  "home.subtitle": { no: "Smart meldingshåndtering for skoler", en: "Smart messaging for schools", de: "Intelligentes Messaging für Schulen", fr: "Messagerie intelligente pour les écoles", es: "Mensajería inteligente para escuelas", it: "Messaggistica intelligente per le scuole", pl: "Inteligentna komunikacja dla szkół" },

  // Inbox
  "inbox.title": { no: "Samtaler", en: "Conversations", de: "Unterhaltungen", fr: "Conversations", es: "Conversaciones", it: "Conversazioni", pl: "Rozmowy" },
  "inbox.subtitle": { no: "Håndter meldinger fra dine grupper.", en: "Manage messages from your groups.", de: "Verwalten Sie Nachrichten von Ihren Gruppen.", fr: "Gérez les messages de vos groupes.", es: "Gestione los mensajes de sus grupos.", it: "Gestisci i messaggi dai tuoi gruppi.", pl: "Zarządzaj wiadomościami ze swoich grup." },
  "inbox.description": { no: "Håndter meldinger fra dine grupper.", en: "Manage messages from your groups.", de: "Verwalten Sie Nachrichten von Ihren Gruppen.", fr: "Gérez les messages de vos groupes.", es: "Gestione los mensajes de sus grupos.", it: "Gestisci i messaggi dai tuoi gruppi.", pl: "Zarządzaj wiadomościami ze swoich grup." },
  "inbox.all_threads": { no: "Alle samtaler", en: "All threads", de: "Alle Threads", fr: "Tous les fils", es: "Todos los hilos", it: "Tutti i thread", pl: "Wszystkie wątki" },
  "inbox.all_conversations": { no: "Alle samtaler", en: "All conversations", de: "Alle Unterhaltungen", fr: "Toutes les conversations", es: "Todas las conversaciones", it: "Tutte le conversazioni", pl: "Wszystkie rozmowy" },
  "inbox.unread_senders": { no: "Uleste avsendere", en: "Unread senders", de: "Ungelesene Absender", fr: "Expéditeurs non lus", es: "Remitentes no leídos", it: "Mittenti non letti", pl: "Nieprzeczytani nadawcy" },
  "inbox.unknown_senders": { no: "Ukjente avsendere", en: "Unknown senders", de: "Unbekannte Absender", fr: "Expéditeurs inconnus", es: "Remitentes desconocidos", it: "Mittenti sconosciuti", pl: "Nieznani nadawcy" },
  "inbox.escalated": { no: "Eskalerte", en: "Escalated", de: "Eskaliert", fr: "Escaladé", es: "Escalado", it: "Escalato", pl: "Eskalowane" },
  "inbox.all_groups": { no: "Alle grupper", en: "All groups", de: "Alle Gruppen", fr: "Tous les groupes", es: "Todos los grupos", it: "Tutti i gruppi", pl: "Wszystkie grupy" },
  "inbox.threads": { no: "Samtaler", en: "Threads", de: "Threads", fr: "Fils", es: "Hilos", it: "Thread", pl: "Wątki" },
  "inbox.no_reply_yet": { no: "Ingen svar mottatt ennå", en: "No replies received yet", de: "Noch keine Antworten erhalten", fr: "Aucune réponse reçue pour l'instant", es: "Aún no se han recibido respuestas", it: "Nessuna risposta ricevuta ancora", pl: "Nie otrzymano jeszcze odpowiedzi" },
  "inbox.replies_from_recipients": { no: "Svar fra mottakere vil dukke opp her.", en: "Replies from recipients will appear here.", de: "Antworten von Empfängern werden hier angezeigt.", fr: "Les réponses des destinataires apparaîtront ici.", es: "Las respuestas de los destinatarios aparecerán aquí.", it: "Le risposte dai destinatari appariranno qui.", pl: "Odpowiedzi od odbiorców pojawią się tutaj." },
  "inbox.inbound_replies": { no: "Innk. Svar", en: "Inb. Replies", de: "Eingeh. Antw.", fr: "Rép. entrantes", es: "Resp. entrantes", it: "Risp. in arrivo", pl: "Odp. przych." },
  "inbox.recipient_status": { no: "Mottakerstatus & Påminnelse", en: "Recipient Status & Reminder", de: "Empfängerstatus & Erinnerung", fr: "Statut du destinataire & Rappel", es: "Estado del destinatario y recordatorio", it: "Stato destinatario e promemoria", pl: "Status odbiorcy i przypomnienie" },
  "inbox.simulate_replies": { no: "Simuler svar", en: "Simulate replies", de: "Antworten simulieren", fr: "Simuler des réponses", es: "Simular respuestas", it: "Simula risposte", pl: "Symuluj odpowiedzi" },
  "inbox.has_replied": { no: "har svart", en: "has replied", de: "hat geantwortet", fr: "a répondu", es: "ha respondido", it: "ha risposto", pl: "odpowiedział" },
  "inbox.sent": { no: "sendt", en: "sent", de: "gesendet", fr: "envoyé", es: "enviado", it: "inviato", pl: "wysłane" },
  "inbox.failed": { no: "mislyktes", en: "failed", de: "fehlgeschlagen", fr: "échoué", es: "fallido", it: "fallito", pl: "nieudane" },
  "inbox.pending": { no: "venter", en: "pending", de: "ausstehend", fr: "en attente", es: "pendiente", it: "in attesa", pl: "oczekujące" },
  "inbox.new_message": { no: "Ny melding", en: "New message", de: "Neue Nachricht", fr: "Nouveau message", es: "Nuevo mensaje", it: "Nuovo messaggio", pl: "Nowa wiadomość" },
  "inbox.type_message": { no: "Skriv melding...", en: "Type message...", de: "Nachricht eingeben...", fr: "Tapez le message...", es: "Escriba el mensaje...", it: "Digita messaggio...", pl: "Wpisz wiadomość..." },
  "inbox.send": { no: "Send", en: "Send", de: "Senden", fr: "Envoyer", es: "Enviar", it: "Invia", pl: "Wyślij" },
  "inbox.acknowledge": { no: "Kvitter", en: "Acknowledge", de: "Bestätigen", fr: "Accuser réception", es: "Acusar recibo", it: "Riconosci", pl: "Potwierdź" },
  "inbox.escalate": { no: "Eskaler", en: "Escalate", de: "Eskalieren", fr: "Escalader", es: "Escalar", it: "Escalare", pl: "Eskaluj" },
  "inbox.resolve": { no: "Løs", en: "Resolve", de: "Lösen", fr: "Résoudre", es: "Resolver", it: "Risolvi", pl: "Rozwiąż" },
  "inbox.acknowledged": { no: "Kvittert", en: "Acknowledged", de: "Bestätigt", fr: "Accusé de réception", es: "Acusado de recibo", it: "Riconosciuto", pl: "Potwierdzono" },
  "inbox.escalated_status": { no: "Eskalert", en: "Escalated", de: "Eskaliert", fr: "Escaladé", es: "Escalado", it: "Escalato", pl: "Eskalowane" },
  "inbox.resolved": { no: "Løst", en: "Resolved", de: "Gelöst", fr: "Résolu", es: "Resuelto", it: "Risolto", pl: "Rozwiązane" },
  "inbox.bulk_campaign": { no: "Bulk-kampanje", en: "Bulk campaign", de: "Massenkampagne", fr: "Campagne en masse", es: "Campaña masiva", it: "Campagna di massa", pl: "Kampania masowa" },
  "inbox.conversations": { no: "Samtaler", en: "Conversations", de: "Unterhaltungen", fr: "Conversations", es: "Conversaciones", it: "Conversazioni", pl: "Rozmowy" },
  "inbox.read": { no: "Les", en: "Read", de: "Lesen", fr: "Lire", es: "Leer", it: "Leggi", pl: "Czytaj" },
  "inbox.move": { no: "Flytt", en: "Move", de: "Verschieben", fr: "Déplacer", es: "Mover", it: "Sposta", pl: "Przenieś" },
  "inbox.you": { no: "Du", en: "You", de: "Sie", fr: "Vous", es: "Tú", it: "Tu", pl: "Ty" },
  "inbox.write_reply": { no: "Skriv et svar...", en: "Write a reply...", de: "Schreiben Sie eine Antwort...", fr: "Écrivez une réponse...", es: "Escriba una respuesta...", it: "Scrivi una risposta...", pl: "Napisz odpowiedź..." },
  "inbox.day_ago": { no: "dag siden", en: "day ago", de: "Tag her", fr: "jour il y a", es: "día atrás", it: "giorno fa", pl: "dzień temu" },
  "inbox.no_conversations_found": { no: "Ingen samtaler funnet", en: "No conversations found", de: "Keine Unterhaltungen gefunden", fr: "Aucune conversation trouvée", es: "No se encontraron conversaciones", it: "Nessuna conversazione trovata", pl: "Nie znaleziono rozmów" },
  "inbox.unknown": { no: "Ukjent", en: "Unknown", de: "Unbekannt", fr: "Inconnu", es: "Desconocido", it: "Sconosciuto", pl: "Nieznany" },
  "inbox.no_subject": { no: "Ingen emne", en: "No subject", de: "Kein Betreff", fr: "Pas de sujet", es: "Sin asunto", it: "Nessun oggetto", pl: "Brak tematu" },
  "inbox.replies_appear_here": { no: "Svar fra mottakere vil dukke opp her.", en: "Replies from recipients will appear here.", de: "Antworten von Empfängern werden hier angezeigt.", fr: "Les réponses des destinataires apparaîtront ici.", es: "Las respuestas de los destinatarios aparecerán aquí.", it: "Le risposte dai destinatari appariranno qui.", pl: "Odpowiedzi od odbiorców pojawią się tutaj." },
  "inbox.select_for_reminder": { no: "Velg mottakere for påminnelse", en: "Select recipients for reminder", de: "Empfänger für Erinnerung auswählen", fr: "Sélectionner les destinataires pour le rappel", es: "Seleccionar destinatarios para recordatorio", it: "Seleziona destinatari per promemoria", pl: "Wybierz odbiorców do przypomnienia" },
  "inbox.send_reminder": { no: "Send påminnelse", en: "Send reminder", de: "Erinnerung senden", fr: "Envoyer un rappel", es: "Enviar recordatorio", it: "Invia promemoria", pl: "Wyślij przypomnienie" },
  "inbox.name": { no: "Navn", en: "Name", de: "Name", fr: "Nom", es: "Nombre", it: "Nome", pl: "Nazwa" },
  "inbox.phone": { no: "Telefon", en: "Phone", de: "Telefon", fr: "Téléphone", es: "Teléfono", it: "Telefono", pl: "Telefon" },
  "inbox.status": { no: "Status", en: "Status", de: "Status", fr: "Statut", es: "Estado", it: "Stato", pl: "Status" },
  "inbox.replied": { no: "Svart", en: "Replied", de: "Geantwortet", fr: "Répondu", es: "Respondido", it: "Risposto", pl: "Odpowiedział" },
  "inbox.not_replied": { no: "Ikke svart", en: "Not replied", de: "Nicht geantwortet", fr: "Pas répondu", es: "No respondido", it: "Non risposto", pl: "Nie odpowiedział" },
  "inbox.select_conversation": { no: "Velg en samtale", en: "Select a conversation", de: "Wählen Sie eine Unterhaltung", fr: "Sélectionnez une conversation", es: "Seleccione una conversación", it: "Seleziona una conversazione", pl: "Wybierz rozmowę" },
  "inbox.select_conversation_description": { no: "Velg en samtale fra listen til venstre for å se meldinger", en: "Select a conversation from the list on the left to view messages", de: "Wählen Sie eine Unterhaltung aus der Liste links, um Nachrichten anzuzeigen", fr: "Sélectionnez une conversation dans la liste à gauche pour voir les messages", es: "Seleccione una conversación de la lista de la izquierda para ver los mensajes", it: "Seleziona una conversazione dall'elenco a sinistra per visualizzare i messaggi", pl: "Wybierz rozmowę z listy po lewej stronie, aby wyświetlić wiadomości" },
  "inbox.no_messages_in_thread": { no: "Ingen meldinger i denne samtalen", en: "No messages in this thread", de: "Keine Nachrichten in diesem Thread", fr: "Aucun message dans ce fil", es: "Sin mensajes en este hilo", it: "Nessun messaggio in questo thread", pl: "Brak wiadomości w tym wątku" },
  "inbox.simulate_response": { no: "Simuler svar", en: "Simulate response", de: "Antwort simulieren", fr: "Simuler une réponse", es: "Simular respuesta", it: "Simula risposta", pl: "Symuluj odpowiedź" },
  "inbox.simulate_response_description": { no: "Simuler et innkommende svar fra denne kontakten", en: "Simulate an incoming reply from this contact", de: "Simulieren Sie eine eingehende Antwort von diesem Kontakt", fr: "Simuler une réponse entrante de ce contact", es: "Simular una respuesta entrante de este contacto", it: "Simula una risposta in arrivo da questo contatto", pl: "Symuluj przychodzącą odpowiedź od tego kontaktu" },
  "inbox.response_text": { no: "Svar-tekst", en: "Response text", de: "Antworttext", fr: "Texte de réponse", es: "Texto de respuesta", it: "Testo di risposta", pl: "Tekst odpowiedzi" },
  "inbox.type_simulated_reply": { no: "Skriv simulert svar...", en: "Type simulated reply...", de: "Simulierte Antwort eingeben...", fr: "Tapez la réponse simulée...", es: "Escriba la respuesta simulada...", it: "Digita risposta simulata...", pl: "Wpisz symulowaną odpowiedź..." },
  "inbox.simulate_reply": { no: "Simuler svar", en: "Simulate reply", de: "Antwort simulieren", fr: "Simuler une réponse", es: "Simular respuesta", it: "Simula risposta", pl: "Symuluj odpowiedź" },
  "inbox.reclassify_conversation": { no: "Omklassifiser samtale", en: "Reclassify conversation", de: "Unterhaltung neu klassifizieren", fr: "Reclasser la conversation", es: "Reclasificar conversación", it: "Riclassifica conversazione", pl: "Przeklasyfikuj rozmowę" },
  "inbox.reclassify_description": { no: "Flytt denne samtalen til en annen gruppe", en: "Move this conversation to another group", de: "Verschieben Sie diese Unterhaltung in eine andere Gruppe", fr: "Déplacer cette conversation vers un autre groupe", es: "Mover esta conversación a otro grupo", it: "Sposta questa conversazione in un altro gruppo", pl: "Przenieś tę rozmowę do innej grupy" },
  "inbox.select_target_group": { no: "Velg målgruppe", en: "Select target group", de: "Zielgruppe auswählen", fr: "Sélectionner le groupe cible", es: "Seleccionar grupo objetivo", it: "Seleziona gruppo target", pl: "Wybierz grupę docelową" },
  "inbox.reclassify": { no: "Omklassifiser", en: "Reclassify", de: "Neu klassifizieren", fr: "Reclasser", es: "Reclasificar", it: "Riclassifica", pl: "Przeklasyfikuj" },
  "inbox.send_reminder_dialog": { no: "Send påminnelse", en: "Send reminder", de: "Erinnerung senden", fr: "Envoyer un rappel", es: "Enviar recordatorio", it: "Invia promemoria", pl: "Wyślij przypomnienie" },
  "inbox.reminder_description": { no: "Send en påminnelse til valgte mottakere som ikke har svart", en: "Send a reminder to selected recipients who haven't replied", de: "Senden Sie eine Erinnerung an ausgewählte Empfänger, die nicht geantwortet haben", fr: "Envoyer un rappel aux destinataires sélectionnés qui n'ont pas répondu", es: "Enviar un recordatorio a los destinatarios seleccionados que no han respondido", it: "Invia un promemoria ai destinatari selezionati che non hanno risposto", pl: "Wyślij przypomnienie wybranym odbiorcom, którzy nie odpowiedzieli" },
  "inbox.reminder_message": { no: "Påminnelses-melding", en: "Reminder message", de: "Erinnerungsnachricht", fr: "Message de rappel", es: "Mensaje de recordatorio", it: "Messaggio di promemoria", pl: "Wiadomość przypomnienia" },
  "inbox.type_reminder": { no: "Skriv påminnelse...", en: "Type reminder...", de: "Erinnerung eingeben...", fr: "Tapez le rappel...", es: "Escriba el recordatorio...", it: "Digita promemoria...", pl: "Wpisz przypomnienie..." },
  "inbox.sending": { no: "Sender...", en: "Sending...", de: "Senden...", fr: "Envoi...", es: "Enviando...", it: "Invio...", pl: "Wysyłanie..." },

  // Contacts
  "contacts.title": { no: "Kontakter", en: "Contacts", de: "Kontakte", fr: "Contacts", es: "Contactos", it: "Contatti", pl: "Kontakty" },
  "contacts.subtitle": { no: "Administrer kontakter og grupper", en: "Manage contacts and groups", de: "Kontakte und Gruppen verwalten", fr: "Gérer les contacts et les groupes", es: "Gestionar contactos y grupos", it: "Gestisci contatti e gruppi", pl: "Zarządzaj kontaktami i grupami" },
  "contacts.search": { no: "Søk kontakter...", en: "Search contacts...", de: "Kontakte suchen...", fr: "Rechercher des contacts...", es: "Buscar contactos...", it: "Cerca contatti...", pl: "Szukaj kontaktów..." },
  "contacts.all_contacts": { no: "Alle kontakter", en: "All contacts", de: "Alle Kontakte", fr: "Tous les contacts", es: "Todos los contactos", it: "Tutti i contatti", pl: "Wszystkie kontakty" },
  "contacts.add_contact": { no: "Legg til kontakt", en: "Add contact", de: "Kontakt hinzufügen", fr: "Ajouter un contact", es: "Agregar contacto", it: "Aggiungi contatto", pl: "Dodaj kontakt" },
  "contacts.import_csv": { no: "Importer CSV", en: "Import CSV", de: "CSV importieren", fr: "Importer CSV", es: "Importar CSV", it: "Importa CSV", pl: "Importuj CSV" },
  "contacts.name": { no: "Navn", en: "Name", de: "Name", fr: "Nom", es: "Nombre", it: "Nome", pl: "Nazwa" },
  "contacts.phone": { no: "Telefon", en: "Phone", de: "Telefon", fr: "Téléphone", es: "Teléfono", it: "Telefono", pl: "Telefon" },
  "contacts.groups": { no: "Grupper", en: "Groups", de: "Gruppen", fr: "Groupes", es: "Grupos", it: "Gruppi", pl: "Grupy" },
  "contacts.actions": { no: "Handlinger", en: "Actions", de: "Aktionen", fr: "Actions", es: "Acciones", it: "Azioni", pl: "Akcje" },
  "contacts.edit": { no: "Rediger", en: "Edit", de: "Bearbeiten", fr: "Modifier", es: "Editar", it: "Modifica", pl: "Edytuj" },
  "contacts.delete": { no: "Slett", en: "Delete", de: "Löschen", fr: "Supprimer", es: "Eliminar", it: "Elimina", pl: "Usuń" },
  "contacts.new_contact": { no: "Ny kontakt", en: "New contact", de: "Neuer Kontakt", fr: "Nouveau contact", es: "Nuevo contacto", it: "Nuovo contatto", pl: "Nowy kontakt" },
  "contacts.edit_contact": { no: "Rediger kontakt", en: "Edit contact", de: "Kontakt bearbeiten", fr: "Modifier le contact", es: "Editar contacto", it: "Modifica contatto", pl: "Edytuj kontakt" },
  "contacts.full_name": { no: "Fullt navn", en: "Full name", de: "Vollständiger Name", fr: "Nom complet", es: "Nombre completo", it: "Nome completo", pl: "Pełna nazwa" },
  "contacts.phone_number": { no: "Telefonnummer", en: "Phone number", de: "Telefonnummer", fr: "Numéro de téléphone", es: "Número de teléfono", it: "Numero di telefono", pl: "Numer telefonu" },
  "contacts.select_groups": { no: "Velg grupper", en: "Select groups", de: "Gruppen auswählen", fr: "Sélectionner des groupes", es: "Seleccionar grupos", it: "Seleziona gruppi", pl: "Wybierz grupy" },
  "contacts.cancel": { no: "Avbryt", en: "Cancel", de: "Abbrechen", fr: "Annuler", es: "Cancelar", it: "Annulla", pl: "Anuluj" },
  "contacts.save": { no: "Lagre", en: "Save", de: "Speichern", fr: "Enregistrer", es: "Guardar", it: "Salva", pl: "Zapisz" },
  "contacts.import_title": { no: "Importer kontakter fra CSV", en: "Import contacts from CSV", de: "Kontakte aus CSV importieren", fr: "Importer des contacts depuis CSV", es: "Importar contactos desde CSV", it: "Importa contatti da CSV", pl: "Importuj kontakty z CSV" },
  "contacts.csv_format": { no: "CSV-format: navn,telefon,grupper", en: "CSV format: name,phone,groups", de: "CSV-Format: Name,Telefon,Gruppen", fr: "Format CSV: nom,téléphone,groupes", es: "Formato CSV: nombre,teléfono,grupos", it: "Formato CSV: nome,telefono,gruppi", pl: "Format CSV: nazwa,telefon,grupy" },
  "contacts.drop_file": { no: "Slipp CSV-fil her eller klikk for å laste opp", en: "Drop CSV file here or click to upload", de: "CSV-Datei hier ablegen oder zum Hochladen klicken", fr: "Déposez le fichier CSV ici ou cliquez pour télécharger", es: "Suelte el archivo CSV aquí o haga clic para cargar", it: "Rilascia il file CSV qui o fai clic per caricare", pl: "Upuść plik CSV tutaj lub kliknij, aby przesłać" },
  "contacts.upload": { no: "Last opp", en: "Upload", de: "Hochladen", fr: "Télécharger", es: "Cargar", it: "Carica", pl: "Prześlij" },
  "contacts.delete_confirm": { no: "Er du sikker på at du vil slette denne kontakten?", en: "Are you sure you want to delete this contact?", de: "Möchten Sie diesen Kontakt wirklich löschen?", fr: "Êtes-vous sûr de vouloir supprimer ce contact?", es: "¿Está seguro de que desea eliminar este contacto?", it: "Sei sicuro di voler eliminare questo contatto?", pl: "Czy na pewno chcesz usunąć ten kontakt?" },
  "contacts.email": { no: "E-post", en: "Email", de: "E-Mail", fr: "E-mail", es: "Correo electrónico", it: "E-mail", pl: "E-mail" },

  // Sending
  "sending.title": { no: "Send Melding", en: "Send Message", de: "Nachricht senden", fr: "Envoyer un message", es: "Enviar mensaje", it: "Invia messaggio", pl: "Wyślij wiadomość" },
  "sending.subtitle": { no: "Send meldinger til grupper eller individuelle kontakter", en: "Send messages to groups or individual contacts", de: "Nachrichten an Gruppen oder einzelne Kontakte senden", fr: "Envoyer des messages à des groupes ou des contacts individuels", es: "Enviar mensajes a grupos o contactos individuales", it: "Invia messaggi a gruppi o contatti individuali", pl: "Wysyłaj wiadomości do grup lub indywidualnych kontaktów" },
  "sending.compose": { no: "Skriv melding", en: "Compose message", de: "Nachricht verfassen", fr: "Rédiger un message", es: "Redactar mensaje", it: "Componi messaggio", pl: "Utwórz wiadomość" },
  "sending.to": { no: "Til", en: "To", de: "An", fr: "À", es: "Para", it: "A", pl: "Do" },
  "sending.select_recipients": { no: "Velg mottakere", en: "Select recipients", de: "Empfänger auswählen", fr: "Sélectionner des destinataires", es: "Seleccionar destinatarios", it: "Seleziona destinatari", pl: "Wybierz odbiorców" },
  "sending.groups": { no: "Grupper", en: "Groups", de: "Gruppen", fr: "Groupes", es: "Grupos", it: "Gruppi", pl: "Grupy" },
  "sending.contacts": { no: "Kontakter", en: "Contacts", de: "Kontakte", fr: "Contacts", es: "Contactos", it: "Contatti", pl: "Kontakty" },
  "sending.message": { no: "Melding", en: "Message", de: "Nachricht", fr: "Message", es: "Mensaje", it: "Messaggio", pl: "Wiadomość" },
  "sending.type_your_message": { no: "Skriv meldingen din her...", en: "Type your message here...", de: "Geben Sie Ihre Nachricht hier ein...", fr: "Tapez votre message ici...", es: "Escriba su mensaje aquí...", it: "Digita il tuo messaggio qui...", pl: "Wpisz swoją wiadomość tutaj..." },
  "sending.send_message": { no: "Send melding", en: "Send message", de: "Nachricht senden", fr: "Envoyer le message", es: "Enviar mensaje", it: "Invia messaggio", pl: "Wyślij wiadomość" },
  "sending.characters": { no: "tegn", en: "characters", de: "Zeichen", fr: "caractères", es: "caracteres", it: "caratteri", pl: "znaków" },
  "sending.enable_bulk": { no: "Aktiver bulk-sending", en: "Enable bulk sending", de: "Massenversand aktivieren", fr: "Activer l'envoi en masse", es: "Habilitar envío masivo", it: "Abilita invio di massa", pl: "Włącz wysyłanie masowe" },
  "sending.bulk_subject": { no: "Emne/Overskrift", en: "Subject", de: "Betreff", fr: "Sujet", es: "Asunto", it: "Oggetto", pl: "Temat" },
  "sending.bulk_subject_placeholder": { no: "F.eks. Møteinnkalling, Påminnelse, etc.", en: "E.g. Meeting invite, Reminder, etc.", de: "z.B. Einladung, Erinnerung, usw.", fr: "Ex. Invitation, Rappel, etc.", es: "Ej. Invitación, Recordatorio, etc.", it: "Es. Invito, Promemoria, ecc.", pl: "Np. Zaproszenie, Przypomnienie, itp." },
  "sending.reply_window": { no: "Svar-vindu", en: "Reply window", de: "Antwortfenster", fr: "Fenêtre de réponse", es: "Ventana de respuesta", it: "Finestra di risposta", pl: "Okno odpowiedzi" },
  "sending.hours": { no: "timer", en: "hours", de: "Stunden", fr: "heures", es: "horas", it: "ore", pl: "godziny" },
  "sending.reply_window_help": { no: "Svar innen denne tiden kobles automatisk til denne utsendelsen. Ved purring utvides fristen fra nytt sendetidspunkt.", en: "Replies within this time are automatically linked to this campaign. For reminders, the deadline is extended from the new send time.", de: "Antworten innerhalb dieser Zeit werden automatisch mit dieser Kampagne verknüpft.", fr: "Les réponses dans ce délai sont automatiquement liées à cette campagne.", es: "Las respuestas dentro de este tiempo se vinculan automáticamente a esta campaña.", it: "Le risposte entro questo tempo sono collegate automaticamente a questa campagna.", pl: "Odpowiedzi w tym czasie są automatycznie łączone z tą kampanią." },
  "sending.bulk_info": { no: "Alle svar innen valgt tidsvindu kobles automatisk til denne utsendelsen.", en: "All replies within the selected time window are automatically linked to this campaign.", de: "Alle Antworten innerhalb des gewählten Zeitfensters werden automatisch mit dieser Kampagne verknüpft.", fr: "Toutes les réponses dans la fenêtre de temps sélectionnée sont automatiquement liées à cette campagne.", es: "Todas las respuestas dentro de la ventana de tiempo seleccionada se vinculan automáticamente a esta campaña.", it: "Tutte le risposte entro la finestra temporale selezionata sono collegate automaticamente a questa campagna.", pl: "Wszystkie odpowiedzi w wybranym oknie czasowym są automatycznie łączone z tą kampanią." },
  "sending.send_sms": { no: "Send SMS", en: "Send SMS", de: "SMS senden", fr: "Envoyer SMS", es: "Enviar SMS", it: "Invia SMS", pl: "Wyślij SMS" },
  "sending.send_messages_description": { no: "Send meldinger til enkeltpersoner, grupper eller kontakter", en: "Send messages to individuals, groups or contacts", de: "Nachrichten an Einzelpersonen, Gruppen oder Kontakte senden", fr: "Envoyer des messages à des personnes, des groupes ou des contacts", es: "Enviar mensajes a personas, grupos o contactos", it: "Invia messaggi a singoli, gruppi o contatti", pl: "Wysyłaj wiadomości do osób, grup lub kontaktów" },
  "sending.send_from_group": { no: "Send fra gruppe:", en: "Send from group:", de: "Von Gruppe senden:", fr: "Envoyer depuis le groupe:", es: "Enviar desde grupo:", it: "Invia dal gruppo:", pl: "Wyślij z grupy:" },
  "sending.group_help_text": { no: "Meldinger sendes fra denne gruppens nummer og lagres i gruppens innboks", en: "Messages are sent from this group's number and stored in the group's inbox", de: "Nachrichten werden von der Nummer dieser Gruppe gesendet und im Posteingang der Gruppe gespeichert", fr: "Les messages sont envoyés depuis le numéro de ce groupe et stockés dans la boîte de réception du groupe", es: "Los mensajes se envían desde el número de este grupo y se almacenan en la bandeja de entrada del grupo", it: "I messaggi vengono inviati dal numero di questo gruppo e memorizzati nella casella di posta del gruppo", pl: "Wiadomości są wysyłane z numeru tej grupy i przechowywane w skrzynce odbiorczej grupy" },
  "sending.bulk_to_group": { no: "Bulk til gruppe", en: "Bulk to group", de: "Massenversand an Gruppe", fr: "Envoi en masse au groupe", es: "Envío masivo al grupo", it: "Invio di massa al gruppo", pl: "Wysyłka masowa do grupy" },
  "sending.single_message": { no: "Enkeltmelding", en: "Single message", de: "Einzelnachricht", fr: "Message unique", es: "Mensaje único", it: "Messaggio singolo", pl: "Pojedyncza wiadomość" },
  "sending.legacy_group": { no: "(Gammel) Gruppe", en: "(Legacy) Group", de: "(Alt) Gruppe", fr: "(Ancien) Groupe", es: "(Antiguo) Grupo", it: "(Legacy) Gruppo", pl: "(Stary) Grupa" },
  "sending.send_to_individual": { no: "Send til enkeltperson", en: "Send to individual", de: "An Einzelperson senden", fr: "Envoyer à une personne", es: "Enviar a individuo", it: "Invia a singolo", pl: "Wyślij do osoby" },
  "sending.send_to_phone_description": { no: "Send en melding til ett telefonnummer.", en: "Send a message to one phone number.", de: "Senden Sie eine Nachricht an eine Telefonnummer.", fr: "Envoyez un message à un numéro de téléphone.", es: "Envíe un mensaje a un número de teléfono.", it: "Invia un messaggio a un numero di telefono.", pl: "Wyślij wiadomość na jeden numer telefonu." },
  "sending.recipient_phone": { no: "Mottakers telefonnummer", en: "Recipient's phone number", de: "Telefonnummer des Empfängers", fr: "Numéro de téléphone du destinataire", es: "Número de teléfono del destinatario", it: "Numero di telefono del destinatario", pl: "Numer telefonu odbiorcy" },
  "sending.search_contact": { no: "Søk kontakt...", en: "Search contact...", de: "Kontakt suchen...", fr: "Rechercher un contact...", es: "Buscar contacto...", it: "Cerca contatto...", pl: "Szukaj kontaktu..." },
  "sending.write_message_here": { no: "Skriv din melding her...", en: "Write your message here...", de: "Schreiben Sie Ihre Nachricht hier...", fr: "Écrivez votre message ici...", es: "Escriba su mensaje aquí...", it: "Scrivi il tuo messaggio qui...", pl: "Napisz swoją wiadomość tutaj..." },
  "sending.select_recipients_first": { no: "Velg mottakere først", en: "Select recipients first", de: "Wählen Sie zuerst Empfänger aus", fr: "Sélectionnez d'abord les destinataires", es: "Seleccione primero los destinatarios", it: "Seleziona prima i destinatari", pl: "Najpierw wybierz odbiorców" },
  "sending.who_should_receive": { no: "Hvem skal motta meldingen?", en: "Who should receive the message?", de: "Wer soll die Nachricht erhalten?", fr: "Qui doit recevoir le message?", es: "¿Quién debe recibir el mensaje?", it: "Chi dovrebbe ricevere il messaggio?", pl: "Kto powinien otrzymać wiadomość?" },
  "sending.recipient_selection_description": { no: "Velg alle som skal motta meldingen.", en: "Select everyone who should receive the message.", de: "Wählen Sie alle aus, die die Nachricht erhalten sollen.", fr: "Sélectionnez toutes les personnes qui doivent recevoir le message.", es: "Seleccione a todos los que deben recibir el mensaje.", it: "Seleziona tutti coloro che devono ricevere il messaggio.", pl: "Wybierz wszystkich, którzy powinni otrzymać wiadomość." },
  "sending.select_all": { no: "Velg alle", en: "Select all", de: "Alle auswählen", fr: "Tout sélectionner", es: "Seleccionar todo", it: "Seleziona tutto", pl: "Zaznacz wszystko" },
  "sending.compose_message": { no: "Utform melding", en: "Compose message", de: "Nachricht verfassen", fr: "Rédiger un message", es: "Redactar mensaje", it: "Componi messaggio", pl: "Utwórz wiadomość" },
  "sending.sms_count": { no: "SMS", en: "SMS", de: "SMS", fr: "SMS", es: "SMS", it: "SMS", pl: "SMS" },
  "sending.send_to_group": { no: "Send til Gruppe", en: "Send to Group", de: "An Gruppe senden", fr: "Envoyer au groupe", es: "Enviar al grupo", it: "Invia al gruppo", pl: "Wyślij do grupy" },
  "sending.send_to_group_description": { no: "Send en melding til alle medlemmer i en valgt gruppe.", en: "Send a message to all members of a selected group.", de: "Senden Sie eine Nachricht an alle Mitglieder einer ausgewählten Gruppe.", fr: "Envoyez un message à tous les membres d'un groupe sélectionné.", es: "Envíe un mensaje a todos los miembros de un grupo seleccionado.", it: "Invia un messaggio a tutti i membri di un gruppo selezionato.", pl: "Wyślij wiadomość do wszystkich członków wybranej grupy." },
  "sending.select_group": { no: "Velg gruppe", en: "Select group", de: "Gruppe auswählen", fr: "Sélectionner un groupe", es: "Seleccionar grupo", it: "Seleziona gruppo", pl: "Wybierz grupę" },
  "sending.send_to_contacts": { no: "Send til Kontakter", en: "Send to Contacts", de: "An Kontakte senden", fr: "Envoyer aux contacts", es: "Enviar a contactos", it: "Invia a contatti", pl: "Wyślij do kontaktów" },
  "sending.send_to_contacts_description": { no: "Velg individuelle kontakter fra kontaktlisten.", en: "Select individual contacts from the contact list.", de: "Wählen Sie einzelne Kontakte aus der Kontaktliste aus.", fr: "Sélectionnez des contacts individuels dans la liste de contacts.", es: "Seleccione contactos individuales de la lista de contactos.", it: "Seleziona contatti individuali dall'elenco contatti.", pl: "Wybierz indywidualne kontakty z listy kontaktów." },
  "sending.selected_contacts": { no: "kontakt(er) valgt", en: "contact(s) selected", de: "Kontakt(e) ausgewählt", fr: "contact(s) sélectionné(s)", es: "contacto(s) seleccionado(s)", it: "contatto(i) selezionato(i)", pl: "kontakt(y) wybrany(e)" },

  // Settings
  "settings.title": { no: "Innstillinger", en: "Settings", de: "Einstellungen", fr: "Paramètres", es: "Configuración", it: "Impostazioni", pl: "Ustawienia" },
  "settings.description": { no: "Administrer systeminnstillinger og preferanser", en: "Manage system settings and preferences", de: "Systemeinstellungen und Präferenzen verwalten", fr: "Gérer les paramètres et préférences du système", es: "Gestionar configuraciones y preferencias del sistema", it: "Gestisci impostazioni e preferenze del sistema", pl: "Zarządzaj ustawieniami systemowymi i preferencjami" },
  "settings.tabs.hours": { no: "Åpningstider", en: "Hours", de: "Öffnungszeiten", fr: "Heures", es: "Horarios", it: "Orari", pl: "Godziny" },
  "settings.tabs.replies": { no: "Svar", en: "Replies", de: "Antworten", fr: "Réponses", es: "Respuestas", it: "Risposte", pl: "Odpowiedzi" },
  "settings.tabs.notifications": { no: "Varsler", en: "Notifications", de: "Benachrichtigungen", fr: "Notifications", es: "Notificaciones", it: "Notifiche", pl: "Powiadomienia" },
  "settings.tabs.routing": { no: "Ruting", en: "Routing", de: "Routing", fr: "Routage", es: "Enrutamiento", it: "Routing", pl: "Routing" },
  "settings.hours_description": { no: "Konfigurer åpningstider for hver gruppe", en: "Configure opening hours for each group", de: "Öffnungszeiten für jede Gruppe konfigurieren", fr: "Configurer les heures d'ouverture pour chaque groupe", es: "Configurar horarios de apertura para cada grupo", it: "Configura gli orari di apertura per ogni gruppo", pl: "Skonfiguruj godziny otwarcia dla każdej grupy" },
  "settings.select_group": { no: "Velg gruppe", en: "Select group", de: "Gruppe auswählen", fr: "Sélectionner un groupe", es: "Seleccionar grupo", it: "Seleziona gruppo", pl: "Wybierz grupę" },
  "settings.weekly_schedule": { no: "Ukentlig timeplan", en: "Weekly schedule", de: "Wochenplan", fr: "Horaire hebdomadaire", es: "Horario semanal", it: "Programma settimanale", pl: "Harmonogram tygodniowy" },
  "settings.from": { no: "Fra", en: "From", de: "Von", fr: "De", es: "Desde", it: "Da", pl: "Od" },
  "settings.to": { no: "Til", en: "To", de: "Bis", fr: "À", es: "Hasta", it: "A", pl: "Do" },
  "settings.open": { no: "Åpen", en: "Open", de: "Geöffnet", fr: "Ouvert", es: "Abierto", it: "Aperto", pl: "Otwarte" },
  "settings.closed": { no: "Stengt", en: "Closed", de: "Geschlossen", fr: "Fermé", es: "Cerrado", it: "Chiuso", pl: "Zamknięte" },
  "settings.save_hours": { no: "Lagre åpningstider", en: "Save hours", de: "Öffnungszeiten speichern", fr: "Enregistrer les heures", es: "Guardar horarios", it: "Salva orari", pl: "Zapisz godziny" },
  "settings.hours_saved": { no: "Åpningstider lagret", en: "Hours saved", de: "Öffnungszeiten gespeichert", fr: "Heures enregistrées", es: "Horarios guardados", it: "Orari salvati", pl: "Godziny zapisane" },
  
  // Days of week
  "days.monday": { no: "Mandag", en: "Monday", de: "Montag", fr: "Lundi", es: "Lunes", it: "Lunedì", pl: "Poniedziałek" },
  "days.tuesday": { no: "Tirsdag", en: "Tuesday", de: "Dienstag", fr: "Mardi", es: "Martes", it: "Martedì", pl: "Wtorek" },
  "days.wednesday": { no: "Onsdag", en: "Wednesday", de: "Mittwoch", fr: "Mercredi", es: "Miércoles", it: "Mercoledì", pl: "Środa" },
  "days.thursday": { no: "Torsdag", en: "Thursday", de: "Donnerstag", fr: "Jeudi", es: "Jueves", it: "Giovedì", pl: "Czwartek" },
  "days.friday": { no: "Fredag", en: "Friday", de: "Freitag", fr: "Vendredi", es: "Viernes", it: "Venerdì", pl: "Piątek" },
  "days.saturday": { no: "Lørdag", en: "Saturday", de: "Samstag", fr: "Samedi", es: "Sábado", it: "Sabato", pl: "Sobota" },
  "days.sunday": { no: "Søndag", en: "Sunday", de: "Sonntag", fr: "Dimanche", es: "Domingo", it: "Domenica", pl: "Niedziela" },

  // Admin
  "admin.title": { no: "Administrasjon", en: "Administration", de: "Verwaltung", fr: "Administration", es: "Administración", it: "Amministrazione", pl: "Administracja" },
  "admin.description": { no: "Administrer grupper, brukere og gateways", en: "Manage groups, users and gateways", de: "Gruppen, Benutzer und Gateways verwalten", fr: "Gérer les groupes, utilisateurs et passerelles", es: "Gestionar grupos, usuarios y gateways", it: "Gestisci gruppi, utenti e gateway", pl: "Zarządzaj grupami, użytkownikami i bramami" },
  "admin.tabs.groups": { no: "Grupper", en: "Groups", de: "Gruppen", fr: "Groupes", es: "Grupos", it: "Gruppi", pl: "Grupy" },
  "admin.tabs.users": { no: "Brukere", en: "Users", de: "Benutzer", fr: "Utilisateurs", es: "Usuarios", it: "Utenti", pl: "Użytkownicy" },
  "admin.tabs.gateways": { no: "Gateways", en: "Gateways", de: "Gateways", fr: "Passerelles", es: "Gateways", it: "Gateway", pl: "Bramy" },
  "admin.group_name": { no: "Gruppenavn", en: "Group name", de: "Gruppenname", fr: "Nom du groupe", es: "Nombre del grupo", it: "Nome gruppo", pl: "Nazwa grupy" },
  "admin.gateway": { no: "Gateway", en: "Gateway", de: "Gateway", fr: "Passerelle", es: "Gateway", it: "Gateway", pl: "Brama" },
  "admin.on_duty": { no: "På vakt", en: "On duty", de: "Im Dienst", fr: "De garde", es: "De guardia", it: "In servizio", pl: "Na dyżurze" },
  "admin.total": { no: "Totalt", en: "Total", de: "Gesamt", fr: "Total", es: "Total", it: "Totale", pl: "Razem" },
  "admin.parent": { no: "Overgruppe", en: "Parent", de: "Übergruppe", fr: "Groupe parent", es: "Grupo padre", it: "Gruppo padre", pl: "Grupa nadrzędna" },
  "admin.actions": { no: "Handlinger", en: "Actions", de: "Aktionen", fr: "Actions", es: "Acciones", it: "Azioni", pl: "Akcje" },
  "admin.no_groups": { no: "Ingen grupper opprettet ennå", en: "No groups created yet", de: "Noch keine Gruppen erstellt", fr: "Aucun groupe créé pour l'instant", es: "Aún no se han creado grupos", it: "Nessun gruppo creato ancora", pl: "Nie utworzono jeszcze grup" },
  "admin.create_group": { no: "Opprett gruppe", en: "Create group", de: "Gruppe erstellen", fr: "Créer un groupe", es: "Crear grupo", it: "Crea gruppo", pl: "Utwórz grupę" },
  "admin.active_user": { no: "Aktiv bruker", en: "Active user", de: "Aktiver Benutzer", fr: "Utilisateur actif", es: "Usuario activo", it: "Utente attivo", pl: "Aktywny użytkownik" },
  "admin.edit": { no: "Rediger", en: "Edit", de: "Bearbeiten", fr: "Modifier", es: "Editar", it: "Modifica", pl: "Edytuj" },
  "admin.delete": { no: "Slett", en: "Delete", de: "Löschen", fr: "Supprimer", es: "Eliminar", it: "Elimina", pl: "Usuń" },
  "admin.add_user": { no: "Legg til bruker", en: "Add user", de: "Benutzer hinzufügen", fr: "Ajouter un utilisateur", es: "Agregar usuario", it: "Aggiungi utente", pl: "Dodaj użytkownika" },
  "admin.user_name": { no: "Brukernavn", en: "User name", de: "Benutzername", fr: "Nom d'utilisateur", es: "Nombre de usuario", it: "Nome utente", pl: "Nazwa użytkownika" },
  "admin.email": { no: "E-post", en: "Email", de: "E-Mail", fr: "E-mail", es: "Correo electrónico", it: "E-mail", pl: "E-mail" },
  "admin.role": { no: "Rolle", en: "Role", de: "Rolle", fr: "Rôle", es: "Rol", it: "Ruolo", pl: "Rola" },
  "admin.groups": { no: "Grupper", en: "Groups", de: "Gruppen", fr: "Groupes", es: "Grupos", it: "Gruppi", pl: "Grupy" },
  "admin.status": { no: "Status", en: "Status", de: "Status", fr: "Statut", es: "Estado", it: "Stato", pl: "Status" },
  "admin.no_users": { no: "Ingen brukere opprettet ennå", en: "No users created yet", de: "Noch keine Benutzer erstellt", fr: "Aucun utilisateur créé pour l'instant", es: "Aún no se han creado usuarios", it: "Nessun utente creato ancora", pl: "Nie utworzono jeszcze użytkowników" },
  "admin.add_gateway": { no: "Legg til gateway", en: "Add gateway", de: "Gateway hinzufügen", fr: "Ajouter une passerelle", es: "Agregar gateway", it: "Aggiungi gateway", pl: "Dodaj bramę" },
  "admin.gateway_name": { no: "Gateway-navn", en: "Gateway name", de: "Gateway-Name", fr: "Nom de la passerelle", es: "Nombre del gateway", it: "Nome gateway", pl: "Nazwa bramy" },
  "admin.phone": { no: "Telefon", en: "Phone", de: "Telefon", fr: "Téléphone", es: "Teléfono", it: "Telefono", pl: "Telefon" },
  "admin.default": { no: "Standard", en: "Default", de: "Standard", fr: "Par défaut", es: "Predeterminado", it: "Predefinito", pl: "Domyślny" },
  "admin.no_gateways": { no: "Ingen gateways opprettet ennå", en: "No gateways created yet", de: "Noch keine Gateways erstellt", fr: "Aucune passerelle créée pour l'instant", es: "Aún no se han creado gateways", it: "Nessun gateway creato ancora", pl: "Nie utworzono jeszcze bram" },
  "admin.new_group": { no: "Ny gruppe", en: "New group", de: "Neue Gruppe", fr: "Nouveau groupe", es: "Nuevo grupo", it: "Nuovo gruppo", pl: "Nowa grupa" },
  "admin.edit_group": { no: "Rediger gruppe", en: "Edit group", de: "Gruppe bearbeiten", fr: "Modifier le groupe", es: "Editar grupo", it: "Modifica gruppo", pl: "Edytuj grupę" },
  "admin.group_details": { no: "Gruppedetaljer", en: "Group details", de: "Gruppendetails", fr: "Détails du groupe", es: "Detalles del grupo", it: "Dettagli gruppo", pl: "Szczegóły grupy" },
  "admin.name": { no: "Navn", en: "Name", de: "Name", fr: "Nom", es: "Nombre", it: "Nome", pl: "Nazwa" },
  "admin.parent_group": { no: "Overgruppe", en: "Parent group", de: "Übergruppe", fr: "Groupe parent", es: "Grupo padre", it: "Gruppo padre", pl: "Grupa nadrzędna" },
  "admin.select_parent": { no: "Velg overgruppe", en: "Select parent", de: "Übergruppe auswählen", fr: "Sélectionner le groupe parent", es: "Seleccionar grupo padre", it: "Seleziona gruppo padre", pl: "Wybierz grupę nadrzędną" },
  "admin.select_gateway": { no: "Velg gateway", en: "Select gateway", de: "Gateway auswählen", fr: "Sélectionner la passerelle", es: "Seleccionar gateway", it: "Seleziona gateway", pl: "Wybierz bramę" },
  "admin.fallback_group": { no: "Fallback-gruppe", en: "Fallback group", de: "Fallback-Gruppe", fr: "Groupe de secours", es: "Grupo de reserva", it: "Gruppo di fallback", pl: "Grupa zapasowa" },
  "admin.select_fallback": { no: "Velg fallback-gruppe", en: "Select fallback", de: "Fallback auswählen", fr: "Sélectionner le groupe de secours", es: "Seleccionar grupo de reserva", it: "Seleziona fallback", pl: "Wybierz grupę zapasową" },
  "admin.cancel": { no: "Avbryt", en: "Cancel", de: "Abbrechen", fr: "Annuler", es: "Cancelar", it: "Annulla", pl: "Anuluj" },
  "admin.save": { no: "Lagre", en: "Save", de: "Speichern", fr: "Enregistrer", es: "Guardar", it: "Salva", pl: "Zapisz" },
  "admin.create": { no: "Opprett", en: "Create", de: "Erstellen", fr: "Créer", es: "Crear", it: "Crea", pl: "Utwórz" },

  // Login
  "login.description": { no: "Logg inn for å få tilgang til SeMSe", en: "Log in to access SeMSe", de: "Melden Sie sich an, um auf SeMSe zuzugreifen", fr: "Connectez-vous pour accéder à SeMSe", es: "Inicie sesión para acceder a SeMSe", it: "Accedi per accedere a SeMSe", pl: "Zaloguj się, aby uzyskać dostęp do SeMSe" },
  "login.email_placeholder": { no: "din@epost.no", en: "your@email.com", de: "ihre@email.de", fr: "votre@email.fr", es: "tu@email.es", it: "tuo@email.it", pl: "twoj@email.pl" },
  "login.password_placeholder": { no: "Skriv inn passord", en: "Enter password", de: "Passwort eingeben", fr: "Entrez le mot de passe", es: "Ingrese contraseña", it: "Inserisci password", pl: "Wprowadź hasło" },
  "login.button": { no: "Logg inn", en: "Log in", de: "Anmelden", fr: "Se connecter", es: "Iniciar sesión", it: "Accedi", pl: "Zaloguj się" },
  "login.logging_in": { no: "Logger inn...", en: "Logging in...", de: "Anmelden...", fr: "Connexion...", es: "Iniciando sesión...", it: "Accesso...", pl: "Logowanie..." },
  "login.no_account": { no: "Har du ikke konto? Kontakt administrator", en: "Don't have an account? Contact administrator", de: "Haben Sie kein Konto? Kontaktieren Sie den Administrator", fr: "Vous n'avez pas de compte? Contactez l'administrateur", es: "¿No tienes cuenta? Contacta al administrador", it: "Non hai un account? Contatta l'amministratore", pl: "Nie masz konta? Skontaktuj się z administratorem" },
  "login.forgot_password": { no: "Glemt passord? Kontakt administrator", en: "Forgot password? Contact administrator", de: "Passwort vergessen? Kontaktieren Sie den Administrator", fr: "Mot de passe oublié? Contactez l'administrateur", es: "¿Olvidó su contraseña? Contacte al administrador", it: "Password dimenticata? Contatta l'amministratore", pl: "Zapomniałeś hasła? Skontaktuj się z administratorem" },

  // Errors
  "error.generic": { no: "En feil oppstod. Prøv igjen.", en: "An error occurred. Please try again.", de: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.", fr: "Une erreur s'est produite. Veuillez réessayer.", es: "Ocurrió un error. Por favor, inténtelo de nuevo.", it: "Si è verificato un errore. Riprova.", pl: "Wystąpił błąd. Spróbuj ponownie." },
  "error.email_not_confirmed": { no: "E-posten er ikke bekreftet. Sjekk innboksen din.", en: "Email not confirmed. Check your inbox.", de: "E-Mail nicht bestätigt. Überprüfen Sie Ihren Posteingang.", fr: "E-mail non confirmé. Vérifiez votre boîte de réception.", es: "Correo electrónico no confirmado. Revise su bandeja de entrada.", it: "Email non confermata. Controlla la tua casella di posta.", pl: "E-mail nie został potwierdzony. Sprawdź swoją skrzynkę odbiorczą." },
  "error.invalid_credentials": { no: "Ugyldig e-post eller passord", en: "Invalid email or password", de: "Ungültige E-Mail oder Passwort", fr: "E-mail ou mot de passe invalide", es: "Correo electrónico o contraseña no válidos", it: "Email o password non validi", pl: "Nieprawidłowy e-mail lub hasło" },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("no");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLang = localStorage.getItem("language") as Language;
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const t = (key: string) => {
    // CRITICAL: Always return key on server AND before client mount
    // This prevents hydration mismatches
    if (typeof window === "undefined" || !mounted) {
      return key;
    }
    
    // Only translate after component has mounted on client
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};