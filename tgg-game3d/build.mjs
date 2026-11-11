import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'dist');
const nextPublic = resolve(here, '../tgg-app/public/game');
const legacy = resolve(here, '../tgg-app/play-site/dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

await build({
  entryPoints: [resolve(here, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: resolve(out, 'game.js'),
  legalComments: 'none',
});

await cp(resolve(here, 'index.html'), resolve(out, 'index.html'));
await cp(resolve(here, 'style.css'), resolve(out, 'style.css'));

try {
  await cp(resolve(legacy, 'app.js'), resolve(out, 'screens.js'));
  await cp(resolve(legacy, 'app.css'), resolve(out, 'screens.css'));
  const legacyHtml = await readFile(resolve(legacy, 'index.html'), 'utf8');
  await writeFile(
    resolve(out, 'screens.html'),
    legacyHtml.replaceAll('app.css', 'screens.css').replaceAll('app.js', 'screens.js'),
  );
} catch {
  console.warn('legacy screens bundle missing — skipped');
}

await rm(nextPublic, { recursive: true, force: true });
await cp(out, nextPublic, { recursive: true });

console.log(`built ${out}`);
