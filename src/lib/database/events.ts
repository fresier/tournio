import { Client } from 'pg';
import { databaseURL } from './config';

export const CHANNELS = ['tournio_demo_matches', 'tournio_tournaments'] as const;
export type Channel = (typeof CHANNELS)[number];
type Change = { kind: 'change'; channel: Channel; id: string } | { kind: 'ready' | 'retry' };
type Listener = (change: Change) => void;

class DatabaseEvents {
  private client?: Client;
  private pending?: Promise<void>;
  private retry?: ReturnType<typeof setTimeout>;
  private listeners = new Set<Listener>();

  private emit(change: Change) { for (const listener of this.listeners) listener(change); }
  private scheduleReconnect() {
    if (this.retry || !this.listeners.size) return;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      if (!this.listeners.size) return;
      void this.connect().catch(() => { this.emit({ kind: 'retry' }); this.scheduleReconnect(); });
    }, 3000);
  }
  private connect() {
    if (this.client) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = (async () => {
      const client = new Client({ connectionString: databaseURL(), connectionTimeoutMillis: 10000, application_name: 'tournio-realtime' });
      const disconnected = () => {
        if (this.client !== client) return;
        this.client = undefined;
        void client.end().catch(() => {});
        this.emit({ kind: 'retry' });
        this.scheduleReconnect();
      };
      client.on('error', disconnected);
      client.on('end', disconnected);
      client.on('notification', (message) => {
        try {
          const value: unknown = JSON.parse(message.payload || '{}');
          const channel = CHANNELS.find((name) => name === message.channel);
          if (channel && value && typeof value === 'object' && 'id' in value && typeof value.id === 'string' && /^[0-9a-f-]{36}$/i.test(value.id)) this.emit({ kind: 'change', channel, id: value.id });
        } catch { /* Ignorer un message qui ne correspond pas au contrat public. */ }
      });
      try {
        await client.connect();
        for (const channel of CHANNELS) await client.query(`LISTEN ${channel}`);
        this.client = client;
        this.emit({ kind: 'ready' });
      } catch (error) {
        await client.end().catch(() => {});
        throw error;
      }
    })().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  async subscribe(listener: Listener) {
    this.listeners.add(listener);
    try { await this.connect(); }
    catch (error) { this.listeners.delete(listener); throw error; }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        clearTimeout(this.retry);
        this.retry = undefined;
        const client = this.client;
        this.client = undefined;
        void client?.end().catch(() => {});
      }
    };
  }
}

const globalEvents = globalThis as unknown as { tournioEvents?: DatabaseEvents };
export const databaseEvents = globalEvents.tournioEvents ??= new DatabaseEvents();
