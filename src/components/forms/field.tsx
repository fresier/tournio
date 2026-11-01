'use client';
import { useId, type InputHTMLAttributes } from 'react';
import type { FormError } from '@/lib/tournaments/client';

export function Field({ label, error, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string[] }) {
  const id = useId();
  return <label className="form-field" htmlFor={id}><span>{label}</span><input {...input} id={id} aria-invalid={Boolean(error?.length)} aria-describedby={error?.length ? `${id}-error` : undefined} />{error?.length ? <span id={`${id}-error`} className="field-error">{error.join(' ')}</span> : null}</label>;
}

export function FormFeedback({ error, success }: { error?: FormError | null; success?: string }) {
  if (error) return <p className="form-error" role="alert">{error.message}</p>;
  return success ? <p className="form-success" role="status">{success}</p> : null;
}
