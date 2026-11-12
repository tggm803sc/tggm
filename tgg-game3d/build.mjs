import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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

// A stable game.js URL is why a deploy could leave players on the previous
// bundle: the path never changed, so the browser kept its cached copy. The
// bundle now carries its own content hash, so every deploy is a new URL.
const bundle = await readFile(resolve(out, 'game.js'));
const hash = createHash('sha256').update(bundle).digest('hex').slice(0, 10);
const bundleName = `game.${hash}.js`;
await rename(resolve(out, 'game.js'), resolve(out, bundleName));

await writeFile(
  resolve(out, 'index.html'),
  (await readFile(resolve(here, 'index.html'), 'utf8')).replace('./game.js', `./${bundleName}`),
);
await cp(resolve(here, 'style.css'), resolve(out, 'style.css'));
await writeFile(
  resolve(out, 'sw.js'),
  (await readFile(resolve(here, 'sw.js'), 'utf8'))
    .replace("'./game.js'", `'./${bundleName}'`)
    .replace(/const CACHE = '[^']*'/, `const CACHE = 'tgg-shell-${hash}'`),
);
await cp(resolve(here, 'manifest.webmanifest'), resolve(out, 'manifest.webmanifest'));
await cp(resolve(here, 'icon.svg'), resolve(out, 'icon.svg'));

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

console.log(`built ${out} · ${bundleName} (${bundle.length} bytes)`);
