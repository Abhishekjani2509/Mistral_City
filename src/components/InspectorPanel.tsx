import type { CatEvent } from "../../contracts/cat-events";
import type { CityModel, CitySystem } from "../../contracts/city-model";
import { relatedSystems } from "../domain/city";

type InspectorPanelProps = {
  city: CityModel;
  selected: CitySystem;
  events: CatEvent[];
  isDispatching: boolean;
  error: string | null;
  onRepair: () => void;
  onSelectSystem: (systemId: string) => void;
};

export function InspectorPanel({
  city,
  selected,
  events,
  isDispatching,
  error,
  onRepair,
  onSelectSystem,
}: InspectorPanelProps) {
  const activeEvent = events[events.length - 1];
  const connections = relatedSystems(city, selected.id);

  return (
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
          <button className="repair-button" disabled={isDispatching} onClick={onRepair}>
            {isDispatching ? "Repair Cat is working…" : "Send Repair Cat"}
          </button>
        </div>
      ) : (
        <div className="healthy-card">This system has no unresolved issues.</div>
      )}

      <div className="detail-section">
        <span className="card-label">CONNECTED SYSTEMS</span>
        {connections.map(({ connection, system }) => (
          <button className="connection-row" key={connection.id} onClick={() => onSelectSystem(system.id)}>
            <span>{system.name}</span>
            <small>{connection.kind}</small>
          </button>
        ))}
      </div>

      <div className="detail-section">
        <span className="card-label">RECENT AGENT ACTIVITY</span>
        <div className="activity-feed">
          {events.length === 0 && <span className="muted">No cat dispatched yet.</span>}
          {events.slice(-5).map((event) => (
            <div className="activity-row" key={`${event.runId}-${event.sequence}`}>
              <span className={`activity-dot activity-${event.phase.toLowerCase()}`} />
              <span>{event.message}</span>
            </div>
          ))}
          {activeEvent && <small className="event-meta">event {activeEvent.sequence} · {activeEvent.phase}</small>}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
    </aside>
  );
}
