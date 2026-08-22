import type { CityModel } from "../../contracts/city-model";
import type { CityLayout } from "../data/demo-layout";
import { buildingIcon } from "../domain/city";

type CityWorldProps = {
  city: CityModel;
  layout: CityLayout;
  selectedId: string;
  isDispatching: boolean;
  onSelectSystem: (systemId: string) => void;
};

function buildingClass(status: string): string {
  return `building building-${status}`;
}

export function CityWorld({ city, layout, selectedId, isDispatching, onSelectSystem }: CityWorldProps) {
  return (
    <div className="city-world" aria-label="Mistral City software map">
      <div className="sun-glow" />
      <svg className="roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {city.connections.map((connection) => {
          const from = layout[connection.from];
          const to = layout[connection.to];
          if (!from || !to) return null;
          const active = connection.from === selectedId || connection.to === selectedId;
          return (
            <line
              key={connection.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={active ? "road road-active" : "road"}
            />
          );
        })}
      </svg>

      <div className="mistral-tower">
        <span>✦</span>
        <small>MISTRAL</small>
      </div>

      {city.systems.map((system) => (
        <button
          key={system.id}
          className={`${buildingClass(system.status)} ${system.id === selectedId ? "building-selected" : ""}`}
          style={{ left: `${layout[system.id]?.x ?? 50}%`, top: `${layout[system.id]?.y ?? 50}%` }}
          onClick={() => onSelectSystem(system.id)}
        >
          <span className="building-icon">{buildingIcon(system.kind)}</span>
          <span className="building-name">{system.name}</span>
          <span className="building-health">{system.health}%</span>
          {system.status === "broken" && <span className="smoke">♨</span>}
          {system.status === "warning" && <span className="warning-dot">!</span>}
        </button>
      ))}

      <div className={`repair-cat ${isDispatching ? "cat-moving" : ""}`} aria-hidden="true">🐈</div>
      <div className="hut repair-hut"><span>⌂</span><small>REPAIR HUT</small></div>
    </div>
  );
}
