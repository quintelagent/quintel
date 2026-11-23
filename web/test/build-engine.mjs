// Bundles the engine + test fixtures into a single IIFE for the cross-browser determinism test.
import { build } from 'esbuild';

await build({
  stdin: {
    contents: `
      export * from '../../engine/src/index';
      export { baseInputs } from '../../engine/test/fixtures';
    `,
    resolveDir: new URL('.', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  globalName: 'QuintelEngine',
  target: 'es2020',
  outfile: new URL('./engine.bundle.js', import.meta.url).pathname,
  logLevel: 'warning',
});
console.log('engine bundle built');
