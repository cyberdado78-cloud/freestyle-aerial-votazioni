(function bootstrapScoreFlowI18n(global) {
  'use strict';

  const supported = ['it', 'en', 'fr', 'es'];
  const dictionaries = {
    en: {
      'Vai al contenuto': 'Skip to content', 'Apri navigazione': 'Open navigation', 'Chiudi navigazione': 'Close navigation',
      'Eventi. Persone. Performance.': 'Events. People. Performance.', 'Nuova configurazione': 'New setup',
      'Benvenuto in ScoreFlow': 'Welcome to ScoreFlow', 'Il tuo prossimo grande evento\ninizia qui.': 'Your next great event starts here.',
      'Scegli il tipo di evento e ScoreFlow prepara logo, colori, categorie, giudici e atleti. Potrai modificare tutto in seguito.': 'Choose the event type and ScoreFlow will prepare the logo, colours, categories, judges and athletes. You can change everything later.',
      '1ª configurazione': 'First setup', '1. Tipo di competizione': '1. Competition type', '2. Dimensione della prova': '2. Trial size',
      '3. Identità facoltativa': '3. Optional identity', 'Discipline aeree': 'Aerial disciplines', 'Danza e spettacolo': 'Dance and show',
      'Ginnastica': 'Gymnastics', 'Altra competizione': 'Other competition', 'Rapida': 'Quick', 'Completa': 'Complete', 'Grande': 'Large',
      'Nome organizzazione': 'Organisation name', 'Nome evento': 'Event name', 'Configura con i miei dati': 'Set up with my data',
      'Crea demo completa': 'Create complete demo', 'Clienti salvati': 'Saved clients', 'Organizzazioni': 'Organisations',
      'Configura il tuo evento': 'Set up your event', 'Crea il primo ambiente ScoreFlow': 'Create your first ScoreFlow workspace',
      'Periodo di prova': 'Trial period', 'Nessuna carta richiesta': 'No card required', 'Organizzazione': 'Organisation',
      'Evento': 'Event', 'Valutazione': 'Scoring', 'Riepilogo': 'Summary', 'La tua organizzazione': 'Your organisation',
      'Lingua predefinita': 'Default language', 'Durata prova gratuita': 'Free trial duration', 'Colore principale': 'Primary colour',
      'Colore secondario': 'Secondary colour', 'Carica logo': 'Upload logo', 'Oppure URL logo': 'Or logo URL',
      'Nessun logo caricato': 'No logo uploaded', 'Continua': 'Continue', 'Primo evento': 'First event', 'Luogo': 'Location',
      'Data iniziale': 'Start date', 'Data finale': 'End date', 'Discipline': 'Disciplines', 'Categorie': 'Categories',
      'Aggiungi': 'Add', 'Indietro': 'Back', 'Regole di valutazione': 'Scoring rules', 'Giudici previsti': 'Expected judges',
      'Voti minimi richiesti': 'Minimum required scores', 'Calcolo risultato': 'Result calculation', 'Media': 'Average',
      'Somma': 'Sum', 'Media pesata': 'Weighted average', 'Mediana': 'Median', 'Penalità abilitate': 'Penalties enabled',
      'Motivazione penalità obbligatoria': 'Penalty reason required', 'Voto del pubblico': 'Public voting',
      'QR pubblico opzionale': 'Optional public QR code', 'Registro sostituzioni giudici': 'Judge replacement log',
      'Criterio': 'Criterion', 'Peso': 'Weight', 'Decimali': 'Decimals', 'Genera riepilogo': 'Generate summary',
      'Ambiente pronto': 'Workspace ready', 'Configurazione valida': 'Valid setup', 'Regia': 'Control desk', 'Giudici': 'Judges',
      'Classifiche': 'Rankings', 'Pubblico': 'Public', 'Esporta JSON': 'Export JSON', 'Salva e apri dashboard': 'Save and open dashboard',
      'Prova gratuita': 'Free trial', 'Organizza': 'Organise', 'Panoramica': 'Overview', 'Postazioni': 'Stations',
      'Partecipanti': 'Participants', 'Iscrizioni': 'Registrations', 'Durante l’evento': 'During the event',
      'Eliminatorie': 'Qualifications', 'Risultati': 'Results', 'Voto pubblico': 'Public voting', 'Modifica configurazione': 'Edit setup',
      'Ambiente cliente': 'Client workspace', 'Portale iscrizioni atleti': 'Athlete registration portal', 'Esci': 'Log out',
      'Preiscrizioni e iscrizioni': 'Pre-registration and registration', 'Tempo rimasto': 'Time remaining', 'Account società': 'Organisation account',
      'Prova ScoreFlow per 14 giorni': 'Try ScoreFlow for 14 days', 'Recupera la password': 'Recover password',
      'Scegli una nuova password': 'Choose a new password', 'Conferma il tuo account': 'Confirm your account',
      'Accedi alla tua società': 'Sign in to your organisation', 'Email della società': 'Organisation email', 'Password': 'Password',
      'Mostra password': 'Show password', 'Nascondi password': 'Hide password', 'Almeno 8 caratteri.': 'At least 8 characters.',
      'Crea account': 'Create account', 'Invia collegamento': 'Send link', 'Salva nuova password': 'Save new password',
      'Conferma email': 'Confirm email', 'Accedi': 'Sign in', 'Crea account e prova': 'Create account and start trial',
      'Password dimenticata?': 'Forgot password?', 'Operazione in corso…': 'Processing…', 'Account società': 'Organisation account',
      'Esporta i miei dati': 'Export my data', 'Esci dall’account': 'Sign out', 'Credenziali personali': 'Personal credentials',
      'Dati atleta': 'Athlete details', 'Nome *': 'First name *', 'Cognome *': 'Last name *', 'Data di nascita *': 'Date of birth *',
      'Luogo di nascita': 'Place of birth', 'Genere': 'Gender', 'Non specificato': 'Not specified', 'Femminile': 'Female',
      'Maschile': 'Male', 'Altro': 'Other', 'Codice fiscale': 'Tax ID', 'Nazionalità': 'Nationality',
      'Telefono atleta *': 'Athlete phone *', 'Indirizzo': 'Address', 'Città': 'City', 'Provincia': 'Province',
      'Scuola e coach': 'School and coach', 'Nome scuola / società *': 'School / club name *', 'Coach di riferimento *': 'Main coach *',
      'Telefono coach *': 'Coach phone *', 'Dati di gara': 'Competition details', 'Seleziona': 'Select', 'Categoria *': 'Category *',
      'Disciplina *': 'Discipline *', 'Livello': 'Level', 'Durata performance': 'Performance duration',
      'Titolo coreografia': 'Choreography title', 'Tema coreografia': 'Choreography theme',
      'Descrizione atleta / performance': 'Athlete / performance description', 'Richieste speciali': 'Special requests',
      'Comunicazioni': 'Communications', 'Messaggi della regia': 'Messages from the control desk', 'Area riservata': 'Private area',
      'Salva aggiornamenti': 'Save changes', 'Hai già le credenziali?': 'Already have credentials?', 'Accedi alla scheda': 'Open your profile',
      'Nuova preiscrizione': 'New pre-registration', 'Crea la tua scheda': 'Create your profile', 'Preiscrizioni chiuse': 'Pre-registration closed',
      'Inizia la compilazione': 'Start registration', 'Scegli il tipo di account': 'Choose account type', 'Preiscrizione': 'Pre-registration',
      'Atleta singolo': 'Individual athlete', 'Scuola / coach': 'School / coach', 'Chiudi': 'Close',
      'Crea credenziali e salva scheda': 'Create credentials and save profile', 'Chiusura iscrizioni': 'Registration closes',
      'Apertura preiscrizioni': 'Pre-registration opens', 'Chiusura preiscrizioni': 'Pre-registration closes',
      'Apertura programmata': 'Scheduled opening', 'Preiscrizioni aperte': 'Pre-registration open', 'Iscrizioni aperte': 'Registration open',
      'Iscrizioni chiuse': 'Registration closed', 'Portale non attivo': 'Portal inactive', 'Data da definire': 'Date to be confirmed',
      'Centro operativo': 'Operations centre', 'Postazioni gara': 'Competition stations', 'Sistema pronto': 'System ready',
      'Accesso multi-dispositivo': 'Multi-device access', 'Collega telefoni, tablet e computer': 'Connect phones, tablets and computers',
      'Singolo giudice': 'Single judge', 'Presentatore': 'Presenter', 'Staff': 'Staff', 'Apri postazione →': 'Open station →',
      'Copia link': 'Copy link', 'Rigenera': 'Regenerate', 'Genera link': 'Generate link', 'Genera QR': 'Generate QR',
      'Scarica QR': 'Download QR', 'Stampa QR': 'Print QR', 'QR non attivo': 'QR not enabled',
      'Postazione giudice': 'Judge station', 'Accedi alla tua scheda': 'Open your score sheet', 'Codice giudice': 'Judge code',
      'Entra nella postazione': 'Open station', 'Postazione staff': 'Staff station', 'Vista presentatore': 'Presenter view',
      'In pedana': 'On stage', 'Quanto ti è piaciuta l’esibizione?': 'How much did you enjoy the performance?',
      'Il voto del pubblico è separato dal punteggio ufficiale della giuria.': 'The public vote is separate from the official jury score.',
      'Voto registrato': 'Vote recorded', 'Invia voto': 'Submit vote', 'Voto pubblico non attivo': 'Public voting is not active',
      'In attesa del primo atleta': 'Waiting for the first athlete', 'Controllo gara': 'Competition control', 'Avanzamento gara': 'Competition progression',
      'Automatico': 'Automatic', 'Manuale': 'Manual', 'Tempi selezionati': 'Selected timing', 'Atleta': 'Athlete', 'Categoria': 'Category',
      'Giornata': 'Day', 'Scaletta uscite': 'Running order', 'Controllo votazione': 'Voting monitor',
      'Tutti i giudici hanno votato. È possibile avanzare.': 'All judges have voted. You may continue.', 'Emergenza regia': 'Control desk emergency',
      'Override voto manuale': 'Manual score override', 'Motivazione override': 'Override reason', 'Salva voto': 'Save score',
      'Storico modifiche voto': 'Score change history', 'Nessuna modifica registrata.': 'No changes recorded.',
      'Concludi e avanza': 'Finish and continue', 'Programma ripetizione': 'Schedule repeat', 'Segna ritirato': 'Mark withdrawn',
      'Lingua': 'Language', 'Italiano': 'Italian', 'English': 'English', 'Français': 'French', 'Español': 'Spanish'
    },
    fr: {
      'Vai al contenuto': 'Aller au contenu', 'Apri navigazione': 'Ouvrir la navigation', 'Chiudi navigazione': 'Fermer la navigation',
      'Eventi. Persone. Performance.': 'Événements. Personnes. Performances.', 'Nuova configurazione': 'Nouvelle configuration',
      'Benvenuto in ScoreFlow': 'Bienvenue dans ScoreFlow', 'Il tuo prossimo grande evento\ninizia qui.': 'Votre prochain grand événement commence ici.',
      '1ª configurazione': 'Première configuration', 'Organizzazione': 'Organisation', 'Evento': 'Événement', 'Valutazione': 'Notation',
      'Riepilogo': 'Résumé', 'Lingua predefinita': 'Langue par défaut', 'Continua': 'Continuer', 'Indietro': 'Retour',
      'Voto del pubblico': 'Vote du public', 'QR pubblico opzionale': 'QR public facultatif', 'Penalità abilitate': 'Pénalités activées',
      'Motivazione penalità obbligatoria': 'Motif de pénalité obligatoire', 'Giudici': 'Juges', 'Regia': 'Régie',
      'Classifiche': 'Classements', 'Pubblico': 'Public', 'Panoramica': 'Vue d’ensemble', 'Postazioni': 'Postes',
      'Partecipanti': 'Participants', 'Iscrizioni': 'Inscriptions', 'Risultati': 'Résultats', 'Voto pubblico': 'Vote du public',
      'Portale iscrizioni atleti': 'Portail d’inscription des athlètes', 'Esci': 'Déconnexion', 'Preiscrizioni e iscrizioni': 'Préinscriptions et inscriptions',
      'Tempo rimasto': 'Temps restant', 'Prova ScoreFlow per 14 giorni': 'Essayez ScoreFlow pendant 14 jours',
      'Recupera la password': 'Récupérer le mot de passe', 'Scegli una nuova password': 'Choisir un nouveau mot de passe',
      'Conferma il tuo account': 'Confirmer votre compte', 'Accedi alla tua società': 'Connexion à votre organisation',
      'Email della società': 'E-mail de l’organisation', 'Mostra password': 'Afficher le mot de passe', 'Nascondi password': 'Masquer le mot de passe',
      'Almeno 8 caratteri.': 'Au moins 8 caractères.', 'Crea account': 'Créer un compte', 'Invia collegamento': 'Envoyer le lien',
      'Salva nuova password': 'Enregistrer le nouveau mot de passe', 'Conferma email': 'Confirmer l’e-mail', 'Accedi': 'Connexion',
      'Crea account e prova': 'Créer un compte et essayer', 'Password dimenticata?': 'Mot de passe oublié ?', 'Operazione in corso…': 'Opération en cours…',
      'Dati atleta': 'Données de l’athlète', 'Nome *': 'Prénom *', 'Cognome *': 'Nom *', 'Data di nascita *': 'Date de naissance *',
      'Scuola e coach': 'École et coach', 'Dati di gara': 'Données de compétition', 'Comunicazioni': 'Communications',
      'Messaggi della regia': 'Messages de la régie', 'Salva aggiornamenti': 'Enregistrer les modifications', 'Hai già le credenziali?': 'Vous avez déjà un compte ?',
      'Nuova preiscrizione': 'Nouvelle préinscription', 'Crea la tua scheda': 'Créer votre fiche', 'Preiscrizioni chiuse': 'Préinscriptions closes',
      'Atleta singolo': 'Athlète individuel', 'Scuola / coach': 'École / coach', 'Chiusura iscrizioni': 'Clôture des inscriptions',
      'Apertura preiscrizioni': 'Ouverture des préinscriptions', 'Chiusura preiscrizioni': 'Clôture des préinscriptions',
      'Preiscrizioni aperte': 'Préinscriptions ouvertes', 'Iscrizioni aperte': 'Inscriptions ouvertes', 'Iscrizioni chiuse': 'Inscriptions closes',
      'Centro operativo': 'Centre opérationnel', 'Postazioni gara': 'Postes de compétition', 'Sistema pronto': 'Système prêt',
      'Genera link': 'Générer le lien', 'Genera QR': 'Générer le QR', 'Scarica QR': 'Télécharger le QR', 'Stampa QR': 'Imprimer le QR',
      'Postazione giudice': 'Poste juge', 'Accedi alla tua scheda': 'Accéder à votre fiche', 'Codice giudice': 'Code juge',
      'In pedana': 'En piste', 'Quanto ti è piaciuta l’esibizione?': 'Avez-vous apprécié la prestation ?', 'Voto registrato': 'Vote enregistré',
      'Invia voto': 'Envoyer le vote', 'Controllo gara': 'Contrôle de compétition', 'Avanzamento gara': 'Progression de la compétition',
      'Automatico': 'Automatique', 'Manuale': 'Manuel', 'Atleta': 'Athlète', 'Categoria': 'Catégorie', 'Giornata': 'Journée',
      'Scaletta uscite': 'Ordre de passage', 'Controllo votazione': 'Contrôle du vote', 'Emergenza regia': 'Urgence régie',
      'Override voto manuale': 'Remplacement manuel du vote', 'Motivazione override': 'Motif du remplacement', 'Salva voto': 'Enregistrer le vote',
      'Storico modifiche voto': 'Historique des modifications', 'Nessuna modifica registrata.': 'Aucune modification enregistrée.',
      'Lingua': 'Langue', 'Italiano': 'Italien', 'English': 'Anglais', 'Français': 'Français', 'Español': 'Espagnol'
    },
    es: {
      'Vai al contenuto': 'Ir al contenido', 'Apri navigazione': 'Abrir navegación', 'Chiudi navigazione': 'Cerrar navegación',
      'Eventi. Persone. Performance.': 'Eventos. Personas. Rendimiento.', 'Nuova configurazione': 'Nueva configuración',
      'Benvenuto in ScoreFlow': 'Bienvenido a ScoreFlow', 'Il tuo prossimo grande evento\ninizia qui.': 'Tu próximo gran evento empieza aquí.',
      '1ª configurazione': 'Primera configuración', 'Organizzazione': 'Organización', 'Evento': 'Evento', 'Valutazione': 'Puntuación',
      'Riepilogo': 'Resumen', 'Lingua predefinita': 'Idioma predeterminado', 'Continua': 'Continuar', 'Indietro': 'Atrás',
      'Voto del pubblico': 'Voto del público', 'QR pubblico opzionale': 'QR público opcional', 'Penalità abilitate': 'Penalizaciones activadas',
      'Motivazione penalità obbligatoria': 'Motivo de penalización obligatorio', 'Giudici': 'Jueces', 'Regia': 'Control',
      'Classifiche': 'Clasificaciones', 'Pubblico': 'Público', 'Panoramica': 'Resumen', 'Postazioni': 'Puestos',
      'Partecipanti': 'Participantes', 'Iscrizioni': 'Inscripciones', 'Risultati': 'Resultados', 'Voto pubblico': 'Voto público',
      'Portale iscrizioni atleti': 'Portal de inscripción de atletas', 'Esci': 'Salir', 'Preiscrizioni e iscrizioni': 'Preinscripciones e inscripciones',
      'Tempo rimasto': 'Tiempo restante', 'Prova ScoreFlow per 14 giorni': 'Prueba ScoreFlow durante 14 días',
      'Recupera la password': 'Recuperar contraseña', 'Scegli una nuova password': 'Elegir una nueva contraseña',
      'Conferma il tuo account': 'Confirmar tu cuenta', 'Accedi alla tua società': 'Acceder a tu organización',
      'Email della società': 'Correo de la organización', 'Mostra password': 'Mostrar contraseña', 'Nascondi password': 'Ocultar contraseña',
      'Almeno 8 caratteri.': 'Al menos 8 caracteres.', 'Crea account': 'Crear cuenta', 'Invia collegamento': 'Enviar enlace',
      'Salva nuova password': 'Guardar nueva contraseña', 'Conferma email': 'Confirmar correo', 'Accedi': 'Acceder',
      'Crea account e prova': 'Crear cuenta y probar', 'Password dimenticata?': '¿Olvidaste la contraseña?', 'Operazione in corso…': 'Procesando…',
      'Dati atleta': 'Datos del atleta', 'Nome *': 'Nombre *', 'Cognome *': 'Apellidos *', 'Data di nascita *': 'Fecha de nacimiento *',
      'Scuola e coach': 'Escuela y entrenador', 'Dati di gara': 'Datos de competición', 'Comunicazioni': 'Comunicaciones',
      'Messaggi della regia': 'Mensajes del control', 'Salva aggiornamenti': 'Guardar cambios', 'Hai già le credenziali?': '¿Ya tienes credenciales?',
      'Nuova preiscrizione': 'Nueva preinscripción', 'Crea la tua scheda': 'Crear tu ficha', 'Preiscrizioni chiuse': 'Preinscripciones cerradas',
      'Atleta singolo': 'Atleta individual', 'Scuola / coach': 'Escuela / entrenador', 'Chiusura iscrizioni': 'Cierre de inscripciones',
      'Apertura preiscrizioni': 'Apertura de preinscripciones', 'Chiusura preiscrizioni': 'Cierre de preinscripciones',
      'Preiscrizioni aperte': 'Preinscripciones abiertas', 'Iscrizioni aperte': 'Inscripciones abiertas', 'Iscrizioni chiuse': 'Inscripciones cerradas',
      'Centro operativo': 'Centro operativo', 'Postazioni gara': 'Puestos de competición', 'Sistema pronto': 'Sistema listo',
      'Genera link': 'Generar enlace', 'Genera QR': 'Generar QR', 'Scarica QR': 'Descargar QR', 'Stampa QR': 'Imprimir QR',
      'Postazione giudice': 'Puesto del juez', 'Accedi alla tua scheda': 'Acceder a tu ficha', 'Codice giudice': 'Código del juez',
      'In pedana': 'En pista', 'Quanto ti è piaciuta l’esibizione?': '¿Cuánto te gustó la actuación?', 'Voto registrato': 'Voto registrado',
      'Invia voto': 'Enviar voto', 'Controllo gara': 'Control de competición', 'Avanzamento gara': 'Progreso de la competición',
      'Automatico': 'Automático', 'Manuale': 'Manual', 'Atleta': 'Atleta', 'Categoria': 'Categoría', 'Giornata': 'Jornada',
      'Scaletta uscite': 'Orden de salida', 'Controllo votazione': 'Control de votación', 'Emergenza regia': 'Emergencia de control',
      'Override voto manuale': 'Sustitución manual del voto', 'Motivazione override': 'Motivo de la sustitución', 'Salva voto': 'Guardar voto',
      'Storico modifiche voto': 'Historial de cambios', 'Nessuna modifica registrata.': 'No hay cambios registrados.',
      'Lingua': 'Idioma', 'Italiano': 'Italiano', 'English': 'Inglés', 'Français': 'Francés', 'Español': 'Español'
    }
  };

  // Athlete recovery labels also update when the language changes in an open form.
  Object.assign(dictionaries.en, {
  "Password dimenticata?": "Forgot password?",
  "Recupera accesso atleta": "Recover athlete access",
  "Nuova password atleta": "New athlete password",
  "Email della scheda atleta": "Athlete account email",
  "Nuova password (8–128 caratteri)": "New password (8–128 characters)",
  "Conferma nuova password": "Confirm new password",
  "Invia collegamento": "Send link",
  "Salva nuova password": "Save new password",
  "Torna all’accesso atleta": "Back to athlete sign-in",
  "Se l’indirizzo è registrato per questo evento, riceverai un collegamento valido per 30 minuti. Controlla anche lo spam.": "If this address is registered for this event, you will receive a link valid for 30 minutes. Check your spam folder too.",
  "Password aggiornata. Accedi alla tua scheda con la nuova password.": "Password updated. Sign in to your profile with your new password.",
  "Le password non coincidono.": "Passwords do not match.",
  "Email o password non corretti per la scheda atleta. Usa le credenziali create durante la preiscrizione oppure recupera la password.": "Incorrect athlete email or password. Use the credentials created during registration or reset your password.",
  "Collegamento scaduto o già utilizzato. Richiedi un nuovo recupero.": "Link expired or already used. Request a new recovery link.",
  "Operazione non riuscita. Riprova più tardi.": "Unable to complete the request. Please try again later.",
  "Troppi tentativi. Riprova tra 15 minuti.": "Too many attempts. Try again in 15 minutes."
});
  Object.assign(dictionaries.fr, {
  "Password dimenticata?": "Mot de passe oublié ?",
  "Recupera accesso atleta": "Récupérer l’accès athlète",
  "Nuova password atleta": "Nouveau mot de passe athlète",
  "Email della scheda atleta": "E-mail du compte athlète",
  "Nuova password (8–128 caratteri)": "Nouveau mot de passe (8–128 caractères)",
  "Conferma nuova password": "Confirmer le nouveau mot de passe",
  "Invia collegamento": "Envoyer le lien",
  "Salva nuova password": "Enregistrer le mot de passe",
  "Torna all’accesso atleta": "Retour à la connexion athlète",
  "Se l’indirizzo è registrato per questo evento, riceverai un collegamento valido per 30 minuti. Controlla anche lo spam.": "Si cette adresse est inscrite à cet événement, vous recevrez un lien valable 30 minutes. Vérifiez aussi les courriers indésirables.",
  "Password aggiornata. Accedi alla tua scheda con la nuova password.": "Mot de passe mis à jour. Connectez-vous avec votre nouveau mot de passe.",
  "Le password non coincidono.": "Les mots de passe ne correspondent pas.",
  "Email o password non corretti per la scheda atleta. Usa le credenziali create durante la preiscrizione oppure recupera la password.": "E-mail ou mot de passe athlète incorrect. Utilisez les identifiants créés à l’inscription ou récupérez le mot de passe.",
  "Collegamento scaduto o già utilizzato. Richiedi un nuovo recupero.": "Lien expiré ou déjà utilisé. Demandez un nouveau lien.",
  "Operazione non riuscita. Riprova più tardi.": "Opération impossible. Réessayez plus tard.",
  "Troppi tentativi. Riprova tra 15 minuti.": "Trop de tentatives. Réessayez dans 15 minutes."
});
  Object.assign(dictionaries.es, {
  "Password dimenticata?": "¿Olvidaste tu contraseña?",
  "Recupera accesso atleta": "Recuperar acceso de atleta",
  "Nuova password atleta": "Nueva contraseña de atleta",
  "Email della scheda atleta": "Correo de la cuenta de atleta",
  "Nuova password (8–128 caratteri)": "Nueva contraseña (8–128 caracteres)",
  "Conferma nuova password": "Confirma la nueva contraseña",
  "Invia collegamento": "Enviar enlace",
  "Salva nuova password": "Guardar contraseña",
  "Torna all’accesso atleta": "Volver al acceso de atleta",
  "Se l’indirizzo è registrato per questo evento, riceverai un collegamento valido per 30 minuti. Controlla anche lo spam.": "Si la dirección está inscrita en este evento, recibirás un enlace válido durante 30 minutos. Revisa también el correo no deseado.",
  "Password aggiornata. Accedi alla tua scheda con la nuova password.": "Contraseña actualizada. Accede a tu ficha con la nueva contraseña.",
  "Le password non coincidono.": "Las contraseñas no coinciden.",
  "Email o password non corretti per la scheda atleta. Usa le credenziali create durante la preiscrizione oppure recupera la password.": "Correo o contraseña de atleta incorrectos. Usa las credenciales creadas al inscribirte o recupera la contraseña.",
  "Collegamento scaduto o già utilizzato. Richiedi un nuovo recupero.": "Enlace caducado o ya utilizado. Solicita otro enlace.",
  "Operazione non riuscita. Riprova più tardi.": "No se pudo completar la operación. Inténtalo más tarde.",
  "Troppi tentativi. Riprova tra 15 minuti.": "Demasiados intentos. Inténtalo en 15 minutos."
});

  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  let language = readInitialLanguage();
  let observer = null;

  function readInitialLanguage() {
    const saved = String(global.localStorage?.getItem('scoreflow.uiLanguage') || '').slice(0, 2).toLowerCase();
    if (supported.includes(saved)) return saved;
    const browser = String(global.navigator?.language || 'it').slice(0, 2).toLowerCase();
    return supported.includes(browser) ? browser : 'it';
  }

  function translateDynamic(source, targetLanguage) {
    if (targetLanguage === 'it') return source;
    const replacements = {
      en: [
        [/^(\d+) giorni di prova rimasti$/, '$1 trial days remaining'],
        [/^(\d+) giorni rimasti · (\d+)\/10 invii email$/, '$1 days remaining · $2/10 email sends'],
        [/^(\d+) atleti inseriti$/, '$1 athletes added'],
        [/^Uscita (\d+) di (\d+)$/, 'Entry $1 of $2'],
        [/^(\d+)\/(\d+) giudici hanno terminato$/, '$1/$2 judges completed']
      ],
      fr: [
        [/^(\d+) giorni di prova rimasti$/, '$1 jours d’essai restants'],
        [/^(\d+) giorni rimasti · (\d+)\/10 invii email$/, '$1 jours restants · $2/10 envois e-mail'],
        [/^(\d+) atleti inseriti$/, '$1 athlètes ajoutés'],
        [/^Uscita (\d+) di (\d+)$/, 'Passage $1 sur $2'],
        [/^(\d+)\/(\d+) giudici hanno terminato$/, '$1/$2 juges ont terminé']
      ],
      es: [
        [/^(\d+) giorni di prova rimasti$/, '$1 días de prueba restantes'],
        [/^(\d+) giorni rimasti · (\d+)\/10 invii email$/, '$1 días restantes · $2/10 envíos de correo'],
        [/^(\d+) atleti inseriti$/, '$1 atletas añadidos'],
        [/^Uscita (\d+) di (\d+)$/, 'Salida $1 de $2'],
        [/^(\d+)\/(\d+) giudici hanno terminato$/, '$1/$2 jueces han terminado']
      ]
    };
    for (const [pattern, replacement] of replacements[targetLanguage] || []) if (pattern.test(source)) return source.replace(pattern, replacement);
    return source;
  }

  function translate(source, targetLanguage = language) {
    const normalized = String(source ?? '');
    if (targetLanguage === 'it') return normalized;
    return dictionaries[targetLanguage]?.[normalized] || translateDynamic(normalized, targetLanguage);
  }

  function translateTextNode(node) {
    if (!node?.parentElement || /^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentElement.tagName)) return;
    if (!textSources.has(node)) textSources.set(node, node.nodeValue);
    const source = textSources.get(node);
    const leading = source.match(/^\s*/)?.[0] || '';
    const trailing = source.match(/\s*$/)?.[0] || '';
    const core = source.trim();
    if (!core) return;
    node.nodeValue = `${leading}${translate(core)}${trailing}`;
  }

  function translateAttributes(element) {
    const attributes = ['placeholder', 'title', 'aria-label'];
    let sources = attributeSources.get(element);
    if (!sources) { sources = {}; attributeSources.set(element, sources); }
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      if (!(name in sources)) sources[name] = element.getAttribute(name);
      element.setAttribute(name, translate(sources[name]));
    }
  }

  function translateDOM(root = global.document) {
    if (!root) return;
    if (root.nodeType === 3) translateTextNode(root);
    if (root.nodeType === 1) translateAttributes(root);
    const walker = global.document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) node.nodeType === 3 ? translateTextNode(node) : translateAttributes(node);
    global.document.documentElement.lang = language;
    global.document.querySelectorAll('[data-scoreflow-language]').forEach(select => { select.value = language; });
  }

  function setLanguage(nextLanguage, options = {}) {
    const next = supported.includes(String(nextLanguage).slice(0, 2).toLowerCase()) ? String(nextLanguage).slice(0, 2).toLowerCase() : 'it';
    language = next;
    global.localStorage?.setItem('scoreflow.uiLanguage', language);
    if (options.translate !== false) translateDOM(global.document);
    global.dispatchEvent(new CustomEvent('scoreflow:languagechange', { detail: { language } }));
    return language;
  }

  function observe() {
    if (observer || !global.document?.body) return;
    observer = new MutationObserver(mutations => {
      observer.disconnect();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => translateDOM(node));
        if (mutation.type === 'attributes') translateAttributes(mutation.target);
      }
      observer.observe(global.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    });
    observer.observe(global.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    translateDOM(global.document);
  }

  global.ScoreFlowI18n = { supported, get language() { return language; }, t: translate, setLanguage, translateDOM, observe };
})(window);
