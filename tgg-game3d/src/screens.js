// Phone, city map, mission center and pause sheet. One overlay stack, driven by
// live game state and by actions the game supplies. Nothing here awards money,
// XP or reputation: every number it shows is read-only.
import { BLOCKS, HALF, LANDMARKS } from './city.js';
import { careerLabel } from './progress.js';

const el = (id) => document.getElementById(id);

const TABS = ['phone', 'map', 'missions', 'settings'];
const VIEW_TITLES = {
  phone: 'Home',
  map: 'City map',
  missions: 'Mission center',
  garage: 'Garage',
  settings: 'Settings',
};

const LANDMARK_INFO = {
  hq: {
    name: 'TGG HQ',
    text: 'Harbour Row crew floor. The coupe is kept here, and the bay is where Act I starts.',
  },
  studio: {
    name: 'Studio 808',
    text: 'The desk, the booth and the engineer. Cut a take here; only an accepted take becomes a master.',
  },
  vault: {
    name: 'The Vault',
    text: 'Delivery desk. Hand over the master and the desk decides when it is released.',
  },
};

// Districts that exist in the design but are not built in this slice. They are
// marked LOCKED on purpose rather than drawn as if you could drive to them.
const LOCKED_DISTRICTS = [
  { id: 'cypher', name: 'Cypher Plaza', fx: 0.82, fz: 0.84, note: 'Open-mic cyphers and crowds. Not built in this slice.' },
  { id: 'motors', name: 'TGG Motors Yard', fx: 0.16, fz: 0.18, note: 'Garage, dyno and test loop. Not built in this slice.' },
  { id: 'northline', name: 'Northline', fx: 0.48, fz: 0.08, note: 'Community radio tower and hills. Not built in this slice.' },
  { id: 'salt', name: 'Salt Flats', fx: 0.9, fz: 0.24, note: 'Airfield and salt-road racing. Not built in this slice.' },
  { id: 'undertow', name: 'The Undertow', fx: 0.09, fz: 0.62, note: 'Storm-drain shortcut network. Not built in this slice.' },
];

const ACT_I = [
  { stage: 0, title: 'The 808 Run', detail: 'Drive to Studio 808 and cut a take the engineer accepts (80 or better).' },
  { stage: 1, title: 'Hand It to the Vault', detail: 'Carry the accepted master to The Vault desk and let the desk confirm it.' },
];

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function initScreens({ getState, actions = {}, onPause, onScreen } = {}) {
  const pauseSheet = el('pause');
  const tablet = el('tablet');
  const tabletBody = el('tabletBody');
  const tabletTitle = el('tabletTitle');
  const tabletClose = el('tabletClose');
  const tabs = [...document.querySelectorAll('#tablet .tab')];
  const pauseObjective = el('pauseObjective');

  let view = 'phone';
  let select = null;
  let fromPause = false;

  const state = () => getState?.() ?? {};

  function setSheet(open, name) {
    if (!open) {
      pauseSheet.classList.add('hidden');
      tablet.classList.add('hidden');
    }
    onPause?.(open);
    onScreen?.(open ? (name ?? view) : null);
  }

  function markTabs() {
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.tab === view));
    }
  }

  function render() {
    const current = state();
    tabletTitle.textContent = VIEW_TITLES[view] ?? 'Home';
    markTabs();
    const content =
      view === 'map'
        ? renderMap(current)
        : view === 'missions'
          ? renderMissions(current)
          : view === 'garage'
            ? renderGarage(current)
            : view === 'settings'
              ? renderSettings(current)
              : renderPhone(current);
    // Views return arrays of nodes; replaceChildren needs them spread out.
    tabletBody.replaceChildren(...[].concat(content).filter(Boolean));
  }

  function openView(next, { fromPauseSheet = false, select: nextSelect = null } = {}) {
    if (TABS.includes(next) || next === 'garage') view = next;
    if (nextSelect) select = nextSelect;
    fromPause = fromPauseSheet;
    pauseSheet.classList.add('hidden');
    tablet.classList.remove('hidden');
    render();
    setSheet(true);
  }

  function openPause() {
    const current = state();
    pauseObjective.textContent = current.target
      ? `${current.objective} · ${current.distance} m`
      : current.objective ?? 'Act I';
    tablet.classList.add('hidden');
    pauseSheet.classList.remove('hidden');
    setSheet(true, 'pause');
  }

  function close() {
    setSheet(false);
    pauseSheet.classList.add('hidden');
    tablet.classList.add('hidden');
  }

  // ---- views ---------------------------------------------------------------

  function renderProfile(current) {
    return h('div', { class: 'profile-block' }, [
      h('strong', { text: current.alias ?? 'Getta' }),
      h('small', {
        text: `${careerLabel(current.career)} · stage ${Math.min(current.stage + 1, ACT_I.length)} of ${ACT_I.length}${current.complete ? ' · Act I complete' : ''}`,
      }),
      h('small', { text: `Release ${current.release?.state ?? 'draft'} · best take ${current.stats?.bestTake ?? 0}/100` }),
    ]);
  }

  function renderPhone(current) {
    const tiles = [
      ['map', 'City map', 'Studio · Vault · HQ'],
      ['missions', 'Missions', current.target ? `${current.target.name}` : 'Act I complete'],
      ['garage', 'Garage', 'Coupe 808'],
      ['studio', 'Studio 808', `${current.studioDistance ?? '—'} m`],
      ['settings', 'Settings', `Graphics ${current.quality ?? 'balanced'}`],
      ['export', 'Save & export', 'JSON file'],
    ];
    const grid = h('div', { class: 'tile-grid' });
    for (const [target, label, sub] of tiles) {
      grid.append(
        h(
          'button',
          {
            class: 'tile',
            type: 'button',
            'data-phone-target': target,
            'data-phone-label': label,
          },
          [h('b', { text: label }), h('span', { text: sub })],
        ),
      );
    }

    return [
      renderProfile(current),
      grid,
      h('p', { class: 'fine', text: current.lastScreen ? `Last opened: ${current.lastScreen}` : 'Dial 808 for the studio.' }),
      h('p', { class: 'fine', text: `Radio ${current.take?.radioAvailable ? 'has your take' : 'is empty'} · ${current.online ? 'online' : 'offline'}` }),
    ];
  }

  function locations(current) {
    const list = [];
    for (const [id, landmark] of Object.entries(LANDMARKS)) {
      const info = LANDMARK_INFO[id] ?? { name: landmark.name, text: '' };
      const isTarget = current.target && current.target.name === info.name;
      list.push({
        id,
        name: info.name,
        text: info.text,
        x: landmark.x,
        z: landmark.z,
        target: Boolean(isTarget),
        locked: false,
      });
    }
    for (const district of LOCKED_DISTRICTS) {
      list.push({
        id: district.id,
        name: district.name,
        text: district.note,
        x: (district.fx - 0.5) * 2 * HALF * 0.92,
        z: (district.fz - 0.5) * 2 * HALF * 0.92,
        target: false,
        locked: true,
      });
    }
    return list;
  }

  function renderMap(current) {
    const places = locations(current);
    const selected = places.find((place) => place.id === (select ?? current.target?.id)) ?? places[0];

    const canvas = h('canvas', { class: 'map-canvas', 'aria-label': 'City map' });
    requestAnimationFrame(() => drawMap(canvas, current, places, selected));

    const list = h('div', { class: 'loc-list' });
    for (const place of places) {
      list.append(
        h(
          'button',
          {
            class: 'loc',
            type: 'button',
            'data-loc': place.id,
            'aria-selected': String(place.id === selected?.id),
          },
          [
            h('span', {}, [
              h('b', { text: place.name }),
              ' ',
              place.target ? h('span', { class: 'badge', text: 'Mission' }) : null,
              place.locked ? h('span', { class: 'badge locked', text: 'Locked' }) : null,
            ]),
            h('em', { text: place.locked ? 'not built' : `${Math.round(Math.hypot(place.x - current.player.x, place.z - current.player.z))} m` }),
          ],
        ),
      );
    }

    const detail = h('div', { class: 'mission-card' }, [
      h('h3', { text: selected?.name ?? 'City' }),
      h('p', { text: selected?.text ?? '' }),
      selected?.locked
        ? h('p', { class: 'fine', text: 'Locked: listed in the design bible, not present in this build. No fast travel exists.' })
        : h('p', { class: 'fine', text: 'No fast travel in this build. Drive it.' }),
    ]);

    return [h('p', { class: 'field-label', text: 'World · one district built' }), canvas, detail, list];
  }

  function drawMap(canvas, current, places, selected) {
    const width = canvas.clientWidth || 320;
    if (!width) return;
    const height = Math.round(width * 0.78);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const toX = (x) => ((x + HALF) / (HALF * 2)) * width;
    const toY = (z) => ((z + HALF) / (HALF * 2)) * height;

    ctx.fillStyle = '#070b10';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#141b24';
    const block = (60 / (HALF * 2)) * width;
    for (const b of BLOCKS) {
      ctx.fillRect(toX(b.x - 30), toY(b.z - 30), block, block);
    }

    ctx.strokeStyle = 'rgba(199,255,0,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i += 1) {
      const gx = (width / 8) * i;
      const gy = (height / 8) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }

    // Player.
    const px = toX(current.player.x);
    const py = toY(current.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - current.player.heading);
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(4, 4.5);
    ctx.lineTo(-4, 4.5);
    ctx.closePath();
    ctx.fillStyle = '#ff3048';
    ctx.fill();
    ctx.restore();

    for (const place of places) {
      const x = toX(place.x);
      const y = toY(place.z);
      if (place.locked) {
        ctx.strokeStyle = 'rgba(255,215,0,0.55)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,215,0,0.8)';
        ctx.font = '600 8px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText('LOCKED', x - 15, y + 18);
      } else {
        ctx.fillStyle = '#c7ff00';
        ctx.fillRect(x - 3.4, y - 3.4, 6.8, 6.8);
        ctx.fillStyle = 'rgba(233,240,248,0.85)';
        ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(place.name, x + 7, y + 3);
      }
      if (selected && selected.id === place.id) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x - 8, y - 8, 16, 16);
      }
    }

    if (current.target) {
      const tx = toX(current.target.x);
      const tz = toY(current.target.z);
      ctx.strokeStyle = 'rgba(199,255,0,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(tx, tz, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function renderMissions(current) {
    const done = new Set(current.journal?.completed ?? []);
    const nodes = [
      h('p', { class: 'field-label', text: 'Active · Act I · Keys to the Coupe' }),
      h('div', { class: 'mission-card' }, [
        h('h3', { text: current.complete ? 'Act I complete' : current.objective }),
        h('p', {
          text: current.complete
            ? 'The master was released and the desk confirmed it. Nothing further is implemented in this build.'
            : current.target
              ? `${current.target.name} · ${current.distance} m away.`
              : 'No active objective.',
        }),
        h('div', { class: 'kv' }, [h('span', { text: 'Stage' }), h('b', { text: `${Math.min(current.stage + 1, ACT_I.length)} of ${ACT_I.length}` })]),
        h('div', { class: 'kv' }, [h('span', { text: 'Release state' }), h('b', { text: current.release?.state ?? 'draft' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'Reward' }), h('b', { text: 'DEMO · display only, nothing awarded' })]),
      ]),
    ];

    for (const mission of ACT_I) {
      const finished = done.has(mission.stage);
      const active = current.stage === mission.stage && !current.complete;
      nodes.push(
        h('div', { class: 'mission-card' }, [
          h('h3', {}, [
            mission.title,
            ' ',
            finished
              ? h('span', { class: 'badge done', text: 'Completed' })
              : active
                ? h('span', { class: 'badge', text: 'Active' })
                : h('span', { class: 'badge locked', text: 'Not reached' }),
          ]),
          h('p', { text: mission.detail }),
        ]),
      );
    }

    nodes.push(
      h('div', { class: 'mission-card' }, [
        h('h3', {}, ['Act II — Frequency Wars ', h('span', { class: 'badge locked', text: 'Locked' })]),
        h('p', { text: 'Six missions are written in the design bible and script. None are implemented, so nothing here is playable or rewarded.' }),
      ]),
      h('div', { class: 'mission-card' }, [
        h('h3', {}, ['Act III — The Getta Coast ', h('span', { class: 'badge locked', text: 'Locked' })]),
        h('p', { text: 'Six further missions, five districts and the ending branches remain design-only.' }),
      ]),
      h('p', { class: 'fine', text: 'Completed missions recorded in this save: ' + (done.size ? [...done].map((s) => ACT_I[s]?.title ?? `stage ${s + 1}`).join(', ') : 'none yet') }),
    );
    return nodes;
  }

  function renderGarage() {
    return [
      h('div', { class: 'mission-card' }, [
        h('h3', { text: 'Coupe 808' }),
        h('p', { text: 'Owned · starter sport coupe. The handling model in this build is arcade, not a simulation.' }),
        h('div', { class: 'kv' }, [h('span', { text: 'Upgrades' }), h('b', { text: 'None implemented' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'Garage district' }), h('b', { text: 'Not built' })]),
        h('div', { class: 'kv' }, [h('span', { text: 'Tuning / racing' }), h('b', { text: 'Not built' })]),
      ]),
      h('p', { class: 'fine', text: 'TGG Motors Yard is in the design bible as the garage district. There is no garage location in the world yet, so the map does not fake one.' }),
      h('button', { class: 'sheet-btn', type: 'button', 'data-phone-target': 'phone', text: 'Back to phone' }),
    ];
  }

  function renderSettings(current) {
    const quality = h('div', { class: 'seg' });
    for (const option of ['low', 'balanced', 'high']) {
      quality.append(
        h('button', {
          type: 'button',
          'data-quality': option,
          'aria-pressed': String((current.quality ?? 'balanced') === option),
          text: option,
        }),
      );
    }

    return [
      h('p', { class: 'field-label', text: 'Graphics' }),
      quality,
      h('p', { class: 'fine', text: 'Quality changes render resolution today. Shadows, rain and PBR materials are not implemented yet.' }),
      h('div', { class: 'menu-actions' }, [
        h('button', { class: 'sheet-btn', type: 'button', 'data-action': 'mute', text: 'Toggle sound' }),
        h('button', { class: 'sheet-btn', type: 'button', 'data-action': 'export', text: 'Export save' }),
      ]),
      h('div', { class: 'menu-actions' }, [
        h('button', { class: 'sheet-btn', type: 'button', 'data-action': 'import', text: 'Import save' }),
        h('button', { class: 'sheet-btn danger', type: 'button', 'data-action': 'menu', text: 'Main menu' }),
      ]),
      h('input', { id: 'screenImportFile', type: 'file', accept: 'application/json,.json', class: 'hidden' }),
      h('p', { class: 'fine', text: `Save: ${current.alias ?? 'Getta'} · ${careerLabel(current.career)} · release ${current.release?.state ?? 'draft'} · ${current.online ? 'online' : 'offline'}` }),
      h('p', { class: 'fine', text: 'Returning to the main menu saves this run first; Continue brings it back.' }),
    ];
  }

  // ---- events --------------------------------------------------------------

  pauseSheet.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'resume') close();
    else if (action === 'menu') actions.mainMenu?.();
    else if (action === 'export') actions.exportSave?.();
    else openView(action, { fromPauseSheet: true });
  });

  tablet.addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (tab) {
      openView(tab.dataset.tab, { fromPauseSheet: fromPause });
      return;
    }
    const place = event.target.closest('[data-loc]');
    if (place) {
      select = place.dataset.loc;
      render();
      return;
    }
    const qualityButton = event.target.closest('[data-quality]');
    if (qualityButton) {
      actions.quality?.(qualityButton.dataset.quality);
      render();
      return;
    }
    const phoneTarget = event.target.closest('[data-phone-target]');
    if (phoneTarget) {
      const next = phoneTarget.dataset.phoneTarget;
      if (next === 'export') actions.exportSave?.();
      else if (next === 'garage') openView('garage', { fromPauseSheet: fromPause });
      else
        openView(next === 'studio' ? 'map' : next, {
          fromPauseSheet: fromPause,
          select: next === 'studio' ? 'studio' : null,
        });
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'mute') actions.toggleMute?.();
    else if (action.dataset.action === 'export') actions.exportSave?.();
    else if (action.dataset.action === 'import') el('screenImportFile')?.click();
    else if (action.dataset.action === 'menu') actions.mainMenu?.();
  });

  tablet.addEventListener('change', async (event) => {
    if (event.target.id !== 'screenImportFile') return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text().catch(() => '');
    actions.importSave?.(text);
  });

  tabletClose.addEventListener('click', () => {
    if (fromPause) openPause();
    else close();
  });

  return {
    openPause,
    openView,
    close,
    isOpen: () => !pauseSheet.classList.contains('hidden') || !tablet.classList.contains('hidden'),
    toggle() {
      if (this.isOpen()) close();
      else openPause();
    },
    refresh() {
      if (this.isOpen() && view !== 'phone') return;
      if (this.isOpen()) render();
    },
  };
}
