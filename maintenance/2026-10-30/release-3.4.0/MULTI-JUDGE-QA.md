# Collaudo locale di tre giudici - 10 novembre 2026

Copia del pacchetto 3.4.0, tre contesti JSDOM indipendenti, quattro accessi per ruolo, server HTTP reale e archivio Supabase simulato in memoria. Tutti i dati sono sintetici: cinque esibizioni concluse, 15 schede pregresse e una nuova esibizione TEST. Nessun accesso o modifica a Supabase remoto, evento Collaudo ScoreFlow reale o hosting.

Prima della correzione: invii simultanei persistono 2 schede su 3; il terzo client esaurisce l'unico retry e resta offline con il voto locale. Dopo: fino a cinque retry in caso di conflitto di revisione, sempre con merge dei voti e salvataggio condizionato sulla revisione.

11 verifiche PASS: blocco iniziale; tre voti simultanei; conservazione delle 15 schede sintetiche; disconnessione senza scrittura; recupero dopo riconnessione; sblocco regia; media 42; classifica; blocco con soli due giudici; deduplicazione; ripetizione con tre schede archiviate e 15 pregresse intatte.

Esecuzione nella cartella release: `node multi-judge-regression.cjs server.js`. Report opzionale: variabile SCOREFLOW_QA_REPORT. Anche la suite npm test esistente passa. La dipendenza transitoria @asamuzakjp/css-color@3.3.0 del lockfile non era scaricabile (404); suite eseguita con dipendenze di test installate in cartella isolata, senza alterare il lockfile. Restano da verificare il database remoto, RLS, rete reale, dispositivi fisici e distribuzione Hostinger. Questo esito locale non certifica il collaudo end-to-end sul server.
