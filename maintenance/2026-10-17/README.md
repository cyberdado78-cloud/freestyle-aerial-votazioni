# ScoreFlow — collaudo del 17 ottobre 2026

La versione **2.7.2 beta — Iscrizioni e postazioni** è pubblicata su https://scoreflow.dynamiczen.it. Contiene la correzione delle bozze della regia, il mantenimento della sessione e delle bozze del giudice durante aggiornamenti cloud, e la protezione dei dati di approvazione nelle iscrizioni.

Dettagli del deployment, test, limiti ed email: [registration-qa/README.md](registration-qa/README.md).

- `recovered-2.7/`: sorgenti originali completi recuperati dall'installazione attiva.
- `release-2.7.2/`: tre file aggiornati effettivamente distribuiti; gli altri sorgenti e le dipendenze rimangono quelli recuperati.
- `control-regression.cjs`: 20 test frontend, incluso percorso completo di 12 qualificazioni e 12 finali con quattro giudici (96 schede).
- `registration-qa/`: patch, 8 test backend, runner locale isolato, collaudo API e report senza credenziali.

**Il branch `main` contiene ancora la vecchia root 1.5: non distribuirla sopra il backend 2.7.2.** Nessuna migrazione del database eseguita. La PR resta in bozza come archivio di manutenzione e verifica; il deployment è stato eseguito sulla directory attiva Hostinger dopo backup, seguito da riavvio del processo e verifica HTTP/browser.

L'email rimane non configurata (`/health.email: false`): le comunicazioni sono registrate come in attesa e la consegna reale non è certificata. Servono `RESEND_API_KEY` e `SCOREFLOW_EMAIL_FROM` con mittente valido.
