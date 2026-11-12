// The asset library: one manifest that describes every visual asset in the game,
// whether it is generated in code or authored in Blender and delivered as a GLB.
//
// The point is that an AI tool (or a person) can read the manifest, see what exists,
// what is declared but not built, what each asset costs, and where it came from —
// without guessing from file names. Status is explicit: `in-game` means it is in the
// running build, `declared` means the slot exists and nothing fills it yet.

export const MANIFEST_VERSION = 1;
export const ASSET_KINDS = ['building', 'vehicle', 'character', 'prop', 'material', 'environment'];

export const DEFAULT_MANIFEST = {
  version: MANIFEST_VERSION,
  project: 'TGG World · browser build',
  renderer: 'three.js (WebGL2)',
  authored: 'Blender → glTF (.glb) → 3ds max budget check → game',
  assets: [
    {
      id: 'block.harbour-row',
      kind: 'building',
      title: 'Harbour Row block (0, 78)',
      source: 'procedural',
      module: 'src/district.js',
      status: 'in-game',
      budget: { drawCalls: 24, triangles: 90000 },
      tags: ['block', 'storefronts', 'facades', 'street-furniture'],
      notes: 'Podium with six storefront bays per visible face, three towers with setbacks, instanced facade grid.',
    },
    {
      id: 'vehicle.coupe',
      kind: 'vehicle',
      title: 'Player coupe',
      source: 'procedural',
      module: 'src/car.js',
      status: 'in-game',
      budget: { drawCalls: 18, triangles: 26000 },
      tags: ['vehicle', 'clearcoat', 'glass', 'rims'],
      notes: 'Extruded body profile with beveled edges, separate greenhouse, detailed rims, merged trim.',
    },
    {
      id: 'character.walker',
      kind: 'character',
      title: 'Player on foot',
      source: 'procedural',
      module: 'src/walker.js',
      status: 'in-game',
      budget: { drawCalls: 22, triangles: 12000 },
      tags: ['character', 'rig', 'cloth'],
      notes: 'Segmented arms and legs with knees and elbows, jacket detail, cap, face features.',
    },
    {
      id: 'prop.streetlights',
      kind: 'prop',
      title: 'Streetlight fixtures',
      source: 'procedural',
      module: 'src/district.js',
      status: 'in-game',
      budget: { drawCalls: 3, triangles: 4000 },
      tags: ['street', 'lighting', 'night'],
      notes: 'Arm, housing and lens over the existing pole instances; the global pole mesh is untouched.',
    },
    {
      id: 'environment.sky',
      kind: 'environment',
      title: 'Procedural sky environment',
      source: 'procedural',
      module: 'src/visuals.js',
      status: 'in-game',
      budget: { drawCalls: 0, triangles: 0 },
      tags: ['pmrem', 'reflections', 'clock'],
      notes: 'Equirect canvas from the world clock palette, pre-filtered by PMREMGenerator.',
    },
    {
      id: 'vehicle.sports-car.glb',
      kind: 'vehicle',
      title: 'Authored sports car (reserved)',
      source: 'glb',
      url: 'assets/models/vehicle-sports-car.glb',
      status: 'declared',
      budget: { triangles: 60000, drawCalls: 12 },
      tags: ['vehicle', 'authored'],
      notes: 'Reserved slot. Author in Blender, validate with the studio GLB checker, then register.',
    },
    {
      id: 'building.office-tower.glb',
      kind: 'building',
      title: 'Authored office tower (reserved)',
      source: 'glb',
      url: 'assets/models/office-tower.glb',
      status: 'declared',
      budget: { triangles: 120000, drawCalls: 10 },
      tags: ['building', 'authored'],
      notes: 'Reserved slot. Must carry its own UVs and PBR texture set.',
    },
  ],
};

export class AssetLibrary {
  constructor(manifest = DEFAULT_MANIFEST) {
    this.manifest = manifest;
    this.entries = new Map();
    for (const asset of manifest.assets ?? []) this.register(asset);
  }

  register(asset) {
    if (!asset?.id) throw new Error('asset needs an id');
    if (!ASSET_KINDS.includes(asset.kind)) {
      throw new Error(`asset ${asset.id} has unknown kind ${asset.kind}`);
    }
    if (this.entries.has(asset.id) && this.entries.get(asset.id).source !== asset.source) {
      throw new Error(`asset ${asset.id} already registered`);
    }
    this.entries.set(asset.id, { ...asset });
    return this.entries.get(asset.id);
  }

  get(id) {
    return this.entries.get(id) ?? null;
  }

  list(kind) {
    const all = [...this.entries.values()];
    return kind ? all.filter((asset) => asset.kind === kind) : all;
  }

  // Only assets that are actually in the running build.
  inGame() {
    return this.list().filter((asset) => asset.status === 'in-game');
  }

  // Declared GLB slots: the authoring queue, not a claim that the asset exists.
  pending() {
    return this.list().filter((asset) => asset.status === 'declared');
  }

  validate() {
    const problems = [];
    const seen = new Set();
    for (const asset of this.list()) {
      if (seen.has(asset.id)) problems.push(`${asset.id} is duplicated`);
      seen.add(asset.id);
      if (!asset.title) problems.push(`${asset.id} has no title`);
      if (!asset.budget || typeof asset.budget.triangles !== 'number') {
        problems.push(`${asset.id} has no triangle budget`);
      }
      if (asset.source === 'glb' && !asset.url) problems.push(`${asset.id} is a GLB with no url`);
      if (asset.source === 'procedural' && !asset.module) {
        problems.push(`${asset.id} is procedural but names no module`);
      }
      if (asset.status === 'in-game' && !asset.module) {
        problems.push(`${asset.id} claims to be in-game but names no module`);
      }
    }
    return { ok: problems.length === 0, problems };
  }

  // The structured view handed to tooling and to the debug hook.
  export({ withTextures = false } = {}) {
    return {
      version: MANIFEST_VERSION,
      project: this.manifest.project ?? '',
      renderer: this.manifest.renderer ?? '',
      authored: this.manifest.authored ?? '',
      counts: {
        total: this.entries.size,
        inGame: this.inGame().length,
        declared: this.pending().length,
      },
      assets: this.list().map((asset) => ({ ...asset, ...(withTextures ? { textures: asset.textures ?? [] } : {}) })),
    };
  }
}

export function createAssetLibrary(manifest) {
  return new AssetLibrary(manifest);
}
