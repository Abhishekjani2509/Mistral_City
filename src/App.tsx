import { useState } from "react";
import type { CatDispatchRequest, CatEvent } from "../contracts/cat-events";
import type { CityModel } from "../contracts/city-model";
import { dispatchCat } from "./api/cat-runtime";
import { CityWorld } from "./components/CityWorld";
import { InspectorPanel } from "./components/InspectorPanel";
import { TopBar } from "./components/TopBar";
import { systemById } from "./domain/city";
import { DEMO_CITY } from "./data/demo-city";

function App() {
  const [city, setCity] = useState<CityModel>(DEMO_CITY);
  const [selectedId, setSelectedId] = useState("auth");
  const [events, setEvents] = useState<CatEvent[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = systemById(city, selectedId) ?? city.systems[0];

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
      <TopBar city={city} />
      <section className="workspace">
        <div className="city-panel">
          <div className="city-toolbar">
            <div>
              <span className="section-kicker">APPLICATION ECOSYSTEM</span>
              <h2>Every building is a real system.</h2>
            </div>
            <span className="stack-label">{city.repository.detectedStack.join(" · ")}</span>
          </div>
          <CityWorld
            city={city}
            selectedId={selected.id}
            isDispatching={isDispatching}
            onSelectSystem={setSelectedId}
          />
        </div>
        <InspectorPanel
          city={city}
          selected={selected}
          events={events}
          isDispatching={isDispatching}
          error={error}
          onRepair={handleRepair}
          onSelectSystem={setSelectedId}
        />
      </section>
    </main>
  );
}

export default App;
