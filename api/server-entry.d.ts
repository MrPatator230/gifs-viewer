declare module "../dist/server/server.js" {
  export const fetch: (request: Request) => Promise<Response> | Response;

  const server: {
    fetch: (request: Request) => Promise<Response> | Response;
  };

  export default server;
}