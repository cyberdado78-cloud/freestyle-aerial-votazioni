# ScoreFlow 3.0.1 — servizio email centrale configurato

## Stato verificato il 19 ottobre 2026

- Resend: dominio scoreflow.dynamiczen.it verificato; DKIM e i due CNAME di invio pubblicati nella zona DNS dedicata al sottodominio.
- Chiave di produzione creata con permesso Sending access, limitata al solo dominio scoreflow.dynamiczen.it. Nessun segreto in questo repository.
- Hostinger: RESEND_API_KEY, SCOREFLOW_EMAIL_FROM e SCOREFLOW_MANAGED_EMAIL_ENABLED configurati. Mittente tecnico: ScoreFlow <notifiche@scoreflow.dynamiczen.it>.
- /health: versione 3.0.1, email=true.
- /api/status: database=true, email=true, versione 3.0.1.
- Per ogni società restano necessari nome organizzazione, contatto di risposta e preferenza di invio. Il servizio gestito continua a richiedere una licenza evento attiva; nessuna licenza cliente è stata modificata.

## Ripubblicazioni Hostinger

Applicare le variabili d’ambiente ha provocato una nuova distribuzione dalla precedente copia sorgente 2.7.0, annullando temporaneamente i file 3.0 aggiornati manualmente il 17 ottobre. Ripristinati i quattro file verificati della 3.0 nella directory hbuilds/last-source, poi ripubblicati. La seconda ripubblicazione ha confermato che questa copia sorgente aggiornata viene effettivamente riutilizzata. Il nome storico dell’archivio nel pannello resta 2.7.0: la versione effettiva va controllata con /health e gli hash dei file.

Il server 3.0.1 archiviato in release-3.0.1 sostituisce quello della 3.0.0. I tre file app.js, index.html e styles.css restano quelli di maintenance/2026-10-17/release-3.0.0. Gli altri file esistenti (db.js, package/lock, assets, scripts e display) sono stati mantenuti sull’hosting. La root del repository main è ancora obsoleta: non distribuirla.

## Correzione e verifiche

Gli indicatori /health e /api/status riportavano email=false in modo fisso. Ora indicano la presenza della configurazione centrale abilitata, senza esporre credenziali o indirizzi. Non attestano consegna in casella, disponibilità del provider o abilitazione/licenza di una specifica società.

- 27 regressioni backend email: passate con il server 3.0.1 e provider simulato.
- 10 verifiche locali degli indicatori: servizio disabilitato, chiave assente, mittente assente, servizio configurato e database assente; entrambi gli endpoint, senza segreti nelle risposte.
- 64 regressioni precedenti della 3.0 ripetute con esito positivo prima della configurazione; interfaccia invariata in questa patch.
- Verifiche HTTP online: stato e versione confermati. JavaScript pubblico confrontato con la copia 3.0 archiviata.

## Limite del collaudo

Nessun invio reale o simulato a Resend è stato verificato in questa sessione. Il controllo automatico delle autorizzazioni ha rifiutato la creazione e poi la verifica dell’organizzazione QA proposta, ritenendole fuori dall’autorizzazione concessa. Il collaudo attraverso un’organizzazione di prova con licenza dedicata richiede autorizzazione esplicita. Lo stato di quell’operazione non è stato ulteriormente investigato dopo il rifiuto. Non presentare configurazione pronta o test locali come prova di consegna email.

I tre record aggiunti inizialmente alla zona padre dynamiczen.it sono rimasti presenti; sono ridondanti e mascherati dalla zona autonoma scoreflow.dynamiczen.it. I record efficaci sono quelli della zona dedicata. Non sono stati rimossi record preesistenti né modificati MX, nameserver o altri siti.
