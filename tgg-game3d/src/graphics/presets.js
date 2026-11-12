// Lighting presets and the fixed camera views used for visual verification.
//
// These are the same six angles every time: day, sunset, night, street level, a
// vehicle close-up and a character close-up. A visually "better" build that cannot
// be compared against the previous one is a matter of taste, so the views are data.

export const HOURS = {
  morning: 9,
  day: 12,
  afternoon: 16,
  sunset: 18.4,
  dusk: 20,
  night: 22,
};

export const LIGHTING_PRESETS = [
  { id: 'day', label: 'Midday', hour: HOURS.day },
  { id: 'sunset', label: 'Sunset', hour: HOURS.sunset },
  { id: 'night', label: 'Night', hour: HOURS.night },
];

// Harbour Row stands at (0, 78); the street runs beside it at x = 39.
export const DISTRICT_CENTER = { x: 0, z: 78 };

export const PHOTO_VIEWS = [
  {
    id: 'day',
    label: 'Daytime · street level',
    hour: HOURS.day,
    camera: { position: [46, 3, 116], target: [8, 14, 72], fov: 58 },
  },
  {
    id: 'sunset',
    label: 'Sunset · street level',
    hour: HOURS.sunset,
    camera: { position: [46, 3, 116], target: [8, 14, 72], fov: 58 },
  },
  {
    id: 'night',
    label: 'Night · street level',
    hour: HOURS.night,
    camera: { position: [46, 3, 116], target: [8, 14, 72], fov: 58 },
  },
  {
    id: 'street',
    label: 'Street view · city block',
    hour: HOURS.afternoon,
    camera: { position: [54, 16, 130], target: [0, 16, 76], fov: 60 },
  },
  {
    id: 'vehicle',
    label: 'Vehicle close-up',
    hour: HOURS.afternoon,
    // Front three-quarter, derived from wherever the car is parked.
    subject: 'car',
    offset: { forward: 7.2, side: 4.4, height: 2.2 },
    target: { height: 0.85, forward: 0.2 },
    fov: 34,
  },
  {
    id: 'character',
    label: 'Character close-up',
    hour: HOURS.afternoon,
    subject: 'walker',
    // Framed low and a little wide: the HUD's top bar covers a centred head at
    // close range, and a portrait that hides the face proves nothing.
    offset: { forward: 3.6, side: 0.95, height: 1.5 },
    target: { height: 1.02, forward: 0 },
    fov: 44,
    place: { x: 33, z: 101, heading: Math.PI },
  },
];

export function viewIds() {
  return PHOTO_VIEWS.map((view) => view.id);
}

export function getView(id) {
  return PHOTO_VIEWS.find((view) => view.id === id) ?? null;
}

// Resolves a view against live subject positions. Kept free of three.js so it can
// be checked in Node: positions are plain arrays.
export function resolveView(id, ctx = {}) {
  const view = getView(id);
  if (!view) throw new Error(`unknown photo view ${id}`);

  let camera = view.camera;
  if (view.subject) {
    const subject = view.subject === 'car' ? ctx.car : ctx.walker;
    if (!subject) throw new Error(`view ${id} needs a ${view.subject} position`);
    const { x, z } = subject.pos ?? subject;
    const heading = subject.heading ?? 0;
    const forward = [Math.sin(heading), Math.cos(heading)];
    const right = [Math.cos(heading), -Math.sin(heading)];
    const { forward: f, side, height } = view.offset;
    const targetHeight = view.target.height + (view.target.forward ?? 0) * 0;
    camera = {
      position: [
        Number((x + forward[0] * f + right[0] * side).toFixed(2)),
        height,
        Number((z + forward[1] * f + right[1] * side).toFixed(2)),
      ],
      target: [
        Number((x + forward[0] * (view.target.forward ?? 0)).toFixed(2)),
        targetHeight,
        Number((z + forward[1] * (view.target.forward ?? 0)).toFixed(2)),
      ],
      fov: view.fov,
    };
    // A close-up of the player has to be behind the player's own camera, so the
    // photo mode temporarily takes the camera instead of the follow rig.
  }

  return {
    id: view.id,
    label: view.label,
    hour: view.hour,
    camera,
    place: view.place ?? null,
    subject: view.subject ?? null,
  };
}
