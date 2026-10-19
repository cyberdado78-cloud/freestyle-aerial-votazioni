# freestyle-aerial-votazioni

ScoreFlow è disponibile direttamente da `index.html`. La precedente schermata pubblica FAC rimane in `display.html`.

## ScoreFlow v2.5 beta

La versione configurabile pronta per il deploy si trova nella root del repository; una copia di sviluppo rimane in `scoreflow/`.

Aprire `index.html` per configurare:

- organizzazioni separate;
- periodo di prova;
- identità e branding;
- caricamento diretto del logo e selezione dei file evento;
- eventi, discipline e categorie;
- riordino delle categorie con controlli dedicati;
- numero di giudici e voti minimi;
- criteri, intervalli, pesi e decimali;
- penalità, voto pubblico e registro sostituzioni;
- esportazione della configurazione JSON.
- dashboard successiva con evento, partecipanti, giudici, regia, risultati e voto pubblico.
- accesso automatico alla dashboard quando esiste già una configurazione salvata.
- inserimento manuale e importazione CSV dei partecipanti;
- assegnazione categorie, discipline e ordine di gara modificabile;
- creazione dei giudici con codice personale e stato attivo;
- limite rigido dei giudici configurabili, definito nelle regole dell’evento;
- regia con chiamata atleta, avvio, conclusione e ritiro;
- schede di voto dinamiche basate sui criteri configurati;
- penalità motivate, aggiornamento del voto e conteggio dei voti minimi;
- classifiche automatiche per categoria ed esportazione CSV dei risultati.
- centro postazioni con viste dedicate per giudice, presentatore, regia, staff e pubblico;
- accesso del singolo giudice tramite codice personale e invio della propria scheda;
- vista presentatore con atleta corrente e prossimo concorrente;
- gestione staff per atleta pronto, in ritardo o ritirato;
- voto pubblico 1–10 separato dal risultato ufficiale;
- scheda dettagliata per ogni atleta con giudici, criteri, punteggi, penalità, totali e metodo di calcolo;
- stampa o salvataggio PDF della scheda atleta direttamente dal browser;
- interfaccia operativa rinnovata e responsive.
- branding completo: i colori principale e secondario modificano l’intera interfaccia;
- anteprima immediata del tema durante la configurazione;
- pulsante per completare automaticamente giudici e dati demo mancanti;
- ulteriore restyling di dashboard, navigazione, card e postazioni.
- scaletta gara protetta con avanzamento automatico o manuale;
- blocco del concorrente successivo fino al voto di tutti i giudici attivi;
- monitor dei giudici mancanti e avviso di inattività dopo 90 secondi;
- ripetizione autorizzata dalla regia con archiviazione dei voti annullati;
- scheda atleta con foto, video entry, certificato medico e musica MP3;
- stampa del badge atleta personalizzato;
- regolamento di gara consultabile dalla regia;
- eliminatorie e finale con classifiche e votazioni separate.
- collegamenti cloud separati per giudici, presentatore, regia, staff e pubblico;
- reset post-test che conserva configurazione, roster e giudici;
- attivazione del software completo tramite codice licenza verificato dal server;
- portale preiscrizioni/iscrizioni con credenziali personali dell’atleta;
- scadenze configurabili, conto alla rovescia e blocco automatico delle modifiche;
- scheda atleta completa con scuola, coach di riferimento e telefono coach;
- caricamento riservato di foto atleta, video entry, certificato medico e musica della performance;
- sincronizzazione delle schede ricevute nel roster e nel flusso di gara.
- approvazione manuale della regia prima dell'ingresso nel roster;
- account scuola/coach con più atleti gestiti dallo stesso accesso;
- controllo video entry, riassegnazione motivata della categoria e stato pagamento;
- pratica progressiva con evidenza dei documenti mancanti;
- ritiro con storico conservato e cancellazione definitiva protetta.
- comunicazioni automatiche per video entry, categoria, pagamento, roster e ritiro;
- storico dei messaggi visibile sia alla regia sia nell’area riservata dell’atleta;
- coda email persistente: se il provider non è configurato, le comunicazioni restano recuperabili e possono essere reinviate.

Senza variabili database l'applicazione continua a funzionare in modalità locale. Quando Supabase è collegato, organizzazioni, iscrizioni, partecipanti, giudici, stato regia e votazioni vengono conservati centralmente e sincronizzati tramite API con controllo di revisione.

## Avvio Node.js / Hostinger

Il repository può essere distribuito come applicazione Node.js:

```bash
npm start
```

Il server usa automaticamente la variabile `PORT` fornita dall'hosting, pubblica ScoreFlow dalla root e rende disponibile il controllo di stato su `/health`.

## Aggiornamento da 2.4 a 2.5

1. Eseguire `supabase-migration-2.5.sql` nel SQL Editor del progetto Supabase.
2. Caricare il pacchetto applicativo su Hostinger e pubblicarlo.
3. Verificare `/api/status`: deve mostrare `version: 2.7.0` e `database: true`.

## Invio email (opzionale)

Lo storico comunicazioni funziona immediatamente senza modifiche al database. Per attivare anche l’invio email automatico, configurare nell’app Node.js di Hostinger:

- `RESEND_API_KEY`: chiave API del provider Resend;
- `SCOREFLOW_EMAIL_FROM`: mittente verificato, ad esempio `ScoreFlow <iscrizioni@dynamiczen.it>`;
- `SCOREFLOW_EMAIL_REPLY_TO`: indirizzo per le risposte, facoltativo.

Finché queste variabili non sono presenti, ScoreFlow conserva i messaggi come “in attesa” e mostra alla regia il pulsante per ritentare l’invio.

Per generare un codice di vendita, con le variabili Supabase disponibili, usare `npm run license:create -- professional`. Il codice viene mostrato una volta; nel database viene salvato soltanto l’hash.
