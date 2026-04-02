import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as { version: string }

function resolveGitShaShort(): string {
  const fromEnv = [
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.COMMIT_REF,
  ].find((v) => typeof v === 'string' && v.length >= 7)
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      encoding: 'utf8',
    }).trim()
  } catch {
    return ''
  }
}

const gitShaShort = resolveGitShaShort()

const pad2 = (n: number) => String(n).padStart(2, '0')
const vercelBuildStamp = (() => {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}.${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
})()
const onVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true'
const appVersionDisplay = onVercel ? `${pkg.version}+b${vercelBuildStamp}` : pkg.version

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersionDisplay),
    __APP_VERSION_BASE__: JSON.stringify(pkg.version),
    __BUILD_ISO__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA_SHORT__: JSON.stringify(gitShaShort),
  },
})
