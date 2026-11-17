import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyVerifiedSave } from './tools/verified-save.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, 'dist');
const nextPublic = resolve(here, '../tgg-app/public/game');
const legacy = resolve(here, '../tgg-app/play-site/dist');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// The completion save must go through writeProgressVerified. main.js is patched
// at bundle time with an exact-match assertion, so the write path cannot drift
// back to a direct setItem without failing the build.
const verifiedSave = {
  name: 'verified-save',
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /src[\\/]main\.js$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      return { contents: applyVerifiedSave(source), loader: 'js', resolveDir: dirname(args.path) };
    });
  },
};

await build({
  entryPoints: [resolve(here, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: resolve(out, 'game.js'),
  legalComments: 'none',
  plugins: [verifiedSave],
});

// The career transfer panel is a second, tiny entry: it only needs storage, so it
// still works if the renderer fails to start.
await build({
  entryPoints: [resolve(here, 'src/career-panel.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: resolve(out, 'career.js'),
  legalComments: 'none',
});

// TGG_API_BASE points the static build at a hosted career API. Unset means no
// meta tag at all, which the game reads as same-origin only.
const apiBase = (process.env.TGG_API_BASE ?? '').trim();
const html = await readFile(resolve(here, 'index.html'), 'utf8');
const withApiBase = apiBase
  ? html.replace(
      '</head>',
      `    <meta name="tgg-api-base" content="${apiBase.replace(/"/g, '&quot;')}" />\n  </head>`,
    )
  : html;

// Installable, offline-capable shell. The manifest link and the registration are
// injected here so index.html stays a plain page that also works from file://.
// career.js loads first: it snapshots the readable backup before the game's boot
// path can overwrite that key with a corrupt payload.
const withPwa = withApiBase
  .replace('</head>', '    <link rel="manifest" href="./manifest.webmanifest" />\n  </head>')
  .replace('    <script type="module" src="./game.js"></script>', '    <script type="module" src="./career.js"></script>\n    <script type="module" src="./game.js"></script>')
  .replace(
    '</body>',
    [
      '    <script>',
      "      if ('serviceWorker' in navigator) {",
      '        window.addEventListener(\'load\', function () {',
      "          navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(function () {});",
      '        });',
      '      }',
      '    </script>',
      '  </body>',
    ].join('\n'),
  );
await writeFile(resolve(out, 'index.html'), withPwa);
await cp(resolve(here, 'style.css'), resolve(out, 'style.css'));
await cp(resolve(here, 'manifest.webmanifest'), resolve(out, 'manifest.webmanifest'));
await cp(resolve(here, 'icon.svg'), resolve(out, 'icon.svg'));
await cp(resolve(here, 'icon-maskable.svg'), resolve(out, 'icon-maskable.svg'));

// A new version per build: the worker changes, so the browser installs it and
// the old cache is deleted instead of being served forever.
const swSource = await readFile(resolve(here, 'sw.js'), 'utf8');
await writeFile(resolve(out, 'sw.js'), swSource.replaceAll('__TGG_VERSION__', Date.now().toString(36)));

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
