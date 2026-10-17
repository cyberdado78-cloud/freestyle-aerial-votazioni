# ScoreFlow 2.7.0

## Comunicazioni iscrizioni

- Generazione automatica dei messaggi della regia per approvazione o correzione del video entry.
- Conferme relative a categoria assegnata, pagamento, ingresso nel roster, ritiro e ripristino.
- Storico separato per ogni atleta, conservato nella scheda Supabase esistente.
- Messaggi consultabili anche nell’area riservata dell’atleta o del coach.
- Invio email tramite Resend quando il servizio è configurato.
- Coda persistente e tentativo manuale quando l’email è in attesa o fallisce.
- Nessuna nuova migrazione SQL necessaria.

## Pubblicazione

1. Caricare il contenuto del pacchetto su Hostinger e pubblicare.
2. Controllare `/api/status`: versione `2.7.0`, database `true`.
3. Senza configurazione email, tutte le comunicazioni restano comunque salvate nello storico.
