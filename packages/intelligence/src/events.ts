import type { AnalysisEvent, EventSink } from "./schema.js";

export const noopEventSink: EventSink = () => undefined;

export function ndjsonEventSink(write: (line: string) => void = (line) => process.stdout.write(line)): EventSink {
  return (event: AnalysisEvent) => write(`${JSON.stringify(event)}\n`);
}

export class EventCollector {
  readonly events: AnalysisEvent[] = [];
  readonly sink: EventSink = (event) => { this.events.push(event); };
}
