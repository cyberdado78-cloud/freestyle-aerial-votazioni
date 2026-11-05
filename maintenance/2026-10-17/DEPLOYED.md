## Pubblicazione completata — 17 ottobre 2026

La correzione è stata applicata tramite il gestore file Hostinger ai soli `app.js` e `index.html` di `hbuilds/current/nodejs`. Il sito mostra **Versione 2.7.1 beta · Stabilità regia** e carica `app.js?v=2.7.1`.

SHA-256 del JavaScript servito online e della copia collaudata: `0ad500925308b8e31b11780224e4a946fa901c3e5bb50c8e72a6e47288c76c79`.

Verifica browser dopo pubblicazione: nella sola demo fittizia, il valore Tecnica `9.3` e la nota `Verifica conservazione bozza` sono rimasti presenti dalle 11:19:54 alle 11:20:35 UTC, quindi oltre due cicli del timer da 15 secondi. I 17 test isolati erano stati ripetuti sui due file pronti per il caricamento, con esito positivo.

I sorgenti attivi originali sono conservati in `recovered-2.7/` per il rollback e per recuperare l'allineamento futuro con GitHub. Non contengono variabili d'ambiente o credenziali dell'hosting. La root di main resta 1.5: questa PR non deve essere interpretata come una distribuzione automatica della root aggiornata.

Backend, database, account, dati di gara e gli altri siti non sono stati modificati dalla pubblicazione. Le operazioni di prova sono limitate all'organizzazione `COLLAUDO ScoreFlow 17-10-2026` creata per questo collaudo; il suo portale iscrizioni è stato richiuso.

Restano da eseguire il collaudo di iscrizione autenticata, revisione/approvazione, caricamento documenti/MP3, consegna email e postazioni realmente separate.
