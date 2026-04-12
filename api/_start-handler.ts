type ServerFetch = (request: Request) => Promise<Response> | Response;
type VercelRequestInit = RequestInit & { duplex?: "half" };

let fetchPromise: Promise<ServerFetch> | null = null;

function normalizeVercelRequest(request: Request): Request {
  const url = new URL(request.url);

  if (url.pathname === "/api") {
    url.pathname = "/";
  } else if (url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice(4);
  }

  if (url.pathname === "") {
    url.pathname = "/";
  }

  if (url.toString() === request.url) {
    return request;
  }

  const init: VercelRequestInit = {
    method: request.method,
    headers: request.headers,
    redirect: request.redirect,
    signal: request.signal,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function loadServerFetch(): Promise<ServerFetch> {
  const serverEntryPath = "../dist/server/server.js";
  const mod = (await import(
    /* @vite-ignore */ serverEntryPath
  )) as {
    default?: { fetch?: ServerFetch };
    fetch?: ServerFetch;
  };

  const fromDefault = (mod as { default?: { fetch?: ServerFetch } }).default?.fetch;
  if (typeof fromDefault === "function") {
    return fromDefault;
  }

  const fromModule = (mod as { fetch?: ServerFetch }).fetch;
  if (typeof fromModule === "function") {
    return fromModule;
  }

  throw new Error(
    "TanStack server entry not found. Ensure `vite build` ran and produced dist/server/server.js before invoking the function."
  );
}

export async function handleStartRequest(request: Request): Promise<Response> {
  if (!fetchPromise) {
    fetchPromise = loadServerFetch();
  }

  const fetchServer = await fetchPromise;
  return await fetchServer(normalizeVercelRequest(request));
}

