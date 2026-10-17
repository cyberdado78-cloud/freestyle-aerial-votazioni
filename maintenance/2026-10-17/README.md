# ScoreFlow — manutenzione del 17 ottobre 2026

La versione **2.8.0 beta — Email configurabile** è pubblicata su https://scoreflow.dynamiczen.it. Ogni cliente può collegare il proprio account Resend da Iscrizioni → Email dell’organizzazione, salvare una chiave cifrata e isolata dal resto della piattaforma, inviare una prova, attivare o sospendere le comunicazioni automatiche. Non sono necessari interventi sul server per configurare un nuovo cliente.

Dettagli, controlli e limiti della release attuale: [client-email/README.md](client-email/README.md). La consegna reale richiede account Resend e dominio mittente verificato del cliente; non è stata certificata con credenziali reali.

- `release-2.8.0/`: i tre file effettivamente pubblicati; nessuna nuova dipendenza.
- `client-email/`: schema SQL applicato con RLS, test API/interfaccia, prova RLS con rollback e report di 9 controlli online. 18 test backend email, 6 interfaccia email e i 20 test di votazione passano.
- `release-2.7.2/` e `registration-qa/`: precedente correzione bozze regia/giudici e protezione iscrizioni; report 37 verifiche API online.
- `recovered-2.7/`: sorgenti originali completi recuperati dall’installazione.
- `control-regression.cjs`: 20 test frontend, incluso percorso con 96 schede nelle qualificazioni e in finale.

**La root di main è ancora v1.5 e non deve essere distribuita sul backend attivo.** Questa PR resta in bozza come archivio verificabile. Il deployment delle versioni attuali è stato eseguito nella directory attiva Hostinger, dopo backup, seguito da riavvio Node e verifica HTTP/browser.
