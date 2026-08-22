import type { RendererDispatch, RendererEvent, RendererModel } from "./mistral-city";

export type CityRenderer = {
  setModel(model: RendererModel): void;
  onEvent(event: RendererEvent): void;
  replay(events: RendererEvent[], speed?: number): number;
  setSecurity(passedIds: string[]): number | undefined;
  /** Continuous 0..100 security score. Preferred over setSecurity: five
      booleans can only ever produce five states, and the renderer blends
      between eras on the fractional part. */
  setSecurityScore(score: number): number;
  checks(): { id: string; name: string }[];
  levels(): { n: number; name: string; era: string; tone: string; blurb: string }[];
  securityScore(): number;
  securityLevel(): number;
  select(id: string): void;
  deselect(): void;
  camera(options: { x?: number; y?: number; z?: number; snap?: boolean }): void;
  setConnectionState(state: "idle" | "connecting" | "connected", message?: string): void;
  on(name: "select", callback: (id: string) => void): void;
  state(): { health: number; energy: number; systems: number; zoom: number; score: number; level: number };
  destroy(): void;
};

export type MountCity = (
  element: HTMLElement,
  options?: {
    onSelect?: (id: string) => void;
    onConnect?: (url: string) => boolean | void;
    onDispatch?: (dispatch: RendererDispatch) => boolean | void;
    model?: RendererModel;
  },
) => CityRenderer;

// The designer artifact is intentionally a dependency-free JavaScript module.
// Keep this import isolated so replacing the visual layer remains one-file work.
// @ts-expect-error The generated renderer has no declaration file by design.
import { mountCity as generatedMountCity } from "../../mistral-city/city/mistral-city.js";

export const mountCity = generatedMountCity as MountCity;
