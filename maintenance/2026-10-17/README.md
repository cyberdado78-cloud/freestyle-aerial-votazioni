# ScoreFlow — collaudo del 17 ottobre 2026

## Risultato e stato della correzione

Il sito pubblicato è **2.7.0 beta — Comunicazioni iscrizioni**. Il branch `main` di questo repository è invece ancora **1.5.0**, commit `de083cf0447dbeb309a5ccb0301b5523254908d3` del 1 ottobre. Questa proposta conserva una patch per il frontend 2.7, senza sostituire il vecchio server con un'app incompatibile con il backend online. **La patch non è pubblicata sul sito.**

### Problemi riprodotti

1. Durante una performance, l'aggiornamento automatico della regia ogni 15 secondi ricrea il modulo e perde valori, giudice selezionato e motivazione della penalità non ancora salvati. Riprodotto sul sito: Tecnica `9.3` ritorna a `0`.
2. Un timer della regia può ridisegnare la regia dopo che l'operatore è passato ai Risultati o a un altro modulo.
3. Il timer usa l'oggetto organizzazione catturato prima dell'eventuale sostituzione con dati cloud aggiornati.

La patch conserva il modulo soltanto per la stessa organizzazione, evento, atleta, fase e tentativo; non trasferisce una bozza a un altro atleta o a un giudice disattivato. Ferma il timer all'uscita e usa lo stato più recente.

## Verifiche

### Sul sito, con dati fittizi

Creata organizzazione `COLLAUDO ScoreFlow 17-10-2026`, evento `SIMULAZIONE TECNICA — dati fittizi`, 12 atleti e 4 giudici.

- Avanzamento bloccato fino al quarto voto; poi passaggio al concorrente successivo riuscito.
- Penalità senza motivazione rifiutata.
- Quattro voti da 8 con penalità 1 al primo giudice: classifica corretta **7.75**.
- Ritiro: atleta conservato e passaggio al successivo riuscito.
- Portale pubblico: apertura/chiusura fasi e visualizzazione moduli individuale e scuola/coach verificate.
- Supabase `scoreflow-production`: `ACTIVE_HEALTHY`, tabelle operative presenti con RLS abilitato. Questo controllo non certifica l'intero modello autorizzativo.

### Sulla copia isolata del frontend online

Il file `control-regression.cjs` esegue il codice applicativo reale in jsdom, con rete disabilitata e timer controllati. Verifica bozze e aggiornamenti, voto giudice definitivo, voto pubblico separato e non ripetibile sul dispositivo, ritiri, ripetizione con archiviazione, finale con storico separato e reset che conserva roster/giudici/configurazione. Include un percorso completo di 12 atleti nelle eliminatorie e 12 in finale, 4 giudici: **48 + 48 schede**.

Questi test non sostituiscono il collaudo multi-dispositivo reale. Non sono stati creati account atleti né inviati messaggi di iscrizione; restano da verificare iscrizione autenticata, revisione/approvazione end-to-end, upload MP3/documenti e consegna email.

## Applicazione controllata

La patch si applica esclusivamente al file pubblicato `app.js?v=2.7.0`, scaricato da `https://scoreflow.dynamiczen.it/app.js?v=2.7.0` il 17/10/2026.

SHA-256 originale:

```
b772743515fc9f0186dc745085b8df7cf5aa40a4ff9afed1bd79b7a471861c32
```

Recuperare prima i sorgenti completi dell'installazione 2.7 e i dettagli del deploy. Non distribuire la root 1.5 di questo repository sopra l'installazione 2.7.

In una copia di lavoro dei sorgenti 2.7, verificare l'hash, quindi:

```bash
git apply --check /path/to/scoreflow-2.7-control-draft.patch
git apply /path/to/scoreflow-2.7-control-draft.patch
node --check app.js
```

Per riprodurre i test, installare `jsdom@26.1.0` in una directory temporanea e fornire i percorsi dei file 2.7 (nessuna dipendenza di produzione richiesta):

```bash
NODE_PATH=/path/to/test-deps/node_modules node control-regression.cjs /path/to/app.js /path/to/index.html
```

Confronto: la versione originale fallisce sei regressioni; la patch deve superare l'intera suite. Dopo deploy: ripetere la prova dei 15 secondi nel browser e verificare navigazione, salvataggio e sincronizzazione da postazioni distinte.

## Blocco pubblicazione

Il collegamento Hostinger ha restituito `Connection to establish proxy tunnel timed out after 5000ms`; un successivo tentativo non ha restituito un risultato entro il limite. Nessun deploy eseguito. Serve recuperare l'installazione aggiornata tramite il pannello Hostinger prima della pubblicazione.
