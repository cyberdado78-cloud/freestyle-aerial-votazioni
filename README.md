# freestyle-aerial-votazioni

ScoreFlow è disponibile direttamente da `index.html`. La precedente schermata pubblica FAC rimane in `display.html`.

## ScoreFlow v1.5

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

Questa versione salva i dati nel browser per consentire una simulazione completa sullo stesso computer. Autenticazione multi-dispositivo, database protetto, sincronizzazione offline, voto pubblico con QR e pagamenti saranno collegati nella fase backend.

## Avvio Node.js / Hostinger

Il repository può essere distribuito come applicazione Node.js:

```bash
npm start
```

Il server usa automaticamente la variabile `PORT` fornita dall'hosting, pubblica ScoreFlow dalla root e rende disponibile il controllo di stato su `/health`.
