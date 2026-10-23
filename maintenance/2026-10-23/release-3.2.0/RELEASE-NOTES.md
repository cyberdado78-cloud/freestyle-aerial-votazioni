# ScoreFlow 3.2.0 — Multilingua, QR pubblico e audit override

L’intera interfaccia può essere visualizzata in italiano, inglese, francese o spagnolo. La scelta è disponibile nell’account, nella configurazione e nel portale iscrizioni. Ogni scheda atleta conserva la lingua preferita e le comunicazioni automatiche della regia vengono generate in quella lingua, con fallback alla lingua dell’organizzazione.

Il voto pubblico resta opzionale per evento. Il cliente può abilitare separatamente il QR pubblico, generarlo su richiesta, scaricarlo e stamparlo. La funzione è disponibile anche durante la prova gratuita. Il server accetta i voti pubblici in modalità append-only e blocca un secondo voto dello stesso dispositivo per lo stesso atleta.

L’override manuale richiede ora una motivazione e crea uno storico immutabile con voto originale, voto sostitutivo, autore, data e identificativi collegati. Lo storico è visibile in regia. La ri-votazione dell’atleta continua a conservare i voti invalidati separatamente.

Migrazione richiesta prima del rilascio: `migrations/20261023_trial_public_voting.sql`.
