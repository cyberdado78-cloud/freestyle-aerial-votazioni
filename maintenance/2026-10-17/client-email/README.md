# ScoreFlow 2.8.0 — email configurabile dal cliente

Pubblicata il 17 ottobre 2026 su scoreflow.dynamiczen.it. Il cliente usa Iscrizioni → Email dell’organizzazione per collegare il proprio account Resend. Inserisce nome mittente, email da dominio verificato, indirizzo risposte facoltativo e chiave API di invio. Può salvare senza attivare gli invii, inviare una prova a un indirizzo scelto, poi attivare o sospendere l’invio automatico. I limiti e i costi dipendono dal piano Resend del cliente; ScoreFlow non crea un account né acquista servizi.

## Isolamento e credenziali

La configurazione è separata dallo stato gara e non entra nel polling, nelle esportazioni, nelle schede atleta o nei link alle postazioni. Le API richiedono la chiave amministratore dell’organizzazione. Giudici e staff non possono leggere o scrivere le impostazioni. Le risposte API riportano solo presenza della chiave e stato della configurazione.

La chiave Resend è cifrata con AES-256-GCM, nonce casuale e contesto tenant autenticato. La chiave di cifratura è derivata con HKDF-SHA256 dalla chiave amministratore casuale dell’organizzazione e dal tenant. Il database conserva soltanto il ciphertext e l’hash della chiave amministratore. La perdita o sostituzione della chiave amministratore richiede il ricollegamento delle credenziali email; non esiste recupero della chiave Resend via API. Il campo password viene svuotato dopo il salvataggio e non si salva in localStorage.

La tabella scoreflow_email_settings ha RLS con SELECT, INSERT e UPDATE limitati al proprietario tramite la funzione autorizzativa già esistente. Gli invii di tutte le organizzazioni usano esclusivamente le proprie impostazioni: nessun ripiego sulle credenziali email globali. La rimozione della chiave disabilita l’invio. Le notifiche non inviate restano nello storico e richiedono un nuovo tentativo manuale dopo la configurazione; nessun invio massivo automatico dei messaggi arretrati.

## Prova e invio

Endpoint GET/PUT /api/tenants/:tenant/email-settings e POST /api/tenants/:tenant/email-settings/test. Il test usa le impostazioni salvate anche con invio automatico disattivato; blocca modifiche non salvate nell’interfaccia. La limitazione di una prova al minuto viene acquisita con un aggiornamento atomico nel database. Chiamate Resend con timeout di 12 secondi, chiave di idempotenza per notifica e messaggi di errore ripuliti.

La risposta positiva significa accettazione del messaggio dal servizio, non consegna nella casella. Non sono implementati webhook di consegna/rimbalzo. Le credenziali di ogni cliente e il dominio verificato restano necessari.

## Verifiche

- 18 test API/backend con trasporto email simulato: isolamento tenant, autorizzazione, cifratura, chiave mantenuta o rimossa, validazione, invio sospeso, mittente e risposte corretti, accettazione/rifiuto/errore rete, limitazione richieste.
- 6 test jsdom dell’interfaccia email: salvataggio, chiave svuotata, modifiche non salvate, prova, rimozione e gestione errori senza HTML eseguibile.
- Tutti i 20 test frontend precedenti passano, compreso percorso con 96 schede gara.
- 9 controlli sulle API pubblicate, senza invii: lettura/salvataggio persistente, credenziale sintetica cifrata, nessuna restituzione della chiave, attivazione e rimozione finale, blocco staff e chiave di altra organizzazione. Report live-settings-results.json.
- Prova RLS sul database reale, in transazione con rollback: proprietario ammesso, lettura/modifica/inserimento tra organizzazioni bloccati, staff escluso. Script rls-regression.sql.
- Salvataggio dalla schermata online verificato nel tenant dimostrativo. Configurazione lasciata vuota e disabilitata.
- /health conferma 2.8.0, emailMode per-organization. Hash del frontend servito uguale al sorgente pubblicato. Nessuna consegna email reale eseguita: provider simulato nei test funzionali.

L’advisor Supabase segnala avvisi preesistenti su due funzioni autorizzative SECURITY DEFINER e due tabelle senza policy, non sulla nuova tabella. Le funzioni esistenti eseguono i controlli di chiave previsti dall’attuale sistema e non sono state ampliate o modificate in questa release. Non si tratta di una certificazione dell’intero sistema autorizzativo.

## Deployment

Applicare schema.sql prima di distribuire i tre file di ../release-2.8.0/. Nessuna nuova dipendenza; processo Node riavviato. I file originali 2.7 e la release 2.7.2 sono archiviati nelle cartelle sorelle. La root di main resta la vecchia v1.5 e non deve essere distribuita.

Hash SHA-256:

- `app.js`: `d76decab0f05c23498ed04e41c98ec72cef2f5e7fa330315cdad421736e6538f`
- `server.js`: `d699be6979bc1afc2258507474ae96d4e125b8e94aa0e1ed8118a444acb14494`
- `index.html`: `1c7c28101e7b78e20d23b2befbf28cfd18c9f856eca60e39bdbecec049c1d158`

Riferimenti ufficiali: https://resend.com/docs/api-reference/emails/send-email e https://supabase.com/docs/guides/api/securing-your-api.
