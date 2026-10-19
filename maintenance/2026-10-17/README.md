# ScoreFlow — manutenzione del 17 ottobre 2026

La versione **3.0.0** è pubblicata su https://scoreflow.dynamiczen.it: dashboard e schermate operative rinnovate, navigazione accessibile e responsive, notifiche non bloccanti, caricamento iscrizioni più chiaro ed email semplici con modalità gestita da ScoreFlow.

Dettagli della release attuale, verifiche e limiti: [experience-3/README.md](experience-3/README.md).

**L’invio centrale non è ancora attivato.** Il cliente può salvare nome e contatto senza configurare account o DNS; il gestore deve attivare una volta il mittente centrale e le credenziali server. Il backend richiede una licenza evento valida per gli invii centrali. Il collegamento personale Resend resta facoltativo nelle opzioni avanzate. Nessuna consegna reale è stata dichiarata o simulata in produzione.

- `release-3.0.0/`: quattro file pubblicati (app.js, server.js, index.html, styles.css), nessuna nuova dipendenza.
- `experience-3/`: schema applicato, 64 test locali passati, 13 verifiche API online senza invii, hash dei file e documentazione.
- `release-2.8.0/` e `client-email/`: precedente configurazione email per organizzazione e relativi test.
- `release-2.7.2/` e `registration-qa/`: correzioni bozze e protezione iscrizioni; report con 37 verifiche API online.
- `recovered-2.7/`: sorgenti completi originali recuperati dal deployment.

**La root di main è ancora v1.5 e non deve essere distribuita sul backend attivo.** La PR resta in bozza come archivio verificabile. Deployment diretto sulla directory attiva Hostinger dopo backup e seguito da verifica HTTP/browser; nessuna modifica ai dati reali degli iscritti e nessun servizio acquistato.
