// Offline release-contract check: intentionally never invokes schema pull/sync.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { statSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const backendRequire = createRequire(resolve('backend/package.json'));
const cliRequire = createRequire(backendRequire.resolve('@edgespark/cli/package.json'));
const { build } = cliRequire('esbuild');
await build({
  entryPoints: ['src/index.ts'], bundle: true, format: 'esm', platform: 'browser',
  external: ['drizzle-orm'],
  alias: { '@generated': './src/__generated__/index.ts', '@sdk/server-types': './src/__generated__/server-types.d.ts' },
  absWorkingDir: resolve('backend'), outfile: 'dist/bundle.js',
});
const bundle = await import('../backend/dist/bundle.js?check=' + Date.now());
for (const name of ['createApp', 'tables', 'buckets', 'drizzleSchema']) assert.ok(bundle[name], 'Required export: ' + name);
assert.ok(statSync('backend/dist/bundle.js').size < 25 * 1024 * 1024);
const app = await bundle.createApp({db:{},auth:{user:null},secret:{get:()=>null},storage:{},getDeployEnv:()=> 'staging'});
const routes = app.routes.filter(r => r.method !== 'ALL').map(r => ({ method:r.method, path:r.path }));
assert.equal(routes.length,50);
assert.ok(routes.every(r => r.path.startsWith('/api/')));
console.log('PASS offline bundle contract: createApp/tables/buckets/drizzleSchema; no schema operation');
console.log('PASS offline route analysis: 50 routes');
writeFileSync('qa/phase1-2026-11-11/offline-routes.json',JSON.stringify(routes,null,2));
