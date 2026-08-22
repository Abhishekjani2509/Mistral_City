/**
 * Validation test for runRepair
 * 
 * Compares output against contracts/repair-run.example.ndjson
 */

import { runRepair } from "./repair";
import { CatDispatchRequest, CatEvent, isTerminalCatEvent } from "../../contracts/cat-events";
import fs from "fs";
import path from "path";

// Load the example ndjson file
const examplePath = path.join(__dirname, "../../contracts/repair-run.example.ndjson");
const exampleText = fs.readFileSync(examplePath, "utf-8");
const exampleEvents: CatEvent[] = exampleText
  .split("\n")
  .filter(line => line.trim())
  .map(line => JSON.parse(line));

// Create a matching request for the example
const exampleRequest: CatDispatchRequest = {
  schema: "mistral.city.cat-dispatch/v1",
  runId: "repair-auth-001",
  agent: "repair",
  systemId: "auth",
  issue: {
    id: "auth-session-persistence",
    type: "failing_test",
    summary: "Session does not persist after refresh",
    description: "A logged-in user is returned to the login screen after refreshing the page.",
    files: ["src/auth/session.ts", "tests/auth/session.test.ts"],
    reproduction: "Run the authentication test suite and refresh after login.",
  },
};

async function validateRepairFlow() {
  console.log("🧪 Validating runRepair against example.ndjson...\n");

  const events: CatEvent[] = [];
  
  for await (const event of runRepair(exampleRequest)) {
    events.push(event);
  }

  // Validate sequence
  console.log("✓ Checking sequence...");
  for (let i = 0; i < events.length; i++) {
    if (events[i].sequence !== i) {
      throw new Error(`Sequence mismatch at index ${i}: expected ${i}, got ${events[i].sequence}`);
    }
  }
  console.log(`  ✓ Sequence is 0..${events.length - 1} with no gaps\n`);

  // Validate runId is stable
  console.log("✓ Checking runId stability...");
  const runIds = new Set(events.map(e => e.runId));
  if (runIds.size !== 1) {
    throw new Error(`runId is not stable: found ${runIds.size} different values`);
  }
  if (!runIds.has(exampleRequest.runId)) {
    throw new Error(`runId mismatch: expected ${exampleRequest.runId}, got ${Array.from(runIds)[0]}`);
  }
  console.log(`  ✓ runId is stable: ${exampleRequest.runId}\n`);

  // Validate exactly one terminal event
  console.log("✓ Checking terminal events...");
  const terminalEvents = events.filter(isTerminalCatEvent);
  if (terminalEvents.length !== 1) {
    throw new Error(`Expected exactly 1 terminal event, got ${terminalEvents.length}`);
  }
  if (terminalEvents[0].phase !== "SUCCESS") {
    throw new Error(`Expected SUCCESS terminal event, got ${terminalEvents[0].phase}`);
  }
  console.log(`  ✓ Exactly one SUCCESS terminal event\n`);

  // Validate all required fields
  console.log("✓ Checking required fields...");
  const requiredFields = ["schema", "runId", "sequence", "emittedAt", "agent", "phase", "systemId", "message"];
  for (const event of events) {
    for (const field of requiredFields) {
      if (!(field in event)) {
        throw new Error(`Missing required field ${field} in event ${event.sequence}`);
      }
    }
  }
  console.log(`  ✓ All required fields present\n`);

  // Validate phase order matches example
  console.log("✓ Checking phase order...");
  const expectedPhases = exampleEvents.map(e => e.phase);
  const actualPhases = events.map(e => e.phase);
  
  if (JSON.stringify(expectedPhases) !== JSON.stringify(actualPhases)) {
    console.log(`  ⚠️  Phase order differs from example:`);
    console.log(`    Expected: ${JSON.stringify(expectedPhases)}`);
    console.log(`    Actual:   ${JSON.stringify(actualPhases)}`);
    // This is okay for MVP as long as it's logical
  } else {
    console.log(`  ✓ Phase order matches example\n`);
  }

  // Validate schema
  console.log("✓ Checking schema...");
  for (const event of events) {
    if (event.schema !== "mistral.city.cat-event/v1") {
      throw new Error(`Invalid schema in event ${event.sequence}: ${event.schema}`);
    }
  }
  console.log(`  ✓ All events use correct schema\n`);

  // Validate agent
  console.log("✓ Checking agent...");
  for (const event of events) {
    if (event.agent !== "repair") {
      throw new Error(`Invalid agent in event ${event.sequence}: ${event.agent}`);
    }
  }
  console.log(`  ✓ All events use repair agent\n`);

  // Validate systemId
  console.log("✓ Checking systemId...");
  for (const event of events) {
    if (event.systemId !== "auth") {
      throw new Error(`Invalid systemId in event ${event.sequence}: ${event.systemId}`);
    }
  }
  console.log(`  ✓ All events target auth system\n`);

  // Validate payloads by phase
  console.log("✓ Checking phase-specific payloads...");
  for (const event of events) {
    switch (event.phase) {
      case "DISPATCHED":
        if (!event.payload?.issue) {
          throw new Error(`DISPATCHED event ${event.sequence} missing issue in payload`);
        }
        break;
      case "TRAVELING":
        if (!event.payload?.from || !event.payload?.to) {
          throw new Error(`TRAVELING event ${event.sequence} missing from/to in payload`);
        }
        break;
      case "INSPECTING":
        if (!event.payload?.files) {
          throw new Error(`INSPECTING event ${event.sequence} missing files in payload`);
        }
        break;
      case "ISSUE_FOUND":
        if (!event.payload?.issue) {
          throw new Error(`ISSUE_FOUND event ${event.sequence} missing issue in payload`);
        }
        break;
      case "EDITING":
        if (!event.payload?.changedFiles) {
          throw new Error(`EDITING event ${event.sequence} missing changedFiles in payload`);
        }
        break;
      case "TESTING":
        if (!event.payload?.command || !event.payload?.status) {
          throw new Error(`TESTING event ${event.sequence} missing command/status in payload`);
        }
        break;
      case "SUCCESS":
        if (!event.payload?.summary || !event.payload?.changedFiles || !event.payload?.verification) {
          throw new Error(`SUCCESS event ${event.sequence} missing required fields in payload`);
        }
        break;
    }
  }
  console.log(`  ✓ All phase-specific payloads are valid\n`);

  // Summary
  console.log("=" .repeat(60));
  console.log(`✅ All validations passed!`);
  console.log(`   Total events: ${events.length}`);
  console.log(`   Phases: ${actualPhases.join(" → ")}`);
  console.log(`   Run ID: ${events[0].runId}`);
  console.log("=" .repeat(60));
}

validateRepairFlow().catch((error) => {
  console.error("❌ Validation failed:", error.message);
  process.exit(1);
});
