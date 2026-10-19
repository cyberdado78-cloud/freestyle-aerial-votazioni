# ScoreFlow 2.7.2 — iscrizioni e postazioni

Pubblicazione su `https://scoreflow.dynamiczen.it` il 17 ottobre 2026. I file `app.js`, `server.js` e `index.html` sono stati aggiornati nella directory attiva Hostinger; il processo Node è stato riavviato. `/health` conferma versione `2.7.2`, servizio attivo e `email: false`. Il frontend scaricato corrisponde al sorgente distribuito.

## Correzioni

- Conservazione delle schede non inviate della regia durante aggiornamento automatico/manuale; arresto del timer quando si cambia modulo.
- Conservazione della sessione del giudice e della scheda non inviata durante aggiornamenti cloud. La bozza vale solo per lo stesso evento, atleta, fase, tentativo e giudice. Il logout esplicito resta effettivo.
- Iscrizione individuale, iscrizione di gruppo e aggiunta di atleti ignorano approvazioni, notifiche e riferimenti ad allegati forniti dal richiedente. Soltanto i flussi autorizzati del server possono impostarli. La modifica del profilo mantiene allegati e revisioni già registrati.

## Verifiche riproducibili

- 20 test frontend in jsdom: comprende 12 atleti nelle qualificazioni e 12 in finale, quattro giudici, per 96 schede.
- 8 test funzionali backend: dati non attendibili, profili di gruppo, mantenimento dati server, password, esiti email e escaping HTML.
- 37 verifiche API sulla copia isolata del backend con database/storage simulati.
- Collaudo API online: vedere `live-results-2.7.2.json` per esito e timestamp, dati interamente fittizi, account su `example.invalid`, organizzazione dedicata e iscrizioni chiuse a fine prova.

Il collaudo API verifica foto PNG, PDF tecnico marcato come falso, MP3 silenzioso e MP4 nero, associazione dei file, metadati durata, account individuali e scuola/coach, protezione degli allegati, approvazioni della regia, rifiuto di approvazioni contraffatte, autorizzazione staff e conflitti di revisione. Non certifica riproduzione multimediale in tutti i browser, collaudo su dispositivi fisici o l'intero modello autorizzativo. L'approvazione API viene verificata separatamente dalla copia frontend dell'atleta nel roster.

## Email: configurazione ancora assente

Le notifiche generate restano correttamente `pending`. Invio reale non eseguito né certificato. Il backend richiede `RESEND_API_KEY` e `SCOREFLOW_EMAIL_FROM`, con mittente valido presso il provider. I test del provider sono simulati e verificano che un errore non venga dichiarato come invio riuscito.

## Sorgenti e ripristino

`../recovered-2.7/` contiene i sorgenti originali recuperati dal deployment; `../release-2.7.2/` contiene i tre file pubblicati. Gli altri file e le dipendenze del deployment restano quelli recuperati. Nessuna migrazione del database. Non distribuire la root del branch `main`: contiene ancora la vecchia versione 1.5.

`server-2.7.2.patch` si applica al server originale 2.7; `judge-2.7.2.patch` al frontend già corretto 2.7.1. Per una copia esatta della release usare i tre file archiviati, evitando ambiguità nell'ordine delle patch.

Hash SHA-256 dei file pubblicati:

- `app.js`: `358fd49f8388d43d6cac9d2dd80a8c233b6d43cb83e8a53f60e07512de5a3bca`
- `server.js`: `27c58b8dfb2bdfe4bc968203dee1a98b14ec7946074370273725f7a4f484e0c0`
- `index.html`: `36fe201c8753693612622a9f304a2510ed76cd00fe75cdc7af403b5de9524d12`

Credenziali e sessioni dei collaudi non vengono incluse nel repository. I test online si rifiutano di approvare iscrizioni se il servizio email è configurato, per evitare invii esterni involontari.
