import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "no" | "en" | "de" | "fr" | "es" | "it" | "pl" | "sv";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<string, Record<Language, string>> = {
  "nav.home": { no: "Hjem", en: "Home", de: "Startseite", fr: "Accueil", es: "Inicio", it: "Home", pl: "Strona główna" },
  "nav.inbox": { no: "Innboks", en: "Inbox", de: "Posteingang", fr: "Boîte de réception", es: "Bandeja de entrada", it: "Posta in arrivo", pl: "Skrzynka odbiorcza" },
  "nav.contacts": { no: "Kontakter", en: "Contacts", de: "Kontakte", fr: "Contacts", es: "Contactos", it: "Contatti", pl: "Kontakty" },
  "nav.sending": { no: "Send Melding", en: "Send Message", de: "Nachricht senden", fr: "Envoyer un message", es: "Enviar mensaje", it: "Invia messaggio", pl: "Wyślij wiadomość" },
  "nav.simulate": { no: "Simuler", en: "Simulate", de: "Simulieren", fr: "Simuler", es: "Simular", it: "Simula", pl: "Symuluj" },
  "nav.print_to_sms": { no: "Print-to-SMS", en: "Print-to-SMS", de: "Print-to-SMS", fr: "Print-to-SMS", es: "Print-to-SMS", it: "Print-to-SMS", pl: "Print-to-SMS" },
  "nav.admin": { no: "Admin", en: "Admin", de: "Admin", fr: "Admin", es: "Admin", it: "Admin", pl: "Admin" },
  "nav.settings": { no: "Innstillinger", en: "Settings", de: "Einstellungen", fr: "Paramètres", es: "Configuración", it: "Impostazioni", pl: "Ustawienia" },
  
  "home.title": { no: "Velkommen til SeMSe 2.0", en: "Welcome to SeMSe 2.0", de: "Willkommen bei SeMSe 2.0", fr: "Bienvenue sur SeMSe 2.0", es: "Bienvenido a SeMSe 2.0", it: "Benvenuto in SeMSe 2.0", pl: "Witamy w SeMSe 2.0" },
  "home.subtitle": { no: "Smart meldingshåndtering for skoler", en: "Smart messaging for schools", de: "Intelligentes Messaging für Schulen", fr: "Messagerie intelligente pour les écoles", es: "Mensajería inteligente para escuelas", it: "Messaggistica intelligente per le scuole", pl: "Inteligentna komunikacja dla szkół" },
  
  "inbox.title": { no: "Samtaler", en: "Conversations", de: "Unterhaltungen", fr: "Conversations", es: "Conversaciones", it: "Conversazioni", pl: "Rozmowy" },
  "inbox.subtitle": { no: "Håndter meldinger fra dine grupper.", en: "Manage messages from your groups.", de: "Verwalten Sie Nachrichten von Ihren Gruppen.", fr: "Gérez les messages de vos groupes.", es: "Gestione los mensajes de sus grupos.", it: "Gestisci i messaggi dai tuoi gruppi.", pl: "Zarządzaj wiadomościami ze swoich grup." },
  "inbox.all_threads": { no: "Alle samtaler", en: "All threads", de: "Alle Threads", fr: "Tous les fils", es: "Todos los hilos", it: "Tutti i thread", pl: "Wszystkie wątki" },
  "inbox.unread_senders": { no: "Uleste avsendere", en: "Unread senders", de: "Ungelesene Absender", fr: "Expéditeurs non lus", es: "Remitentes no leídos", it: "Mittenti non letti", pl: "Nieprzeczytani nadawcy" },
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
  
  "simulate.title": { no: "Simuler Meldinger", en: "Simulate Messages", de: "Nachrichten simulieren", fr: "Simuler des messages", es: "Simular mensajes", it: "Simula messaggi", pl: "Symuluj wiadomości" },
  "simulate.subtitle": { no: "Test systemet med simulerte scenarier", en: "Test the system with simulated scenarios", de: "Testen Sie das System mit simulierten Szenarien", fr: "Testez le système avec des scénarios simulés", es: "Pruebe el sistema con escenarios simulados", it: "Testa il sistema con scenari simulati", pl: "Przetestuj system z symulowanymi scenariuszami" },
  "simulate.select_scenario": { no: "Velg scenario", en: "Select scenario", de: "Szenario auswählen", fr: "Sélectionner un scénario", es: "Seleccionar escenario", it: "Seleziona scenario", pl: "Wybierz scenariusz" },
  "simulate.run_simulation": { no: "Kjør simulering", en: "Run simulation", de: "Simulation ausführen", fr: "Exécuter la simulation", es: "Ejecutar simulación", it: "Esegui simulazione", pl: "Uruchom symulację" },
  
  "print_to_sms.title": { no: "Print-to-SMS", en: "Print-to-SMS", de: "Print-to-SMS", fr: "Print-to-SMS", es: "Print-to-SMS", it: "Print-to-SMS", pl: "Print-to-SMS" },
  "print_to_sms.subtitle": { no: "Send melding basert på utskriftsetiketter", en: "Send message based on print labels", de: "Nachricht basierend auf Drucketiketten senden", fr: "Envoyer un message basé sur les étiquettes d'impression", es: "Enviar mensaje basado en etiquetas de impresión", it: "Invia messaggio basato su etichette di stampa", pl: "Wyślij wiadomość na podstawie etykiet drukowanych" },
  
  "admin.title": { no: "Admin", en: "Admin", de: "Admin", fr: "Admin", es: "Admin", it: "Admin", pl: "Admin" },
  "admin.subtitle": { no: "Administrer grupper, brukere og systeminnstillinger", en: "Manage groups, users and system settings", de: "Gruppen, Benutzer und Systemeinstellungen verwalten", fr: "Gérer les groupes, les utilisateurs et les paramètres système", es: "Gestionar grupos, usuarios y configuración del sistema", it: "Gestisci gruppi, utenti e impostazioni di sistema", pl: "Zarządzaj grupami, użytkownikami i ustawieniami systemu" },
  "admin.groups": { no: "Grupper", en: "Groups", de: "Gruppen", fr: "Groupes", es: "Grupos", it: "Gruppi", pl: "Grupy" },
  "admin.users": { no: "Brukere", en: "Users", de: "Benutzer", fr: "Utilisateurs", es: "Usuarios", it: "Utenti", pl: "Użytkownicy" },
  "admin.gateways": { no: "Gatewayer", en: "Gateways", de: "Gateways", fr: "Passerelles", es: "Puertas de enlace", it: "Gateway", pl: "Bramy" },
  "admin.audit_log": { no: "Revisjonslogg", en: "Audit log", de: "Überwachungsprotokoll", fr: "Journal d'audit", es: "Registro de auditoría", it: "Registro di audit", pl: "Dziennik audytu" },
  "admin.active_user": { no: "Aktiv bruker", en: "Active user", de: "Aktiver Benutzer", sv: "Aktiv användare", pl: "Aktywny użytkownik" },
  "admin.description": { no: "Administrer brukere, grupper og gateway", en: "Manage users, groups and gateways", de: "Benutzer, Gruppen und Gateways verwalten", sv: "Hantera användare, grupper och gateways", pl: "Zarządzaj użytkownikami, grupami i bramkami" },
  "admin.create_group": { no: "Opprett gruppe", en: "Create group", de: "Gruppe erstellen", sv: "Skapa grupp", pl: "Utwórz grupę" },
  "admin.new_group": { no: "Ny gruppe", en: "New group", de: "Neue Gruppe", sv: "Ny grupp", pl: "Nowa grupa" },
  "admin.tabs.groups": { no: "Grupper", en: "Groups", de: "Gruppen", sv: "Grupper", pl: "Grupy" },
  "admin.tabs.users": { no: "Brukere", en: "Users", de: "Benutzer", sv: "Användare", pl: "Użytkownicy" },
  "admin.tabs.gateways": { no: "Gateway", en: "Gateways", de: "Gateways", sv: "Gateways", pl: "Bramki" },
  "admin.on_duty": { no: "På vakt", en: "On duty", de: "Im Dienst", sv: "I tjänst", pl: "Na dyżurze" },
  "admin.total": { no: "Totalt", en: "Total", de: "Gesamt", sv: "Totalt", pl: "Suma" },
  "admin.parent": { no: "Overordnet", en: "Parent", de: "Übergeordnet", sv: "Överordnad", pl: "Nadrzędny" },
  "admin.actions": { no: "Handlinger", en: "Actions", de: "Aktionen", sv: "Åtgärder", pl: "Akcje" },
  
  "settings.title": { no: "Innstillinger", en: "Settings", de: "Einstellungen", fr: "Paramètres", es: "Configuración", it: "Impostazioni", pl: "Ustawienia" },
  "settings.subtitle": { no: "Konfigurer systeminnstillinger", en: "Configure system settings", de: "Systemeinstellungen konfigurieren", fr: "Configurer les paramètres système", es: "Configurar ajustes del sistema", it: "Configura impostazioni di sistema", pl: "Skonfiguruj ustawienia systemu" },
  "settings.profile": { no: "Profil", en: "Profile", de: "Profil", fr: "Profil", es: "Perfil", it: "Profilo", pl: "Profil" },
  "settings.routing": { no: "Ruting", en: "Routing", de: "Routing", fr: "Routage", es: "Enrutamiento", it: "Routing", pl: "Routing" },
  "settings.notifications": { no: "Varsler", en: "Notifications", de: "Benachrichtigungen", fr: "Notifications", es: "Notificaciones", it: "Notifiche", pl: "Powiadomienia" },
  
  "login.title": { no: "Logg inn", en: "Log in", de: "Anmelden", fr: "Se connecter", es: "Iniciar sesión", it: "Accedi", pl: "Zaloguj się" },
  "login.email": { no: "E-post", en: "Email", de: "E-Mail", fr: "E-mail", es: "Correo electrónico", it: "E-mail", pl: "E-mail" },
  "login.password": { no: "Passord", en: "Password", de: "Passwort", fr: "Mot de passe", es: "Contraseña", it: "Password", pl: "Hasło" },
  "login.submit": { no: "Logg inn", en: "Log in", de: "Anmelden", fr: "Se connecter", es: "Iniciar sesión", it: "Accedi", pl: "Zaloguj się" },
  
  "onboarding.title": { no: "Velkommen", en: "Welcome", de: "Willkommen", fr: "Bienvenue", es: "Bienvenido", it: "Benvenuto", pl: "Witamy" },
  "onboarding.subtitle": { no: "La oss sette opp kontoen din", en: "Let's set up your account", de: "Lassen Sie uns Ihr Konto einrichten", fr: "Configurons votre compte", es: "Configuremos su cuenta", it: "Configuriamo il tuo account", pl: "Skonfigurujmy Twoje konto" },
  
  "theme.light": { no: "Lys", en: "Light", de: "Hell", fr: "Clair", es: "Claro", it: "Chiaro", pl: "Jasny" },
  "theme.dark": { no: "Mørk", en: "Dark", de: "Dunkel", fr: "Sombre", es: "Oscuro", it: "Scuro", pl: "Ciemny" },
  "theme.system": { no: "System", en: "System", de: "System", fr: "Système", es: "Sistema", it: "Sistema", pl: "System" },
  
  "common.loading": { no: "Laster...", en: "Loading...", de: "Wird geladen...", fr: "Chargement...", es: "Cargando...", it: "Caricamento...", pl: "Ładowanie..." },
  "common.error": { no: "Feil", en: "Error", de: "Fehler", fr: "Erreur", es: "Error", it: "Errore", pl: "Błąd" },
  "common.success": { no: "Suksess", en: "Success", de: "Erfolg", fr: "Succès", es: "Éxito", it: "Successo", pl: "Sukces" },
  "common.confirm": { no: "Bekreft", en: "Confirm", de: "Bestätigen", fr: "Confirmer", es: "Confirmar", it: "Conferma", pl: "Potwierdź" },
  "common.close": { no: "Lukk", en: "Close", de: "Schließen", fr: "Fermer", es: "Cerrar", it: "Chiudi", pl: "Zamknij" },
  "common.back": { no: "Tilbake", en: "Back", de: "Zurück", fr: "Retour", es: "Atrás", it: "Indietro", pl: "Wstecz" },
  "common.next": { no: "Neste", en: "Next", de: "Weiter", fr: "Suivant", es: "Siguiente", it: "Avanti", pl: "Dalej" },
  "common.finish": { no: "Fullfør", en: "Finish", de: "Fertig", fr: "Terminer", es: "Finalizar", it: "Fine", pl: "Zakończ" }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("no");

  useEffect(() => {
    const savedLang = localStorage.getItem("language") as Language;
    if (savedLang) {
      setLanguage(savedLang);
    }
  }, []);

  const t = (key: string) => {
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