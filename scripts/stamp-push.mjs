import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src', 'buildUserStamp.ts');

const now = new Date();
const iso = now.toISOString();

const gmt2 = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Etc/GMT-2',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}).format(now);

const content = `// Auto-updated by npm run stamp and .husky/pre-push (deploy awareness, fixed UTC+2)
export const DEPLOY_STAMP_ISO = ${JSON.stringify(iso)} as const;
export const DEPLOY_STAMP_GMT2_LABEL = ${JSON.stringify(`${gmt2} GMT+2`)} as const;
`;

writeFileSync(out, content, 'utf8');
console.log('[stamp-push] wrote', out, '→', `${gmt2} GMT+2`);
