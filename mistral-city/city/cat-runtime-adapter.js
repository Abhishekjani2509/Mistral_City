/**
 * Adapter: the cat-agent runtime contract -> the city renderer.
 *
 * contracts/cat-events.ts emits eight phases with a nested payload:
 *   { schema, runId, sequence, emittedAt, agent, phase, systemId, message, payload }
 *
 * The renderer consumes five flat types:
 *   { type:'agent.start'|'agent.log'|'agent.edit'|'agent.test'|'agent.done', ... }
 *
 * They do not line up, so nothing rendered when the two sides were wired
 * together. This translates one into the other and changes neither contract.
 *
 *   import { mountCity } from './city/mistral-city.js'
 *   import { attachCatRuntime } from './city/cat-runtime-adapter.js'
 *
 *   const city = mountCity(host)
 *   const feed = attachCatRuntime(city)
 *   socket.onmessage = m => feed(JSON.parse(m.data))
 */

const PHASES = new Set([
  'DISPATCHED','TRAVELING','INSPECTING','ISSUE_FOUND',
  'EDITING','TESTING','SUCCESS','FAILED'
]);

export function attachCatRuntime(city, opts = {}) {
  const onUnknown = opts.onUnknown || (() => {});
  const onOutOfOrder = opts.onOutOfOrder || (() => {});
  /* health after a repair. The contract carries no health number, so derive it
     from the verification result and let the host override. */
  const healthFor = opts.healthFor || (ev => {
    const v = (ev.payload && ev.payload.verification) || {};
    const pass = v.testsPassed, fail = v.testsFailed;
    if (typeof pass === 'number' && typeof fail === 'number' && pass + fail > 0) {
      return Math.round((pass / (pass + fail)) * 100);
    }
    return 96;
  });

  const seen = new Map();   // runId -> last sequence

  return function feed(ev) {
    if (!ev || typeof ev !== 'object') return;
    const phase = ev.phase;
    if (!PHASES.has(phase)) { onUnknown(ev); return; }

    /* rule 2: sequence starts at 0 and increases by exactly 1. A gap means a
       dropped event, which is worth surfacing but is never fatal to the town. */
    if (ev.runId != null && typeof ev.sequence === 'number') {
      const last = seen.get(ev.runId);
      if (last != null && ev.sequence !== last + 1) onOutOfOrder(ev, last);
      seen.set(ev.runId, ev.sequence);
    }

    const p = ev.payload || {};
    const target = ev.systemId;
    const say = (text, level) => city.onEvent({ type: 'agent.log', text, level: level || '' });

    switch (phase) {
      case 'DISPATCHED':
        city.onEvent({ type: 'agent.start', agent: ev.agent || 'repair', target });
        if (ev.message) say(ev.message, 'sys');
        break;

      case 'TRAVELING':
        say(ev.message || `heading to ${p.to || target}`, '');
        break;

      case 'INSPECTING':
        say(ev.message || 'reading the source', 'code');
        (p.files || []).forEach(f => say(`reading ${f}`, 'code'));
        break;

      case 'ISSUE_FOUND':
        say(ev.message || (p.issue && p.issue.summary) || 'issue found', 'bad');
        break;

      case 'EDITING':
        if (ev.message) say(ev.message, 'code');
        (p.changedFiles || []).forEach(f => city.onEvent({ type: 'agent.edit', file: f }));
        break;

      case 'TESTING':
        if (p.status === 'running') {
          say(ev.message || `running ${p.command || 'the suite'}`, 'code');
        } else {
          city.onEvent({
            type: 'agent.test',
            suite: p.command || 'suite',
            pass: p.passed || 0,
            fail: p.failed || 0
          });
        }
        break;

      case 'SUCCESS': {
        const files = p.changedFiles || [];
        city.onEvent({
          type: 'agent.done',
          target,
          health: healthFor(ev),
          status: 'healthy',
          summary: p.summary || ev.message || 'repaired',
          detail: ((p.verification && p.verification.commands) || []).join(', '),
          files
        });
        if (ev.runId != null) seen.delete(ev.runId);
        break;
      }

      case 'FAILED':
        /* The renderer has no failure animation, so the cat is sent home and
           the building keeps its damage rather than silently going green. */
        say(p.summary || ev.message || 'the run failed', 'bad');
        if (p.details) say(p.details, '');
        city.onEvent({
          type: 'agent.done',
          target,
          status: 'broken',
          summary: p.summary || 'repair failed',
          detail: p.retryable ? 'retryable' : String(p.code || 'agent error'),
          files: []
        });
        if (ev.runId != null) seen.delete(ev.runId);
        break;
    }
  };
}

export default attachCatRuntime;
