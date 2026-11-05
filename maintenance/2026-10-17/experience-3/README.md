# ScoreFlow 3.0 — esperienza evento ed email gestite

Pubblicata il 17 ottobre 2026 su https://scoreflow.dynamiczen.it. I quattro file archiviati in ../release-3.0.0 sono la versione effettivamente distribuita; il server Node è stato riavviato. Nessuna nuova dipendenza. Applicata l’estensione dello schema email descritta in schema.sql. Non distribuire la vecchia root v1.5 del branch main.

## Esperienza del cliente

Dashboard rinnovata: menu con icone e sezioni Organizza / Durante l’evento; riepilogo della preparazione calcolato da categorie/criteri, partecipanti, numero minimo di giudici attivi e almeno una prova di voto. Accessi diretti a regia e postazioni. Dati di riepilogo, azioni successive e operazioni di sistema separati visivamente. Palette blu notte, superfici chiare, accenti del brand del cliente mantenuti. Nuova tipografia, spaziature, campi, tabelle, stati e pulsanti coerenti per organizzatori, regia, giudici e portale atleti.

Su schermi piccoli il menu diventa un pannello richiudibile, con sfondo, Escape, stato aria-expanded e gestione del focus. Le griglie si ridistribuiscono a 2 o 1 colonna. Sono presenti focus visibili, link per saltare al contenuto, icone decorative non annunciate e riduzione delle animazioni. I messaggi non richiedenti conferma usano notifiche non bloccanti, con testo escapato e pulsante di chiusura. Le conferme delle azioni distruttive restano esplicite.

Le iscrizioni mostrano un caricamento comprensibile e caricano schede/preferenze in parallelo. Una risposta lenta non può sostituire la schermata dopo che l’utente è passato ad altro modulo. Navigazione tra moduli con ritorno all’inizio; aggiornamenti cloud e del timer conservano la posizione e le bozze secondo i test esistenti.

## Email semplici per il cliente

Modalità predefinita gestita da ScoreFlow. Il nome dell’organizzazione è già proposto dalla configurazione; il cliente indica l’email di contatto e sceglie se abilitare le comunicazioni. Nessun account Resend, chiave API o DNS richiesto al cliente in questa modalità. Le risposte arrivano al contatto del cliente, mentre il mittente tecnico è quello centrale verificato.

Un collegamento personale Resend rimane facoltativo nelle opzioni avanzate. I collegamenti personali già configurati sono mantenuti con modalità custom; le credenziali cifrate restano separate dallo stato gara e dai ruoli operativi. Cambiare modalità non cancella una chiave personale finché l’amministratore non ne richiede la rimozione.

### Attivazione centrale ancora necessaria

Il servizio centrale NON è attivo in produzione. L’interfaccia lo dichiara e non simula invii riusciti. Servono una volta sola, a cura del gestore di ScoreFlow:

- account del provider e mittente centrale su dominio verificato;
- RESEND_API_KEY e SCOREFLOW_EMAIL_FROM nell’ambiente server;
- SCOREFLOW_MANAGED_EMAIL_ENABLED=true per l’apertura del servizio.

Nessuna chiave reale è stata inserita e nessuna email reale inviata durante il rilascio. Le comunicazioni restano pending e possono essere ritentate dopo l’attivazione. Le preferenze possono essere salvate anche durante l’attesa. Limiti, costi del servizio centrale e gestione dei rimbalzi vanno definiti operativamente prima del lancio commerciale: non è stato promesso un numero illimitato di invii.

Il server autorizza gli invii centrali solo per un tenant con licenza attiva e non scaduta, verificata sulla tabella server delle licenze. Non si affida al piano dichiarato nello stato gara del client. Il test mantiene il limite atomico di una richiesta al minuto. Il provider attuale è Resend dietro il servizio centrale; questa scelta tecnica non richiede configurazione ai clienti. I webhook di consegna/rimbalzo non sono implementati: una risposta positiva certifica accettazione dal provider, non consegna in casella.

## Verifica e limiti

- 20 regressioni del flusso gara: include 12 qualificazioni e 12 finali con quattro giudici, 96 schede, bozze, ripetizioni e reset.
- 27 test backend email: isolamento, cifratura, modalità personale/gestita, licenza attiva e scaduta, mittente e Reply-To, indisponibilità onesta del servizio, disattivazione e rimozione chiavi.
- 9 test interfaccia email: campi essenziali, opzioni avanzate, chiavi non persistite nel browser, salvataggio, prova e gestione errori.
- 8 test navigazione/feedback: nomi accessibili, menu, Escape e focus, pagina corrente, ingresso in regia, progressione corretta, risposta lenta e notifiche sicure.
- Totale: 64 test locali passati. verification.txt contiene il risultato integrale. Il provider è simulato nei test di invio.
- 13 controlli sulle API online con organizzazione QA e dati fittizi: persistenza, isolamento amministratore/staff, modalità gestita senza nuove credenziali esterne, servizio non attivo e contatto invalido. Nessun invio; preferenze QA disattivate e chiave sintetica rimossa alla fine.
- Browser reale: verificate dashboard, regia e pagina iscrizioni, senza overflow orizzontale nella vista desktop. Lo screenshot documenta la nuova interfaccia. Le regole responsive e la logica del menu sono implementate e testate; non è stato completato un collaudo su telefoni/tablet fisici.
- Hash dei quattro file pubblicati confrontati con gli archivi locali e /health.version=3.0.0, report http-verification.json.

L’advisor Supabase conserva gli avvisi preesistenti su due funzioni autorizzative SECURITY DEFINER e due tabelle con RLS senza policy; nessun allargamento dei privilegi sulle impostazioni email. Questo rilascio non certifica l’intero modello di sicurezza della piattaforma.

La licenza di produzione resta necessaria per l’evento; non sono stati attivati o acquistati servizi a pagamento, modificati dati reali di iscritti, inviati messaggi esterni o unita la PR alla vecchia root.
