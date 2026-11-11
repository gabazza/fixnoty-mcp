# MCP Fixnoty (sola lettura)

Server locale che collega Cursor e Claude alle segnalazioni di **un** progetto Fixnoty. Usa l’API v1 già online: non è un servizio nuovo e non ha un costo di store.

Legge. Non cambia stato, non commenta, non cancella.

Serve una chiave di progetto (`fn_live_…`), creata in **Impostazioni progetto → API**. È inclusa nei piani Pro e Agency (e negli account demo). La prova gratuita riceve `403 plan_required`.

## Cosa può chiedere l’agente

| Tool | Lettura |
|---|---|
| `fixnoty_project` | Nome e URL del sito collegato alla chiave |
| `fixnoty_list_feedback` | Elenco leggero. Default: aperte |
| `fixnoty_get_feedback` | Testo, pin, browser, console, conversazione, screenshot firmato (30 minuti) |
| `fixnoty_feedback_assets` | Rinnova gli URL firmati |
| `fixnoty_feedback_replay` | Player da 24 ore. La timeline è omessa salvo `include_timeline` |

Gli stati restano in italiano: `aperto`, `in_lavorazione`, `in_attesa_cliente`, `risolto`, `archiviato`.

Se l’agente ha un browser e la segnalazione ha un replay, apre `formats.player.watch.url` e preme play. Quell’indirizzo è già la credenziale, per 24 ore. Un GET nudo restituisce la pagina del player, non i fotogrammi. I chunk rrweb non vanno incollati in chat.

## Avvio

Node 20 o superiore.

```bash
npm install
npm run build
```

Variabili:

| Variabile | Obbligatoria | Valore |
|---|---|---|
| `FIXNOTY_API_KEY` | sì | `fn_live_…` o `fn_test_…` |
| `FIXNOTY_API_BASE_URL` | no | Default `https://www.fixnoty.com`. `http` solo su localhost |

La chiave viaggia nell’header `Authorization`. Non va nell’URL, nel repository, né nei log del server: se manca o è malformata il processo esce con un messaggio che non ripete il valore.

## Cursor

In `.cursor/mcp.json` del progetto, oppure nelle impostazioni MCP dell’utente. Sostituisci il percorso e la chiave. Un esempio completo è in [`cursor.mcp.json.example`](cursor.mcp.json.example).

```json
{
  "mcpServers": {
    "fixnoty": {
      "command": "node",
      "args": ["/PERCORSO/ASSOLUTO/fixnoty-mcp/dist/index.js"],
      "env": {
        "FIXNOTY_API_KEY": "fn_live_…"
      }
    }
  }
}
```

## Claude

Stesso blocco `mcpServers`.

- Claude Desktop: file di configurazione MCP dell’app
- Claude Code: `.mcp.json` nella cartella del sito

Il processo è stdio. Non c’è un URL pubblico da incollare: Cursor o Claude avviano `node` sulla macchina di chi sviluppa.

## Dati

Il server non tiene una copia delle segnalazioni. A ogni tool manda la chiave nell’header `Authorization` solo a `https://www.fixnoty.com` e riceve il testo della nota, il pin, l’indirizzo della pagina, il browser, gli errori di console, gli URL firmati di screenshot e replay. Non parla con altri servizi. La chiave non finisce nel repository, nei log, né in questo file. Quanto a lungo FixNoty conserva quei dati è scritto nella [privacy](https://www.fixnoty.com/en/privacy): i replay restano 90 giorni. Il plugin non è rivolto ai minori.

## Store

Questo repository pubblico è il plugin, già nella radice. Cursor lo trova da `.cursor-plugin/plugin.json`. Claude lo trova da `.claude-plugin/plugin.json`: nel form il percorso del plugin si lascia vuoto e il branch è `main`. Chi installa inserisce la propria chiave: in Cursor nella configurazione del plugin, in Claude nella domanda `FIXNOTY_API_KEY`. Il file che parte è `server.mjs`, generato da `src/` con `npm run bundle`.

Il connettore remoto della directory di Claude, quello con un indirizzo `https://` e l’accesso OAuth, non c’è: questo server resta sul computer di chi sviluppa. Mandarlo come connettore verrebbe rifiutato.

## Procedura per l’agente

Una procedura corta sta in [`SKILL.md`](SKILL.md). Si può copiare in `.cursor/skills/fixnoty/SKILL.md` del repository del sito. Il server manda già le stesse regole al collegamento.

## Verifica

```bash
npm test
npm run build
```

I test non chiamano Fixnoty in rete. Controllano la chiave, gli header, i cinque tool in sola lettura e il fatto che la timeline del replay resti fuori dalla risposta salvo richiesta.
