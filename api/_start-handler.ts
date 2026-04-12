type ServerFetch = (request: Request) => Promise<Response> | Response;

let fetchPromise: Promise<ServerFetch> | null = null;

async function loadServerFetch(): Promise<ServerFetch> {
  const mod = await import("../dist/server/server.js");

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
  return await fetchServer(request);
}

