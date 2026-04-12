import { handleStartRequest } from "./_start-handler";

export const config = {
  runtime: "nodejs",
  includeFiles: "dist/server/**",
};

export default async function handler(request: Request): Promise<Response> {
  return handleStartRequest(request);
}
