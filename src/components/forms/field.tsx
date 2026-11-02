'use client';
import { useEffect } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { FormError } from '@/lib/tournaments/client';

/** Champ de formulaire Mantine ; les erreurs serveur (tableau de messages) sont reliées au champ. */
export function Field({ error, ...input }: Omit<TextInputProps, 'error'> & { label: string; error?: string[] }) {
  return <TextInput {...input} error={error?.length ? error.join(' ') : undefined} />;
}

/**
 * Retour d’une action : une notification Mantine (en haut à droite), plus de message collé au bouton.
 * Une seule à la fois ; les erreurs propres à un champ restent affichées sous ce champ.
 * Chaque action vide d’abord son retour, si bien qu’un même message déclenche bien une nouvelle notification.
 */
export function FormFeedback({ error, success }: { error?: FormError | null; success?: string }) {
  useEffect(() => {
    if (!error && !success) return;
    notifications.clean();
    const closeButtonProps = { 'aria-label': 'Fermer la notification' };
    notifications.show(error
      ? { color: 'red', title: 'Action impossible', message: error.message, autoClose: 8000, withBorder: true, closeButtonProps }
      : { color: 'teal', message: success, autoClose: 3500, withBorder: true, closeButtonProps });
  }, [error, success]);
  return null;
}
