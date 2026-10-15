import worker from "../../src/worker.js";

// Cloudflare Pages: enruta todas las solicitudes /api/* al mismo backend.
// Los archivos de public/ se sirven estáticamente por Pages.
export async function onRequest(context) {
  return worker.fetch(context.request, context.env);
}
