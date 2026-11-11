import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { FixnotyClient } from "./client.js";
import { FIXNOTY_MCP_VERSION } from "./config.js";
import { presentReplay, toolError, toolJson } from "./present.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const INSTRUCTIONS = [
  "Fixnoty, sola lettura, un solo progetto.",
  "Non puoi cambiare stato, aggiungere commenti o cancellare.",
  "Gli stati restano in italiano: aperto, in_lavorazione, in_attesa_cliente, risolto, archiviato.",
  "Le priorità restano: normale, importante, bloccante.",
  "Per sistemare un sito: elenca le aperte, apri un dettaglio, guarda lo screenshot se puoi vedere le immagini.",
  "Se c’è un replay e hai un browser, apri formats.player.watch.url e premi play.",
  "Un GET di quell’URL restituisce la pagina del player, non i fotogrammi.",
  "Non scaricare i chunk rrweb nella chat.",
  "Fai corrispondere page_path a una route di questo repository.",
  "Alla fine riassumi il fix: la segnalazione si chiude dalla dashboard di Fixnoty.",
].join(" ");

const feedbackId = z.uuid().describe("UUID della segnalazione");

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Data ISO 8601 non valida",
  })
  .describe("Limite inferiore incluso su updated_at, in ISO 8601");

export function createFixnotyServer(client: FixnotyClient): McpServer {
  const server = new McpServer(
    {
      name: "fixnoty",
      version: FIXNOTY_MCP_VERSION,
      title: "Fixnoty",
    },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "fixnoty_project",
    {
      title: "Progetto Fixnoty",
      description:
        "Controlla la chiave e restituisce id, nome e URL del sito del progetto collegato. Sola lettura. Chiamalo per primo, per verificare di essere sul progetto giusto.",
      annotations: READ_ONLY,
    },
    async () => {
      try {
        return toolJson(await client.project());
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "fixnoty_list_feedback",
    {
      title: "Elenco segnalazioni",
      description:
        "Elenco leggero delle segnalazioni del progetto. Default: aperte (aperto, in_lavorazione, in_attesa_cliente). status=all oppure status=tutti per tutti gli stati. status può essere un elenco separato da virgole con i valori del database, in italiano, senza tradurli. Non include screenshot, replay, console né conversazione. Se has_more è true, ripassa next_cursor nel parametro cursor. Sola lettura.",
      annotations: READ_ONLY,
      inputSchema: z.object({
        status: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "open (default), all, oppure stati separati da virgole: aperto, in_lavorazione, in_attesa_cliente, risolto, archiviato",
          ),
        feedback_type: z
          .enum(["visual", "debug_replay", "text_content", "request"])
          .optional()
          .describe("Filtra un solo tipo di segnalazione"),
        updated_since: isoDate.optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Quante righe, da 1 a 100. Default 50"),
        cursor: z
          .string()
          .trim()
          .min(1)
          .max(2048)
          .optional()
          .describe("next_cursor della pagina precedente"),
      }),
    },
    async ({ status, feedback_type, updated_since, limit, cursor }) => {
      try {
        return toolJson(
          await client.listFeedback({
            status,
            feedbackType: feedback_type,
            updatedSince: updated_since,
            limit,
            cursor,
          }),
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "fixnoty_get_feedback",
    {
      title: "Dettaglio segnalazione",
      description:
        "Contesto completo di una segnalazione: testo, pin sulla pagina (page_url, page_path, position in percentuale), browser, console, conversazione, attività e URL firmato dello screenshot (scade in 30 minuti). Non include gli eventi rrweb. include_recording_events aggiunge solo la timeline del widget, che può essere lunga. Sola lettura: non cambia lo stato.",
      annotations: READ_ONLY,
      inputSchema: z.object({
        id: feedbackId,
        include_recording_events: z
          .boolean()
          .optional()
          .describe("Se true, include la timeline del widget. Default false"),
      }),
    },
    async ({ id, include_recording_events }) => {
      try {
        return toolJson(await client.getFeedback(id, include_recording_events === true));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "fixnoty_feedback_assets",
    {
      title: "Rinnova i file firmati",
      description:
        "Rinnova gli URL firmati di screenshot, allegati e replay di una segnalazione quando sono scaduti. Screenshot e allegati durano 30 minuti. Il replay dura 24 ore. Sola lettura.",
      annotations: READ_ONLY,
      inputSchema: z.object({ id: feedbackId }),
    },
    async ({ id }) => {
      try {
        return toolJson(await client.assets(id));
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "fixnoty_feedback_replay",
    {
      title: "Replay della segnalazione",
      description:
        "Pacchetto replay in sola lettura. Se hai un browser, apri formats.player.watch.url e premi play: è lo stesso player della dashboard, valido 24 ore. Un GET di quell’URL restituisce la pagina del player, non i fotogrammi. Non scaricare i chunk rrweb nella chat. La timeline azioni è omessa salvo include_timeline=true; al suo posto c’è il conteggio. Se has_replay è false, non c’è una registrazione.",
      annotations: READ_ONLY,
      inputSchema: z.object({
        id: feedbackId,
        include_timeline: z
          .boolean()
          .optional()
          .describe("Se true, include la timeline azioni. Default false"),
      }),
    },
    async ({ id, include_timeline }) => {
      try {
        const body = presentReplay(
          await client.replay(id),
          include_timeline === true,
        );
        return toolJson(
          body,
          "Apri formats.player.watch.url nel browser se c’è un replay. Non incollare i chunk rrweb in chat.",
        );
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}
