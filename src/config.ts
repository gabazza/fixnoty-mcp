const API_KEY_PATTERN = /^fn_(live|test)_[a-f0-9]{64}$/;

export const FIXNOTY_MCP_VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://www.fixnoty.com";

export type FixnotyConfig = {
  apiKey: string;
  baseUrl: string;
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): FixnotyConfig {
  const apiKey = (env.FIXNOTY_API_KEY ?? "").trim();
  if (!API_KEY_PATTERN.test(apiKey)) {
    throw new Error(
      "FIXNOTY_API_KEY mancante o non valida. Il formato è fn_live_ o fn_test_ seguito da 64 caratteri esadecimali. Si crea in Impostazioni progetto → API e si vede per intero una sola volta.",
    );
  }

  const raw = (env.FIXNOTY_API_BASE_URL ?? DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("FIXNOTY_API_BASE_URL non è un URL assoluto.");
  }

  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";
  if (url.protocol === "http:" && !local) {
    throw new Error("FIXNOTY_API_BASE_URL può usare http solo su localhost.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("FIXNOTY_API_BASE_URL deve essere http o https.");
  }
  if (url.username || url.password) {
    throw new Error("FIXNOTY_API_BASE_URL non deve contenere utente o password.");
  }

  return { apiKey, baseUrl: url.origin };
}
