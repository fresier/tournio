import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ManagerGuide } from '@/components/dashboard/manager-guide';

export const metadata = { title: 'Guide du gestionnaire — Tournio' };

export default async function GuidePage() {
  const content = await readFile(join(process.cwd(), 'docs', 'guide-gestionnaire.md'), 'utf8');
  return <ManagerGuide content={content} />;
}
