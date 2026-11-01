import 'server-only';
import { isTrustedOrigin } from './origins';

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function validOrigin(request: Request) {
  return isTrustedOrigin(request.headers.get('origin'));
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('INVALID_JSON');
  if (Number(request.headers.get('content-length')) > 4096) throw new Error('INVALID_JSON');
  const body = await request.text();
  if (body.length > 4096) throw new Error('INVALID_JSON');
  return JSON.parse(body);
}
