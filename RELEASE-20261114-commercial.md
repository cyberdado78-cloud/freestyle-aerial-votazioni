# ScoreFlow 3.6.0 — licenze commerciali e collegamento shop

## Pronto nel codice
- Attivazione sul proprio account verificato prima della creazione dell’organizzazione; nessun limite della prova applicato al cliente con licenza valida.
- Codici ad alta entropia da 3, 6 e 12 mesi. Durata da attivazione e rinnovo con conservazione del residuo, transazione atomica e riutilizzo idempotente sullo stesso account.
- Scadenza e revoca bloccano le modifiche senza eliminare i dati. Il termine della licenza non riattiva una prova residua. Controlli nel frontend, server e Postgres.
- Email di conferma dell’account distinguono licenza acquistata e prova, preservando il percorso anche se l’email viene aperta su un altro browser.
- Consegna automatica pronta per lo shop Hostinger scelto: rilettura ordine pagato, riconoscimento degli ID varianti, un codice per unità, cifratura e registro delle consegne, prenotazione e invio idempotente. Nessun endpoint pubblico di emissione.
- Backend e script di emissione non scaricabili via HTTP. Moduli di voto e risultati conservati.

## Stato di rilascio
Migrazione additiva applicata al database; nessun dato gara modificato. App di produzione ancora 3.5.1 fino al caricamento del nuovo pacchetto. Worker commerciale disabilitato finché mancano le credenziali e la mappatura dei prodotti.

## Da completare con le scelte del proprietario
Tre prezzi finali; creazione dei tre prodotti nello shop; autorizzazione del collegamento privato Hostinger per verifica ordini; pubblicazione runtime; verifica visiva e ordine controllato con consegna reale. Non dichiarare ancora la vendita attiva.

## Verifica completata
Suite npm test completa: 27 casi HTTP account, regressioni esistenti, 32 casi multi-client/server, nuove prove DOM del cliente pagante e prove della consegna. Test Postgres reali in transazione annullata: attivazione 3/6/12 mesi prima dell’evento, cambio proprietario respinto, chiamata ripetuta senza estensione, rinnovo, fine mese, limiti della prova rimossi per la licenza, scadenza senza ritorno alla prova, univocità ordine/consegna e permessi RPC. Fixture annullate, zero utenti di test rimasti. Chromium non avviabile per un limite di socket dell’ambiente: verifica visiva non dichiarata superata.
