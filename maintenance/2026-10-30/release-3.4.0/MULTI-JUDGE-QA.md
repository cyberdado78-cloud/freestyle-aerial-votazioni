# Collaudo locale di tre giudici - 10 novembre 2026

Copia del pacchetto 3.4.0, tre contesti JSDOM indipendenti, quattro accessi per ruolo, server HTTP reale e archivio Supabase simulato in memoria. Dati tutti sintetici: cinque esibizioni concluse, 15 schede pregresse e una nuova esibizione TEST. Nessun accesso al database remoto o all'hosting.

Prima della correzione gli invii simultanei persistevano 2 schede su 3: il terzo client esauriva l'unico retry e restava offline con il voto locale. Dopo: fino a cinque retry, ciascuno con merge e salvataggio condizionato sulla revisione.

11 verifiche PASS: blocco iniziale; tre voti simultanei; conservazione delle 15 schede sintetiche; disconnessione senza scrittura; recupero dopo riconnessione; sblocco regia; media 42; classifica; blocco con due giudici; deduplicazione; ripetizione con tre schede archiviate e 15 pregresse intatte. Anche l'intera suite npm test passa.

Riproduzione dalla cartella release: npm ci --ignore-scripts, npm test, node multi-judge-regression.cjs server.js. Report opzionale tramite SCOREFLOW_QA_REPORT.

Riparato il lockfile: una dipendenza transitoria CSS 3.3.0 restituiva 404. Nuovo lock generato dal package.json invariato; sei risoluzioni transitorie cambiate, incluse css-color 3.2.0 e corretta collocazione di webidl-conversions. Installazione pulita npm ci riuscita, poi suite e simulazione rieseguite con le dipendenze del progetto. Node 24.22.1.

Restano da verificare database remoto e RLS, rete reale, dispositivi fisici e distribuzione Hostinger. Questo test locale non certifica il collaudo end-to-end sul server. Modifiche limitate al pacchetto 3.4.0, nessun deploy o modifica dei dati reali.
