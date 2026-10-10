// The fixed geography of the playable town. Coordinates are metres.
// North is -Z, east is +X. Everything else (loot, enemies) is randomised per run;
// this file never changes between runs.

// Roads: a -> b, width, surface. "lane" surfaces are brick-paved khadanja.
export const ROADS = {
  MAIN:    { a: [0, -198], b: [0, 90],    w: 11, s: 'asphalt', name: 'मुख्य मार्ग' },
  SW:      { a: [0, 90],   b: [-118, 182], w: 9, s: 'asphalt', name: 'सलोन रोड' },
  SE:      { a: [0, 90],   b: [160, 176],  w: 9, s: 'asphalt', name: 'अमेठी रोड' },
  WAHAB:   { a: [0, 0],    b: [-200, 0],   w: 8, s: 'asphalt', name: 'वहाबगंज बाज़ार' },
  STN:     { a: [0, -128], b: [112, -128], w: 8, s: 'asphalt', name: 'स्टेशन रोड' },
  L1:      { a: [-45, -4], b: [-45, -78],  w: 4.6, s: 'lane' },
  L2:      { a: [-95, 4],  b: [-95, 166],  w: 5, s: 'lane' },
  L3:      { a: [-150, -4], b: [-150, -160], w: 5, s: 'lane' },
  ALIA:    { a: [-95, 40], b: [-172, 40],  w: 5, s: 'lane', name: 'आलिया मार्केट' },
  WELLST:  { a: [-95, 66], b: [-172, 66],  w: 5, s: 'lane' },
  E1:      { a: [5, 40],   b: [96, 40],    w: 5, s: 'lane' },
  E2:      { a: [62, 36],  b: [62, -124],  w: 5, s: 'lane' },
  E3:      { a: [5, -62],  b: [104, -62],  w: 5, s: 'lane' },
  W2:      { a: [-45, -78], b: [-150, -78], w: 4.6, s: 'lane' },
};

// Railway line (east-west), stations along it.
export const RAIL = {
  mainZ: -176, loopZ: -170, x0: -235, x1: 235,
  jaisCity: { x0: -168, x1: -112, z: -166 },   // former Kasimpur Halt
  ggd: { x0: 92, x1: 186, z: -164 },           // Guru Gorakhnath Dham
};

export const NAUGAZI = [0, 90];

// Maa Kamakhya composition, north to south along x = -125:
// TEMPLE | ALIA MARKET | WELL | STREET | THREE-FLOOR HOUSE
export const KAMAKHYA = {
  temple: { x: -127, z: 27, w: 20, d: 18 },      // compound, gate faces south onto Alia lane
  well: { x: -125, z: 55 },
  house: { x: -125, z: 69 },                      // front of the three-floor house, faces the well
};

export const BUS_ADDA = { t: 0.5, side: -1 };     // along SE road

// Named zones for the subtle area title that fades in.
export const ZONES = [
  { name: 'गुप्त शिवधाम', en: 'THE HIDDEN SHIVDHAM', x0: -1250, x1: -800, z0: -400, z1: -2 },
  { name: 'गुप्त कालीधाम', en: 'THE HIDDEN KALIDHAM', x0: -500, x1: 300, z0: -1700, z1: -1076 },
  { name: 'माँ कामाख्या मंदिर', en: 'MAA KAMAKHYA MANDIR', x0: -138, x1: -116, z0: 17, z1: 37.5 },
  { name: 'आलिया मार्केट', en: 'ALIA MARKET', x0: -172, x1: -95, z0: 36, z1: 72 },
  { name: 'जायस सिटी स्टेशन', en: 'JAIS CITY STATION', x0: -180, x1: -100, z0: -195, z1: -150 },
  { name: 'गुरु गोरखनाथ धाम स्टेशन', en: 'GURU GORAKHNATH DHAM STN.', x0: 85, x1: 195, z0: -195, z1: -112 },
  { name: 'रेलवे फाटक', en: 'RAILWAY CROSSING', x0: -20, x1: 20, z0: -195, z1: -160 },
  { name: 'नौगजी तिराहा', en: 'NAUGAZI TRIJUNCTION', x0: -22, x1: 22, z0: 72, z1: 110 },
  { name: 'बस अड्डा', en: 'BUS ADDA', x0: 40, x1: 130, z0: 95, z1: 165 },
  { name: 'वहाबगंज', en: 'WAHABGANJ', x0: -200, x1: 6, z0: -80, z1: 36 },
  { name: 'स्टेशन रोड', en: 'STATION ROAD', x0: 0, x1: 112, z0: -140, z1: -116 },
  { name: 'जायस', en: 'JAIS', x0: -1e4, x1: 1e4, z0: -1e4, z1: 1e4 },
];

export const BOUNDS = { minX: -235, maxX: 235, minZ: -205, maxZ: 195 };

export function roadInfo(r) {
  const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  return { len, ux, uz, nx: uz, nz: -ux, yaw: Math.atan2(dx, dz), cx: (r.a[0] + r.b[0]) / 2, cz: (r.a[1] + r.b[1]) / 2 };
}

// A building frame next to a road: t metres from road start, side +1/-1.
export function frameOnRoad(r, t, side, setback = 0.9) {
  const i = roadInfo(r);
  const nx = i.nx * side, nz = i.nz * side;
  const off = r.w / 2 + setback;
  return { x: r.a[0] + i.ux * t + nx * off, z: r.a[1] + i.uz * t + nz * off, yaw: Math.atan2(nx, nz) };
}
