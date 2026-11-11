import { FIXNOTY_MCP_VERSION, type FixnotyConfig } from "./config.js";

const REQUEST_TIMEOUT_MS = 20_000;

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type ListFeedbackQuery = {
  status?: string;
  feedbackType?: string;
  updatedSince?: string;
  limit?: number;
  cursor?: string;
};

export class FixnotyApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly retryAfter: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null,
    retryAfter: string | null,
  ) {
    super(message);
    this.name = "FixnotyApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export type FixnotyClient = {
  project(): Promise<unknown>;
  listFeedback(query: ListFeedbackQuery): Promise<unknown>;
  getFeedback(id: string, includeRecordingEvents: boolean): Promise<unknown>;
  assets(id: string): Promise<unknown>;
  replay(id: string): Promise<unknown>;
};

type ErrorBody = {
  error?: unknown;
  code?: unknown;
};

function errorText(body: unknown, status: number): { message: string; code: string | null } {
  if (!body || typeof body !== "object") {
    return { message: `HTTP ${status}`, code: null };
  }
  const record = body as ErrorBody;
  const message = typeof record.error === "string" && record.error.trim()
    ? record.error
    : `HTTP ${status}`;
  const code = typeof record.code === "string" && record.code.trim() ? record.code : null;
  return { message, code };
}

export function createClient(
  config: FixnotyConfig,
  fetchImpl: FetchLike = fetch,
): FixnotyClient {
  async function get(
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const url = new URL(path, config.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null && value !== "") url.searchParams.set(key, value);
      }
    }

    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: "application/json",
          "Accept-Language": "it",
          "User-Agent": `fixnoty-mcp/${FIXNOTY_MCP_VERSION}`,
        },
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      throw new FixnotyApiError(
        timedOut
          ? "Fixnoty non ha risposto in tempo."
          : "Fixnoty non è raggiungibile.",
        0,
        "network",
        null,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      throw new FixnotyApiError(
        "Il server ha risposto con un redirect. Controlla FIXNOTY_API_BASE_URL.",
        response.status,
        "redirect",
        null,
      );
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const parsed = errorText(body, response.status);
      throw new FixnotyApiError(
        parsed.message,
        response.status,
        parsed.code,
        response.headers.get("retry-after"),
      );
    }

    if (body == null) {
      throw new FixnotyApiError(
        "Fixnoty ha risposto senza JSON.",
        response.status,
        "invalid_response",
        null,
      );
    }

    return body;
  }

  return {
    project: () => get("/api/v1/project"),
    listFeedback: (query) =>
      get("/api/v1/feedback", {
        status: query.status,
        feedback_type: query.feedbackType,
        updated_since: query.updatedSince,
        limit: query.limit == null ? undefined : String(query.limit),
        cursor: query.cursor,
      }),
    getFeedback: (id, includeRecordingEvents) =>
      get(`/api/v1/feedback/${encodeURIComponent(id)}`, {
        include: includeRecordingEvents ? "recording_events" : undefined,
      }),
    assets: (id) => get(`/api/v1/feedback/${encodeURIComponent(id)}/assets`),
    replay: (id) => get(`/api/v1/feedback/${encodeURIComponent(id)}/replay`),
  };
}
