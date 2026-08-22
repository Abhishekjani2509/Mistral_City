import { useMemo, useState } from "react";
import type { CatDispatchRequest, CatEvent } from "../contracts/cat-events";
import type { CityModel, CitySystem } from "../contracts/city-model";
import { dispatchCat } from "./api/cat-runtime";
import { DEMO_CITY } from "./data/demo-city";

function healthClass(system: CitySystem): string {
  return `building building-${system.status}`;
}

function systemById(city: CityModel, id: string): CitySystem | undefined {
  return city.systems.find((system) => system.id === id);
}

function App() {
  const [city, setCity] = useState(DEMO_CITY);
  const [selectedId, setSelectedId] = useState("auth");
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = systemById(city, selectedId) ?? city.systems[0];
  const activeEvent = events[events.length - 1];
  const relatedConnections = useMemo(
    () => city.connections.filter((connection) => connection.from === selected.id || connection.to === selected.id),
    [city.connections, selected.id],
  );

  async function handleRepair() {
    const issue = selected.issues[0];
    if (!issue || isDispatching) return;

    const request: CatDispatchRequest = {
      schema: "mistral.city.cat-dispatch/v1",
      runId: `repair-${selected.id}-${Date.now()}`,
      agent: "repair",
      systemId: selected.id,
      issue,
    };

    setEvents([]);
    setError(null);
    setIsDispatching(true);

    try {
      await dispatchCat(request, (event) => {
        setEvents((current) => [...current, event]);

        if (event.phase === "SUCCESS") {
          setCity((current) => ({
            ...current,
            city: { ...current.city, health: 86, status: "healthy" },
            systems: current.systems.map((system) =>
              system.id === event.systemId
                ? { ...system, health: 94, status: "healthy", issues: [], healthSignals: [] }
                : system,
            ),
          }));
        }
      });
    } catch (dispatchError) {
      setError(dispatchError instanceof Error ? dispatchError.message : "Cat dispatch failed.");
    } finally {
      setIsDispatching(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MISTRAL CITY / LIVE REPOSITORY MAP</p>
          <h1>{city.repository.name}</h1>
        </div>
        <div className="topbar-stats">
          <span><strong>{city.city.health}%</strong> city health</span>
          <span><strong>{city.city.energy}</strong> energy</span>
          <span className="connection-pill"><i /> agent bridge online</span>
        </div>
      </header>

      <section className="workspace">
        <div className="city-panel">
          <div className="city-toolbar">
            <div>
              <span className="section-kicker">APPLICATION ECOSYSTEM</span>
              <h2>Every building is a real system.</h2>
            </div>
            <span className="stack-label">{city.repository.detectedStack.join(" · ")}</span>
          </div>

          <div className="city-world" aria-label="Mistral City software map">
            <div className="sun-glow" />
            <svg className="roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {city.connections.map((connection) => {
                const from = systemById(city, connection.from)?.position;
                const to = systemById(city, connection.to)?.position;
                if (!from || !to) return null;
                const active = connection.from === selected.id || connection.to === selected.id;
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
                className={`${healthClass(system)} ${system.id === selected.id ? "building-selected" : ""}`}
                style={{ left: `${system.position.x}%`, top: `${system.position.y}%` }}
                onClick={() => setSelectedId(system.id)}
              >
                <span className="building-icon">{system.kind === "database" ? "▣" : system.kind === "auth" ? "⌘" : system.kind === "tests" ? "♜" : "◆"}</span>
                <span className="building-name">{system.name}</span>
                <span className="building-health">{system.health}%</span>
                {system.status === "broken" && <span className="smoke">♨</span>}
                {system.status === "warning" && <span className="warning-dot">!</span>}
              </button>
            ))}

            <div className={`repair-cat ${isDispatching ? "cat-moving" : ""}`} aria-hidden="true">🐈</div>
            <div className="hut repair-hut"><span>⌂</span><small>REPAIR HUT</small></div>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector-heading">
            <div>
              <span className="section-kicker">SYSTEM INSPECTOR</span>
              <h2>{selected.name}</h2>
            </div>
            <span className={`status-badge status-${selected.status}`}>{selected.status}</span>
          </div>

          <p className="description">{selected.description}</p>

          <div className="health-card">
            <div><span>System health</span><strong>{selected.health}%</strong></div>
            <div className="health-track"><span style={{ width: `${selected.health}%` }} /></div>
          </div>

          {selected.issues.length > 0 ? (
            <div className="issue-card">
              <span className="card-label">DETECTED PROBLEM</span>
              <strong>{selected.issues[0].summary}</strong>
              <p>{selected.issues[0].description}</p>
              <button className="repair-button" disabled={isDispatching} onClick={handleRepair}>
                {isDispatching ? "Repair Cat is working…" : "Send Repair Cat"}
              </button>
            </div>
          ) : (
            <div className="healthy-card">This system has no unresolved issues.</div>
          )}

          <div className="detail-section">
            <span className="card-label">CONNECTED SYSTEMS</span>
            {relatedConnections.map((connection) => {
              const otherId = connection.from === selected.id ? connection.to : connection.from;
              const other = systemById(city, otherId);
              return <button className="connection-row" key={connection.id} onClick={() => setSelectedId(otherId)}><span>{other?.name}</span><small>{connection.kind}</small></button>;
            })}
          </div>

          <div className="detail-section">
            <span className="card-label">RECENT AGENT ACTIVITY</span>
            <div className="activity-feed">
              {events.length === 0 && <span className="muted">No cat dispatched yet.</span>}
              {events.slice(-5).map((event) => <div className="activity-row" key={`${event.runId}-${event.sequence}`}><span className={`activity-dot activity-${event.phase.toLowerCase()}`} /><span>{event.message}</span></div>)}
              {activeEvent && <small className="event-meta">event {activeEvent.sequence} · {activeEvent.phase}</small>}
            </div>
          </div>

          {error && <div className="error-banner">{error}</div>}
        </aside>
      </section>
    </main>
  );
}

export default App;
