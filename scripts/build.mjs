import { build } from 'esbuild';
import { rm, mkdir, cp } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outdir = resolve(rootDir, 'dist');
const publicDir = resolve(rootDir, 'public');

async function prepareOutput() {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
}

async function copyPublicAssets() {
  await cp(publicDir, outdir, { recursive: true });
}

async function bundleScripts() {
  await build({
    entryPoints: {
      background: resolve(rootDir, 'src/background/index.ts'),
      content: resolve(rootDir, 'src/content/index.ts'),
      popup: resolve(rootDir, 'src/ui/popup/index.ts'),
      translate: resolve(rootDir, 'src/translate/index.ts')
    },
    bundle: true,
    outdir,
    format: 'esm',
    target: ['chrome110'],
    sourcemap: true,
    logLevel: 'info',
    chunkNames: 'chunks/[name]-[hash]',
    entryNames: '[name]',
    metafile: true,
    treeShaking: true
  });
}

async function main() {
  await prepareOutput();
  await copyPublicAssets();
  await bundleScripts();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
