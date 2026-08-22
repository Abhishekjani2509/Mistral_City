import { useEffect, useRef } from "react";
import type { CatEvent } from "../contracts/cat-events";
import type { CityModel } from "../contracts/city-model";
import { dispatchCat } from "./api/cat-runtime";
import { analyzeRepository, type RepositoryEvent } from "./api/repository";
import { scoutSystem, type ScoutEvent } from "./api/scout";
import {
  applyRepositoryEvent,
  dispatchFromRenderer,
  emptyCityModel,
  toRendererEvent,
  toRendererModel,
  type RendererModel,
  type RendererDispatch,
} from "./integration/mistral-city";
import { mountCity, type CityRenderer } from "./integration/mistral-city-renderer";

function App() {
  const host = useRef<HTMLDivElement>(null);
  const city = useRef<CityRenderer | null>(null);
  const model = useRef<CityModel>(emptyCityModel("GitHub repository"));
  const rendererModel = useRef<RendererModel>(toRendererModel(model.current));
  const analysisSessionId = useRef<string | null>(null);

  function publishModel(next: CityModel) {
    model.current = next;
    rendererModel.current = toRendererModel(next);
    city.current?.setModel(rendererModel.current);
  }

  function handleRepositoryEvent(event: RepositoryEvent) {
    if (event.type === "analysis.session") {
      analysisSessionId.current = event.data.id;
      return;
    }
    if (event.type === "repository.failed") {
      city.current?.onEvent({ type: "agent.log", level: "bad", text: event.data.message });
      return;
    }
    if (event.type === "analysis.complete" && event.data.warnings.length > 0) {
      city.current?.onEvent({
        type: "agent.log",
        level: "sys",
        text: "Analysis completed with partial results. Some areas remain under fog; you can retry or send Scout Cat after the rate limit clears.",
      });
    }
    publishModel(applyRepositoryEvent(model.current, event));
  }

  useEffect(() => {
    if (!host.current) return;

    const handleDispatch = (dispatch: RendererDispatch): boolean => {
      if (dispatch.agent === "scout") {
        const sessionId = analysisSessionId.current;
        if (!sessionId) {
          city.current?.onEvent({
            type: "agent.log",
            level: "bad",
            text: "Analyze a GitHub repository before sending Scout Cat.",
          });
          return false;
        }

        void scoutSystem(sessionId, dispatch.systemId, (event: ScoutEvent) => {
          if (event.type === "scout.progress") {
            city.current?.onEvent({ type: "agent.log", level: "code", text: event.data.message });
            return;
          }

          if (event.type === "scout.complete") {
            city.current?.onEvent({
              type: "agent.done",
              target: event.data.systemId,
              health: event.data.health,
              status: event.data.status,
              summary: event.data.summary,
              detail: event.data.detail,
              files: event.data.files,
            });
            window.setTimeout(() => {
              publishModel(event.data.model);
              city.current?.select(event.data.systemId);
            }, 250);
            return;
          }

          const target = rendererModel.current.systems.find((system) => system.id === event.data.systemId);
          city.current?.onEvent({
            type: "agent.done",
            target: event.data.systemId,
            health: target?.health ?? 0,
            status: target?.status ?? "unknown",
            summary: "Scout Cat could not complete the analysis.",
            detail: event.data.message,
            files: [],
          });
        }).catch((error: unknown) => {
          const target = rendererModel.current.systems.find((system) => system.id === dispatch.systemId);
          city.current?.onEvent({
            type: "agent.done",
            target: dispatch.systemId,
            health: target?.health ?? 0,
            status: target?.status ?? "unknown",
            summary: "Scout Cat could not complete the analysis.",
            detail: error instanceof Error ? error.message : "Unknown Scout Cat error.",
            files: [],
          });
        });
        return true;
      }

      if (dispatch.agent !== "repair") return false;

      const request = dispatchFromRenderer(dispatch);
      void dispatchCat(request, (event: CatEvent) => {
        city.current?.onEvent(toRendererEvent(event, rendererModel.current));
      }, analysisSessionId.current ?? undefined).catch((error: unknown) => {
        city.current?.onEvent({
          type: "agent.done",
          target: request.systemId,
          health: 0,
          status: "broken",
          summary: "Repair Cat could not complete the repair.",
          detail: error instanceof Error ? error.message : "Unknown agent error.",
          files: [],
        });
      });

      return true;
    };

    const mounted = mountCity(host.current, {
      onConnect: (url) => {
        analysisSessionId.current = null;
        publishModel(emptyCityModel("GitHub repository"));
        void analyzeRepository(url, handleRepositoryEvent).catch((error: unknown) => {
          city.current?.onEvent({
            type: "agent.log",
            level: "bad",
            text: error instanceof Error ? error.message : "Repository analysis failed.",
          });
        });
        return true;
      },
      onDispatch: handleDispatch,
    });
    city.current = mounted;

    return () => {
      mounted.destroy();
      city.current = null;
    };
  }, []);

  return <div ref={host} aria-label="Mistral City" style={{ position: "absolute", inset: 0 }} />;
}

export default App;
