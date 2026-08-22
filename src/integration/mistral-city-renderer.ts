import type { RendererDispatch, RendererEvent, RendererModel } from "./mistral-city";

export type CityRenderer = {
  setModel(model: RendererModel): void;
  onEvent(event: RendererEvent): void;
  replay(events: RendererEvent[], speed?: number): number;
  setSecurity(passedIds: string[]): number | undefined;
  select(id: string): void;
  deselect(): void;
  camera(options: { x?: number; y?: number; z?: number }): void;
  on(name: "select", callback: (id: string) => void): void;
  state(): { health: number; energy: number; systems: number };
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
