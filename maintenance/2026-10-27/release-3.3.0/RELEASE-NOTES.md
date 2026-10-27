# ScoreFlow 3.3.0 — Profilo regolamento FAC 2026

Base: release 3.2.0 sul ramo fix/scoreflow-2.7-control-draft. La root del repository contiene ancora la versione 1.5: questo pacchetto completo è nella presente cartella e non sostituisce automaticamente la produzione.

## Comportamento

In Evento e regolamento, “Prepara profilo FAC 2026” configura sei criteri 1–10 a peso uguale. Mantiene categorie e partecipanti esistenti, richiede l'associazione esplicita di ciascuna categoria e impedisce di cambiare profilo dopo il primo voto. Le opzioni FAC restano separate dalle gare generiche.

Il profilo include le 18 categorie/livelli del 2026 con età e tempi, quote singolo/duo, minimo tre partecipanti, rapporto pass coach e durata minima video. Quote e pass sono parametri di riferimento, non un sistema di riscossione o emissione pass.

Prima dell'approvazione roster, il server verifica disciplina, categoria associata, età alla data di iscrizione, durata musica, nome e MIME MP3 e accettazione del regolamento. La regia conferma video, precedenti vittorie/requisiti e, per i duo, entrambi i componenti. Non viene inventato uno storico vittorie: tale verifica è umana. Durata audio e MIME restano metadati del caricamento; non è inclusa una decodifica audio server-side. Nei vecchi account privi della data per atleta, si usa la data di creazione della pratica. Per i nuovi atleti viene conservata una data individuale controllata dal server.

Classifiche e CSV separano disciplina e categoria. A pari totale, lo spareggio usa la media di Performance generale, Tecnica, Coreografia, in quest'ordine. La parità residua mantiene la stessa posizione; nelle finali vengono inclusi tutti i pari merito alla soglia. Risultati incompleti e ritirati non ricevono posizione. Il voto pubblico rimane separato come nella 3.2.

Il preset applica il metodo riscontrato nel master FAC 2026: somma dei sei criteri su 60, sottrazione della penalità di ciascun giudice, media aritmetica dei tre totali; visualizzazione a due decimali. Il metodo è già confermato dalla fonte, senza richiedere una nuova scelta. Restano configurabili varianti per eventi successivi. Nel master sono presenti penalità 0,5 e 0,7: il preset usa minimo 0,5 (modificabile con passo 0,1), diversamente dal minimo 1 del PDF. Questa è una differenza documentata fra prassi e regolamento, non una modifica del PDF. Le penalità si sottraggono al totale di ogni giudice, con minimo/massimo configurabili e motivazione. Valori invalidi vengono respinti anche dal server. Regole, criteri, categorie e discipline sono bloccati dopo il primo voto sul salvataggio autenticato.

## Fonti

- Email inviata il 22 gennaio 2026: https://mail.google.com/mail/u/?authuser=freestyleaerialcompetition%40gmail.com#all/19be56439a14df85
- PDF indicato dal sito: https://www.freestyle-academy.it/_downloads/912930ddb3669e4dc35bd736e53f955a
- Canva: https://www.canva.com/d/46vknrM-A-LnOes

- Master gara, tab VOTI_GIUDICI e RISULTATI: https://docs.google.com/spreadsheets/d/1h49cuxz5Wt1nrpUBgJPZhEq0w2Rhw6z5GKzB2oxY0KI/edit
- Verifica del 27 ottobre 2026: tutti i 131 risultati numerici completi nelle righe 2–160 coincidono con la media dei tre totali a due decimali. Sono presenti righe storiche con test_mode ON e alcune incongruenze di trascrizione nei voti: nessuna importazione o correzione automatica dello storico.

## Da configurare o sviluppare separatamente

- Scadenze della nuova edizione: usare la sezione Iscrizioni già presente; non vengono riutilizzate le date scadute 2026.
- Accorpamenti, annullamenti e rimborsi: avviso sotto minimo, decisione manuale; nessun automatismo finanziario.
- Squalifica: non è introdotto un nuovo workflow di richiesta/confronto/decisione.
- Controllo tecnico degli attrezzi, materassi e assicurazioni: non automatizzato.
- Archivio verificato delle vittorie storiche, gestione anagrafica strutturata dei due membri, emissione pass, tariffazione automatica: non implementati in questo pacchetto.
- Il nuovo pannello usa testi italiani; la traduzione completa dei nuovi messaggi resta da aggiungere.

## Verifica e distribuzione

`npm ci --ignore-scripts && npm test` nella cartella del pacchetto. Eseguiti controlli sintattici, regressioni 3.2, health, 20 test account, 12 test UI account, test FAC funzionali e rendering del pannello con JSDOM. Nessun test end-to-end sul database reale o su Hostinger, nessuna modifica ai dati reali. Nessuna nuova migrazione SQL: opzioni e verifiche usano JSON già esistenti. Rimane necessaria la migrazione 3.2 se non applicata.

Pacchetto predisposto per revisione; non distribuito automaticamente. Prima del rilascio verificare su staging una pratica individuale e una scuola, l'approvazione roster, il salvataggio multi-dispositivo, CSV e stampa scheda.

## Configurazione generale dal regolamento (27 ottobre)

Il pannello Evento e regolamento ora offre un percorso per qualsiasi organizzatore, prima del modello FAC:

- PDF e DOCX fino a 10 MB: originale nel bucket privato esistente, estrazione testo sul server, testo consultabile anche dai giudici. Nessun servizio IA esterno e nessuna chiave API aggiuntiva.
- Analisi deterministica iniziale in italiano/inglese: riconosce indicazioni esplicite di somma/media dei criteri e giudici, numero giudici, intervallo penalità e righe etichettate di categorie, discipline e criteri. Ogni riconoscimento mostra citazione e numero di riga del testo estratto. Le righe non corrispondono necessariamente alle pagine PDF.
- Riepilogo modificabile: criteri, intervalli, pesi, decimali, aggregazione fra giudici, penalità, priorità spareggi, categorie, discipline, età alla data di iscrizione e durate in secondi. Valori non riconosciuti conservano le impostazioni esistenti e sono segnalati. Indicazioni contrastanti non vengono risolte automaticamente.
- Conferma esplicita prima dell'applicazione; blocco dopo il primo voto, anche lato server. Se cambia il testo dopo l'analisi, serve una nuova proposta. Una versione approvata conserva testo, riferimento al file e configurazione. Una configurazione di voto modificata fuori dal percorso richiede nuova approvazione.
- Applicazione alle schede giudice, calcolo e spareggi, classifiche per disciplina/categoria e controlli server di ammissione su età/durata. Gli atleti già presenti non vengono eliminati né spostati implicitamente.
- Modelli riutilizzabili via esportazione/importazione di file ScoreFlow JSON, senza atleti, risultati o testo sorgente. Importazione sempre da verificare prima di applicare.
- Caricamento del regolamento incluso nella prova; restano gli altri limiti della prova, fra cui due categorie.

### Limiti espliciti di questa prima implementazione

Non è un interprete IA universale: clausole narrative, tabelle complesse, OCR e documenti protetti non vengono interpretati automaticamente. Il testo può essere incollato e la configurazione completata manualmente. Le età/durate sono editabili ma non estratte automaticamente; altre date di riferimento per l'età non sono ancora supportate. Quote, requisiti speciali, documenti obbligatori e scadenze non vengono impostati da questo importatore: rimangono le sezioni e i controlli esistenti. Il modello generale non incorpora i controlli speciali FAC video/duo/vittorie; il pannello lo esplicita prima della conferma. Le penalità sono sottratte per giudice prima dell'aggregazione, con soglia zero; altre politiche non sono ancora disponibili. Nuovi testi in italiano, traduzioni complete da completare prima di un lancio internazionale.

L'estrazione usa un worker separato con limite di memoria e timeout 20 secondi; PDF oltre 100 pagine respinti. Un errore di estrazione mantiene disponibile l'originale e chiede testo leggibile. Non è stato attivato alcun nuovo servizio cloud. Richiesto Node >=20.16 <21 oppure >=22.3; dipendenze esatte pdf-parse 2.4.5 e mammoth 1.11.0.

Test aggiunti: PDF e DOCX reali sintetici, riferimenti e conflitti, mancata conferma, cambio testo dopo analisi, applicazione punteggi ponderati, ammissione generica, preservazione iscritti, versioni, blocco dopo voto, schema modelli e rendering con testo ostile neutralizzato. Restano da verificare cloud/staging, upload effettivo autenticato e più dispositivi prima della distribuzione. Nessun documento di gara o dato storico dell'utente modificato.
