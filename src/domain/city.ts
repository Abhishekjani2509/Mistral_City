import type { CityModel, CitySystem } from "../../contracts/city-model";

export function systemById(city: CityModel, id: string): CitySystem | undefined {
  return city.systems.find((system) => system.id === id);
}

export function relatedSystems(city: CityModel, selectedId: string) {
  return city.connections
    .filter((connection) => connection.from === selectedId || connection.to === selectedId)
    .map((connection) => {
      const otherId = connection.from === selectedId ? connection.to : connection.from;
      return { connection, system: systemById(city, otherId) };
    })
    .filter((item): item is typeof item & { system: CitySystem } => Boolean(item.system));
}

export function buildingIcon(kind: CitySystem["kind"]): string {
  switch (kind) {
    case "database":
      return "▣";
    case "auth":
      return "⌘";
    case "tests":
      return "♜";
    default:
      return "◆";
  }
}
