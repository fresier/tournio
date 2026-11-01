import { networkInterfaces } from 'node:os';

const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];

/** Adresses IPv4 de la machine sur le réseau local (Wi-Fi, Ethernet), hors bouclage. */
export function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry!.address);
}

/**
 * En développement, remplace une origine de bouclage par l’IP locale de la machine,
 * pour qu’un téléphone sur le même réseau puisse l’ouvrir. Sinon, ne change rien.
 */
export function lanOrigin(host: string | null, env: { NODE_ENV?: string } = process.env) {
  if (env.NODE_ENV !== 'development' || !host) return undefined;
  const url = new URL(`http://${host}`);
  if (!loopbackHosts.includes(url.hostname)) return undefined;
  const [address] = lanAddresses();
  if (!address) return undefined;
  url.hostname = address;
  return url.origin;
}
