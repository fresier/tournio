'use client';
import { authClient } from '@/lib/auth-client';

export function SessionMonitor() {
  // Le client Better Auth renouvelle le cookie de session via sa route dédiée.
  authClient.useSession();
  return null;
}
