import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const API = process.env.QNTL_API || 'http://127.0.0.1:8787';

const launch = JSON.parse(readFileSync(new URL('../launch.json', import.meta.url), 'utf8'));
const links = { site: 'https://quintelagent.com', x: 'https://x.com/quintelagent', github: 'https://github.com/quintelagent/quintel', changelog: 'https://github.com/quintelagent/quintel/blob/main/CHANGELOG.md' };
const pons = `https://ponsfamily.com/launchpad/${launch.ca}`;
/** After launch: the official address in the page head, and /token.json for tools that read it. */
const tokenInfo = (): Plugin => ({
  name: 'token-info',
  transformIndexHtml: () => (launch.ca ? [
    ...Object.entries({ 'token:name': launch.name, 'token:symbol': launch.symbol, 'token:chain_id': String(launch.chainId), 'token:contract': launch.ca, 'token:pons': pons, 'token:site': links.site, 'token:x': links.x, 'token:github': links.github, 'token:changelog': links.changelog }).map(([name, content]) => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' as const })),
    { tag: 'link', attrs: { rel: 'alternate', type: 'application/json', href: '/token.json', title: 'Official token details' }, injectTo: 'head' as const },
  ] : []),
  generateBundle() {
    if (launch.ca) this.emitFile({ type: 'asset', fileName: 'token.json', source: JSON.stringify({ name: launch.name, symbol: launch.symbol, chain: 'Robinhood Chain', chainId: launch.chainId, contract: launch.ca, pons, solanaMint: launch.pumpMint, launchWallet: launch.launchWallet, devBuyBurnTx: launch.devBuyBurnTx, ...links, disclaimer: 'Not financial advice. Not affiliated with Nvidia, Robinhood, Pons or Pump.fun.' }, null, 2) + '\n' });
  },
});

export default defineConfig({
  plugins: [react(), tokenInfo()],
  resolve: { alias: { '@engine': fileURLToPath(new URL('../engine/src', import.meta.url)) } },
  server: { proxy: { '/api': { target: API, changeOrigin: true } }, fs: { allow: ['..'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
});
