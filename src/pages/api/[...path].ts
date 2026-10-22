import type { APIRoute } from 'astro';
import app from '../../server/app';

declare const process: { env: Record<string, string | undefined> } | undefined;

export const ALL: APIRoute = async (context) => {
  // Extraer el entorno de Cloudflare Pages Functions
  const runtime = (context.locals as any)?.runtime;
  const envProcess = typeof process !== 'undefined' ? process.env : {};
  const env = runtime?.env || envProcess;

  return app.fetch(context.request, env, runtime?.ctx);
};
