import { FixnotyApiError } from "./client.js";

export function presentReplay(body: unknown, includeTimeline: boolean): unknown {
  if (includeTimeline || !body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const record = body as Record<string, unknown>;
  if (!("timeline" in record)) return body;

  const timeline = record.timeline;
  const count = Array.isArray(timeline) ? timeline.length : 0;
  return {
    ...record,
    timeline: null,
    timeline_omitted: true,
    timeline_event_count: count,
  };
}

export function toolError(error: unknown): {
  isError: true;
  content: [{ type: "text"; text: string }];
} {
  if (error instanceof FixnotyApiError) {
    const code = error.code ? `${error.code}: ` : "";
    const retry = error.retryAfter ? ` Riprova tra ${error.retryAfter} secondi.` : "";
    return {
      isError: true,
      content: [{ type: "text", text: `${code}${error.message}${retry}` }],
    };
  }

  const message = error instanceof Error ? error.message : "Errore sconosciuto.";
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function toolJson(value: unknown, preface?: string): {
  content: [{ type: "text"; text: string }];
} {
  const json = JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text", text: preface ? `${preface}\n\n${json}` : json }],
  };
}
