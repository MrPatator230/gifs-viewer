import startServer from "@tanstack/react-start/server-entry";

export const config = {
  runtime: "nodejs",
};

export default async function handler(request: Request): Promise<Response> {
  return startServer.fetch(request);
}

