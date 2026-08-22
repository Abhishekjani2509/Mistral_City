import { randomUUID } from "node:crypto";
import type { AnalysisModel, RepoSnapshot } from "@mistral-city/intelligence";

export interface AnalysisSession {
  snapshot: RepoSnapshot;
  analysis: AnalysisModel;
  source: { webUrl: string; revision: string };
  cleanup: () => Promise<void>;
  expiresAt: number;
}

export class AnalysisSessionStore {
  readonly #sessions = new Map<string, AnalysisSession>();

  constructor(
    readonly lifetimeMs: number,
    readonly now: () => number = Date.now,
    readonly createId: () => string = randomUUID,
  ) {}

  save(session: Omit<AnalysisSession, "expiresAt">): string {
    this.prune();
    const id = this.createId();
    this.#sessions.set(id, { ...session, expiresAt: this.now() + this.lifetimeMs });
    return id;
  }

  get(id: string): AnalysisSession {
    this.prune();
    const session = this.#sessions.get(id);
    if (!session) throw new Error("This repository session expired. Analyze the repository again before sending Scout Cat.");
    session.expiresAt = this.now() + this.lifetimeMs;
    return session;
  }

  prune(): void {
    const now = this.now();
    for (const [id, session] of this.#sessions) {
      if (session.expiresAt <= now) this.dispose(id, session);
    }
  }

  private dispose(id: string, session: AnalysisSession): void {
    this.#sessions.delete(id);
    void session.cleanup().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(`[city-intel] Could not clean expired repository session: ${detail}`);
    });
  }
}
