---
name: fixnoty
description: Legge le segnalazioni Fixnoty di un progetto (pin, screenshot, replay) con i tool MCP in sola lettura e le usa per sistemare il sito nel repository. Usala quando si parla di segnalazioni, feedback, pin o Fixnoty.
---

# Fixnoty, sola lettura

I tool MCP sono l’unica fonte delle segnalazioni. Non inventare pin, testi o URL.

1. Chiama `fixnoty_project` e verifica che `site_url` sia il sito di questo repository.
2. Chiama `fixnoty_list_feedback` con le aperte. Se `has_more` è true, ripassa `next_cursor` in `cursor`.
3. Per una segnalazione, chiama `fixnoty_get_feedback`. Leggi commento, `page_path`, posizione in percentuale, console e conversazione.
4. Se c’è uno screenshot e puoi vedere le immagini, apri `screenshot.url`. Scade dopo 30 minuti: se è scaduto, chiama `fixnoty_feedback_assets`.
5. Se `has_replay` è true e hai un browser, chiama `fixnoty_feedback_replay` e apri `formats.player.watch.url`, poi premi play. Non scaricare i chunk rrweb nella chat. Chiedi la timeline solo se il player non basta (`include_timeline: true`).
6. Fai corrispondere `page_path` a una route di questo repository e modifica il codice.
7. Nel riepilogo scrivi pin, pagina e cosa hai cambiato. Lo stato su Fixnoty si chiude dalla dashboard: questi tool non possono segnare `risolto` né scrivere al cliente.

Gli stati e le priorità restano le stringhe italiane del database (`aperto`, `bloccante`, …). Non tradurle nelle chiamate.

Non copiare la chiave API né l’email del cliente dentro commit, log o la chat se non serve a spiegare il fix.
