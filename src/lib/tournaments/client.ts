'use client';
import { z } from 'zod';
import { configurationSchema } from './contracts';

export class FormError extends Error {
  constructor(message: string, public fields: Record<string, string[]> = {}) { super(message); }
}

export async function configurationRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = z.object({ error: z.object({ message: z.string(), fieldErrors: z.record(z.string(), z.array(z.string())).optional() }) }).safeParse(body);
    throw new FormError(parsed.success ? parsed.data.error.message : 'Le service est momentanément indisponible.', parsed.success ? parsed.data.error.fieldErrors : {});
  }
  return z.object({ configuration: configurationSchema }).parse(body).configuration;
}
