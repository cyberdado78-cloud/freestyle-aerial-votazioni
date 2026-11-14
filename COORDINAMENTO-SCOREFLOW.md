# Coordinamento ScoreFlow — 14 novembre 2026

Le chat «Aggiornamento ScoreFlow» e «Partecipanti Tessuti 2026» stanno lavorando sullo stesso progetto. Un nuovo pacchetto deve comprendere entrambe le linee di lavoro: non ridistribuire copie precedenti che cancellerebbero modifiche già integrate.

## Base comune

Ramo: integration/scoreflow-20261114. Versione consolidata: 3.6.1, non ancora pubblicata.

Provenienza verificata:
- Licenze e shop: feat/commercial-licenses-20261114, ba1b10f897b94c4b21429e2c60cdc845e19680b7.
- FUORI CATEGORIA: fix/judge-out-of-category, 562f711a361badc44bb9f9e0da074b4dc779c3db.
- Reset e sincronizzazione: contenuto di ScoreFlow-Reset-Post-Test.zip, verificato rispetto al ramo FUORI CATEGORIA: differenze soltanto in app.js e server.js, entrambe integrate.

La 3.6.0 preparata nella chat commerciale precede l’allineamento: non caricarla sopra la versione del reset. Usare il pacchetto consolidato e confrontare sempre il live prima di un nuovo deploy, perché l’altra chat può aver distribuito altri aggiornamenti.

## Decisioni confermate della gara

- Nome: INTERNATIONAL FREESTYLE AERIAL COMPETITION – SESTA EDIZIONE.
- Date: 17–18 aprile 2027.
- Il regolamento definitivo è ancora in preparazione: nessuna apertura delle preiscrizioni sulla base del documento tecnico di collaudo.
- Il cliente ha autorizzato nell’altra chat l’eliminazione completa del collaudo. Il vecchio vincolo di conservarne i voti è superato. Non eseguire qui un secondo reset o una seconda cancellazione mentre l’intervento sui dati è in corso nell’altra chat.
- Pulsante FUORI CATEGORIA con motivazione obbligatoria. Nel modello FAC corrente: 10 punti sottratti una volta al risultato finale; l’atleta resta nella categoria assegnata. Il nuovo regolamento caricato dovrà essere verificato prima di applicare le regole FAC 2027.
- La penalità FUORI CATEGORIA non apre una richiesta di riclassificazione. Le vecchie penalità di tipo final rimangono interpretabili per compatibilità storica; non reinterpretare automaticamente voti precedenti.
- Il reset incrementa resetGeneration; dati di generazioni diverse non vengono riuniti e la postazione precedente riceve event-reset.

## Commercializzazione

Preparati codici 3/6/12 mesi, attivazione prima della configurazione, rinnovi, scadenza e consegna codici da ordini verificati. Migrazione commerciale già applicata; runtime ancora da pubblicare. Shop scelto: Dynamic Zen.

Prezzi 99/179/299 euro IVA inclusa: proposta dell’assistente, non ancora accettata dal proprietario. Non pubblicare prodotti o prezzi finché non confermati.

Collegamento privato agli ordini, prodotti e verifica di acquisto/consegna reali ancora da completare. Esportazione attuale: JSON e accesso singolo ai file. Download cumulativo di video e allegati, quota per cliente e conservazione post-scadenza restano da implementare/definire. Non dichiarare ScoreFlow già pronto alla vendita.

## Verifiche

Suite npm test completa superata sulla versione unificata. 35 verifiche HTTP/multi-client, inclusi rifiuto delle vecchie postazioni dopo reset e assenza di resurrezione dei voti; prove DOM FUORI CATEGORIA e percorso licenze, più prove di consegna. Browser Chromium locale non disponibile: collaudo visivo della versione unificata da completare dopo il rilascio.
