import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { DomainError } from './store';
import { z } from 'zod';
import { json } from '@/lib/http';

export function apiError(code: string, message: string, status: number, fieldErrors?: Record<string, string[]>) {
  return json({ error: { code, message, fieldErrors, requestId: crypto.randomUUID() } }, status);
}

export function validationError(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.filter((part) => part !== 'payload').join('.') || 'form';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return apiError('VALIDATION_ERROR', 'Vérifiez les champs du formulaire.', 422, fieldErrors);
}

export function databaseError(error: unknown) {
  if (error instanceof DomainError) return apiError(error.code, error.message, error.status);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return apiError('DUPLICATE', 'Ce nom ou cet identifiant de lien est déjà utilisé.', 409);
    if (error.code === 'P2025') return apiError('NOT_FOUND', 'Ressource introuvable ou accès refusé.', 404);
    if (['P2003', 'P2004'].includes(error.code)) return apiError('INVALID_CONFIGURATION', 'La configuration ne respecte pas les contraintes du tournoi.', 422);
  }
  return apiError('SERVICE_UNAVAILABLE', 'Enregistrement indisponible. Réessayez dans un instant.', 503);
}
