import type { CityModel } from "../../contracts/city-model";

type TopBarProps = {
  city: CityModel;
};

export function TopBar({ city }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">MISTRAL CITY / LIVE REPOSITORY MAP</p>
        <h1>{city.repository.name}</h1>
      </div>
      <div className="topbar-stats">
        <span><strong>{city.city.health}%</strong> city health</span>
        <span><strong>{city.systems.length}</strong> systems</span>
        <span className="connection-pill"><i /> agent bridge online</span>
      </div>
    </header>
  );
}
