# Rilascio commerciale 3.6.0

Runtime: stessi file di 3.5.1 più scripts/license-service.js e scripts/shop-licenses.js. Nessun reset dei dati. Migrazione additiva supabase/migrations/20261114105226_commercial_licenses.sql da applicare prima del runtime.

## Collegamento shop

Configurazione esclusivamente sul server, mai nel browser, nel repository o nella chat:

- HOSTINGER_API_TOKEN: token autorizzato ad accedere agli ordini; valutarne i permessi prima del collegamento, perché Hostinger dichiara che eredita i permessi dell’utente che lo crea.
- SCOREFLOW_SHOP_STORE_ID: negozio Dynamic Zen verificato.
- SCOREFLOW_SHOP_LICENSE_VARIANTS: JSON che associa gli identificativi veri delle varianti ai numeri 3, 6 o 12. Non usare titoli o SKU come prova del prodotto acquistato.
- SCOREFLOW_SHOP_ORDERS_FROM: data iniziale YYYY-MM-DD per il recupero degli ordini di vendita.
- SCOREFLOW_LICENSE_DELIVERY_KEY: 32 byte casuali, codificati come 64 caratteri esadecimali. Custodirla: cambiarla rende illeggibili le consegne ancora in attesa.
- Mantieni RESEND_API_KEY e SCOREFLOW_EMAIL_FROM esistenti. Nessuna chiave è inclusa nel pacchetto.

La consegna si abilita solo se tutti i valori sono presenti e il servizio email è configurato. Ogni minuto vengono controllati al massimo 20 dettagli ordine, con cursore per il recupero del pregresso; massimo 21 richieste Hostinger per esecuzione. Il processo non modifica prezzi, pagamenti, ordini o stato di evasione nel negozio. Verifica lo stato captured e il pagamento totale del singolo ordine rileggendolo dall’API ufficiale. Un ordine annullato, parzialmente pagato o rimborsato richiede intervento umano; non viene consegnato automaticamente.

Ogni unità ha un identificativo univoco per impedire doppia emissione. Codice salvato solo come hash nella licenza e cifrato AES-GCM nel registro privato delle consegne. La chiave di cifratura non viene salvata nel database. La prenotazione della consegna dura 5 minuti; i tentativi ripetuti usano la stessa chiave d’idempotenza Resend. Dopo 23 ore senza conferma è richiesta una verifica manuale per evitare invii ripetuti oltre la finestra d’idempotenza del provider.

Rimborsi successivi a una consegna: revisione e revoca amministrativa della licenza; non sono inclusi addebiti ricorrenti automatici. Nessuna promessa di revoca automatica dopo il rimborso.

## Verifica

npm test; SQL di scripts/commercial-license-db-test.sql dentro una transazione seguita da ROLLBACK dopo la migrazione; test reale dell’account acquistato e dell’ordine controllato dopo il collegamento shop. Il browser Chromium dell’ambiente corrente non si avvia per un limite ai socket di processo: la verifica visiva non è dichiarata superata. Test DOM, HTTP e Postgres completati con fixture sintetiche.
