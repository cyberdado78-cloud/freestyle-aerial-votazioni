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

## Collaudo tecnico completato dopo autorizzazione esplicita

Il 19 ottobre l’utente ha autorizzato l’organizzazione temporanea, la licenza di prova e un invio all’indirizzo tecnico delivered@resend.dev. Creata la sola organizzazione qa-email-20261019-c9d2e3ea, con dati fittizi e nessun evento/portale aperto. Associata una licenza tecnica temporanea senza acquisti o modifiche alle licenze dei clienti.

Il test è passato attraverso POST /api/tenants/{tenant}/email-settings/test sull’app di produzione, usando la modalità gestita centrale e nessuna chiave API personale della società. Risposta HTTP 200 e lastTestStatus=accepted. Il dettaglio Resend mostra:

- ID messaggio 01a1536c-bd68-7c8c-b0a2-7daa0801508a.
- From: "COLLAUDO SOCIETÀ ORGANIZZATRICE · ScoreFlow" <notifiche@scoreflow.dynamiczen.it>.
- Reply-To: info@freestyle-academy.it.
- To: delivered@resend.dev, destinatario tecnico di simulazione Resend.
- Eventi Sent e Delivered visibili nel pannello del provider.

Questo verifica il percorso reale app → API Resend e il comportamento del destinatario di test; non certifica arrivo, spam o lettura in una casella reale Gmail/Outlook. Non sono stati inviati messaggi a iscritti o clienti reali. Le preferenze automatiche dell’organizzazione QA sono rimaste disabilitate; la funzione di prova usa intenzionalmente il trasporto salvato anche con invii automatici disabilitati.

Dopo il test: impostazioni QA email_enabled=false, licenza QA active=false ed expires_at aggiornato, organizzazione rinominata COLLAUDO EMAIL 19-10-2026 — CHIUSO. Controllo finale SQL conferma questi stati e last_test_status=accepted. Nessun dato eliminato; traccia del test conservata.

I tre record aggiunti inizialmente alla zona padre dynamiczen.it sono rimasti presenti; sono ridondanti e mascherati dalla zona autonoma scoreflow.dynamiczen.it. I record efficaci sono quelli della zona dedicata. Non sono stati rimossi record preesistenti né modificati MX, nameserver o altri siti.

## Casella reale: verifica finale completata

Dopo autorizzazione esplicita dell’utente, inviata una sola email di prova alla sua casella reale. Riutilizzata la stessa organizzazione QA con licenza tecnica riattivata per dieci minuti e invii automatici sempre disabilitati.

Verifiche attraverso il connettore Gmail della casella destinataria:

- messaggio presente in INBOX e CATEGORY_UPDATES, senza etichetta SPAM;
- nome mittente Freestyle Academy ASD · ScoreFlow e indirizzo tecnico notifiche@scoreflow.dynamiczen.it;
- Reply-To corrispondente all’indirizzo della società destinataria;
- Authentication-Results: SPF pass, DKIM pass, DMARC pass;
- una sola chiamata di invio, protetta localmente da un marcatore per evitare ripetizioni accidentali.

Licenza QA disattivata di nuovo al termine. Il servizio centrale resta attivo. Il risultato vale per questa singola consegna: non garantisce la stessa classificazione per tutti i provider o tutte le comunicazioni future. Nessun dettaglio privato della casella o identificativo Gmail pubblicato nel repository.
