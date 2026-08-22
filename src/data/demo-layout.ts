export type CityLayout = Record<string, { x: number; y: number }>;

/** Renderer-owned positions for the temporary DOM city. */
export const DEMO_LAYOUT: CityLayout = {
  frontend: { x: 19, y: 28 },
  auth: { x: 50, y: 25 },
  api: { x: 76, y: 43 },
  database: { x: 49, y: 66 },
  tests: { x: 21, y: 70 },
};
