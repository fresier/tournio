'use client';
import { Alert, TextInput, type TextInputProps } from '@mantine/core';
import type { FormError } from '@/lib/tournaments/client';

/** Champ de formulaire Mantine ; les erreurs serveur (tableau de messages) sont reliées au champ. */
export function Field({ error, ...input }: Omit<TextInputProps, 'error'> & { label: string; error?: string[] }) {
  return <TextInput {...input} error={error?.length ? error.join(' ') : undefined} />;
}

export function FormFeedback({ error, success }: { error?: FormError | null; success?: string }) {
  if (error) return <Alert color="red" variant="light" role="alert" py="xs">{error.message}</Alert>;
  return success ? <Alert color="teal" variant="light" role="status" py="xs">{success}</Alert> : null;
}
