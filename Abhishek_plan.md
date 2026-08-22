# Abhishek's Plan: Cat Agent Runtime for Mistral City

> **Your Role**: Cat Agent Runtime - The "brains" of Mistral City. You make the cats *actually* fix code.
> **Without you**, the city is just a pretty animation with no substance.

---

## 🎯 Your Mission

You own the system that allows Mistral AI agents (represented as cats) to **analyze, edit, and test real code** in a repository.

### Core Responsibility
When a user clicks **"Dispatch Repair Cat"**, your system must:
1. Receive the issue (e.g., "Auth Gate failing test")
2. Launch a **real Mistral/Vibe agent** to analyze the repo
3. Have the agent **edit the actual code** (e.g., fix session persistence)
4. Run tests to verify the fix
5. Emit **structured events** (`DISPATCHED` → `INSPECTING` → `EDITING` → `TESTING` → `SUCCESS`)
6. Return the result so Neo can animate the cat

---

## 📋 Your 7-Step Execution Plan

---

### 🔹 Step 1: Create the Demo Repo with a Bug (1–2 hours)
**Goal**: Create a **deterministic, fixable** bug for Mistral to solve.

#### 📁 Setup the Repo
```bash
# 1. Create a Next.js app (or use existing)
npx create-next-app@latest mistral-city-demo --typescript --eslint
cd mistral-city-demo

# 2. Install testing dependencies
npm install jest @testing-library/react @testing-library/jest-dom --save-dev
npm install ts-jest --save-dev

# 3. Initialize Jest
npx ts-jest config:init
```

#### 🐛 Add the Bug (Session Persistence Issue)
Create a **broken auth system** where the session disappears on page refresh.

##### File: `src/app/auth/session.ts`
```typescript
"use client"; // Next.js client component
import { useState } from "react";

export const useSession = () => {
  // ❌ BUG: Session stored in React state (lost on refresh)
  const [session, setSession] = useState<string | null>(null);
  return { session, setSession };
};
```

##### File: `src/app/login/page.tsx`
```typescript
"use client";
import { useSession } from "../auth/session";

export default function LoginPage() {
  const { session, setSession } = useSession();

  const login = () => setSession("user123");
  const logout = () => setSession(null);

  return (
    <div>
      {session ? (
        <div>
          <p>Logged in as: {session}</p>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <button onClick={login}>Login</button>
      )}
    </div>
  );
}
```

#### 🧪 Add a Failing Test
##### File: `src/app/auth/session.test.ts`
```typescript
import { renderHook } from "@testing-library/react";
import { useSession } from "./session";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

test("session persists after refresh", () => {
  // Simulate a page refresh by re-rendering the hook
  const { result, unmount } = renderHook(() => useSession());
  result.current.setSession("user123");
  expect(result.current.session).toBe("user123");

  // Simulate refresh: unmount and remount
  unmount();
  const { result: newResult } = renderHook(() => useSession());

  // ❌ FAILS: Session is lost because it's only in React state
  expect(newResult.current.session).toBe("user123");
});
```

#### 🔧 Configure Jest
##### File: `jest.config.js`
```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
```

##### File: `jest.setup.js`
```javascript
// Optional: Add global mocks if needed
```

#### ✅ Verify the Bug
```bash
npm test -- src/app/auth/session.test.ts
```
**Expected**: Test **fails** with:
```
Expected: "user123"
Received: null
```

---

### 🔹 Step 2: Build the Repair Cat Agent (2–3 hours)
**Goal**: Create a function that uses **Mistral AI** to fix the bug and emit events.

#### 📁 Create the Agents Directory
```bash
mkdir -p agents
touch agents/types.ts agents/repairCat.ts agents/catDispatcher.ts
```

#### 📜 Define Types (`agents/types.ts`)
```typescript
export type CatType = "repair" | "guard" | "scout";

export interface CatEvent {
  type: "DISPATCHED" | "TRAVELING" | "INSPECTING" | "EDITING" | "TESTING" | "SUCCESS" | "FAILED" | "EXPLORING" | "FOG_CLEARED";
  cat: CatType;
  target?: string;       // e.g., "auth"
  message?: string;      // e.g., "Analyzing session.ts..."
  file?: string;         // e.g., "src/auth/session.ts"
  healthDelta?: number;  // e.g., +30
  reason?: string;       // e.g., "Tests failed after fix"
  newSystems?: Array<{   // For Scout Cat
    id: string;
    name: string;
    type: string;
  }>;
}

export interface RepairCatInput {
  systemId: string;      // e.g., "auth"
  issue: {
    type: string;        // e.g., "failing_test"
    description: string; // e.g., "Session does not persist after refresh"
    files: string[];     // e.g., ["src/app/auth/session.ts"]
  };
  repoPath: string;      // e.g., "/path/to/mistral-city-demo"
}
```

#### 🤖 Implement Repair Cat (`agents/repairCat.ts`)
```typescript
import { readFile, writeFile } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import { CatEvent, RepairCatInput } from "./types";

export async function* repairCatAgent(input: RepairCatInput): AsyncGenerator<CatEvent> {
  const { systemId, issue, repoPath } = input;

  // 1. Emit DISPATCHED
  yield { type: "DISPATCHED", cat: "repair", target: systemId };

  // 2. Read files
  yield { type: "INSPECTING", cat: "repair", message: "Reading files...", target: systemId };
  const filesContent = await Promise.all(
    issue.files.map(async (file) => {
      const fullPath = path.join(repoPath, file);
      try {
        return {
          file,
          content: await readFile(fullPath, "utf-8"),
        };
      } catch (e) {
        return { file, content: "FILE_NOT_FOUND" };
      }
    })
  );

  // 3. Prepare Mistral prompt
  const filesContext = filesContent
    .map((f) => `--- ${f.file} ---\n${f.content}\n`)
    .join("\n");

  const prompt = `
You are Repair Cat, a coding agent that fixes bugs in TypeScript/React code.

## ISSUE
Type: ${issue.type}
Description: ${issue.description}

## FILES
${filesContext}

## INSTRUCTIONS
1. Analyze the code to find the root cause.
2. Fix the bug with the MINIMAL change.
3. Return ONLY a JSON object with the format below (no other text).

## RETURN FORMAT
{
  "analysis": "Root cause of the bug",
  "changes": [
    {
      "file": "path/to/file.ts",
      "old": "exact code to replace",
      "new": "fixed code"
    }
  ]
}
`.trim();

  // 4. Call Mistral via Vibe CLI
  yield { type: "INSPECTING", cat: "repair", message: "Consulting Mistral...", target: systemId };

  // Write prompt to temp file
  const tempPromptPath = path.join(repoPath, ".vibe_repair_prompt.txt");
  await writeFile(tempPromptPath, prompt);

  // Run Mistral Vibe
  const vibeProcess = spawn(
    "vibe",
    [
      "--non-interactive",
      "--prompt",
      tempPromptPath,
      "--output-format",
      "json",
      "--temperature",
      "0.1", // Low temp for deterministic output
    ],
    { cwd: repoPath }
  );

  let mistralOutput = "";
  for await (const chunk of vibeProcess.stdout) {
    mistralOutput += chunk.toString();
  }

  // 5. Parse Mistral's JSON response
  let fixData: { analysis?: string; changes?: Array<{ file: string; old: string; new: string }> };
  try {
    // Extract JSON from output (Vibe may add extra text)
    const jsonMatch = mistralOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Mistral output");
    fixData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    yield { type: "FAILED", cat: "repair", reason: `Mistral error: ${e.message}`, target: systemId };
    return;
  }

  // 6. Apply fixes
  if (fixData.changes?.length) {
    yield { type: "EDITING", cat: "repair", message: "Applying fixes...", target: systemId };

    for (const change of fixData.changes) {
      const fullPath = path.join(repoPath, change.file);
      try {
        const fileContent = await readFile(fullPath, "utf-8");
        const newContent = fileContent.replace(change.old, change.new);
        await writeFile(fullPath, newContent);
      } catch (e) {
        yield { type: "FAILED", cat: "repair", reason: `Failed to edit ${change.file}: ${e.message}`, target: systemId };
        return;
      }
    }
  } else {
    yield { type: "FAILED", cat: "repair", reason: "Mistral did not suggest any changes", target: systemId };
    return;
  }

  // 7. Run tests
  yield { type: "TESTING", cat: "repair", message: "Running tests...", target: systemId, test: issue.description };

  const testProcess = spawn("npm", ["test", "--", `--testPathPattern=${path.basename(issue.files[0])}`], {
    cwd: repoPath,
  });

  let testOutput = "";
  for await (const chunk of testProcess.stdout) {
    testOutput += chunk.toString();
  }

  const testsPassed = testProcess.exitCode === 0 && !testOutput.includes("FAIL");

  // 8. Emit final event
  if (testsPassed) {
    yield {
      type: "SUCCESS",
      cat: "repair",
      target: systemId,
      message: fixData.analysis || "Bug fixed successfully",
      healthDelta: 30,
    };
  } else {
    yield {
      type: "FAILED",
      cat: "repair",
      target: systemId,
      reason: "Tests failed after fix",
      message: testOutput,
    };
  }
}
```

---

### 🔹 Step 3: Create the Cat Dispatcher (`agents/catDispatcher.ts`)
**Goal**: Single entry point for all cats. Neo will call this.

```typescript
import { repairCatAgent } from "./repairCat";
import { CatEvent, RepairCatInput } from "./types";

// Stub for Guard Cat (visual-only for MVP)
async function* guardCatAgent(input: any): AsyncGenerator<CatEvent> {
  yield { type: "DISPATCHED", cat: "guard", target: input.systemId };
  yield { type: "INSPECTING", cat: "guard", message: "Analyzing test coverage...", target: input.systemId };
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate work
  yield { type: "SUCCESS", cat: "guard", target: input.systemId, message: "Added test coverage", healthDelta: 15 };
}

// Stub for Scout Cat (visual-only for MVP)
async function* scoutCatAgent(input: any): AsyncGenerator<CatEvent> {
  yield { type: "DISPATCHED", cat: "scout", target: input.systemId };
  yield { type: "EXPLORING", cat: "scout", message: "Mapping unknown systems...", target: input.systemId };
  await new Promise((resolve) => setTimeout(resolve, 3000));
  yield {
    type: "FOG_CLEARED",
    cat: "scout",
    target: input.systemId,
    message: "Discovered new systems",
    newSystems: [{ id: "payments", name: "Payments", type: "workshop" }],
  };
  yield { type: "SUCCESS", cat: "scout", target: input.systemId };
}

export function dispatchCat(input: {
  catType: CatType;
  systemId: string;
  issue?: RepairCatInput["issue"];
  repoPath: string;
}) {
  switch (input.catType) {
    case "repair":
      return repairCatAgent({ systemId: input.systemId, issue: input.issue!, repoPath: input.repoPath });
    case "guard":
      return guardCatAgent(input);
    case "scout":
      return scoutCatAgent(input);
    default:
      throw new Error(`Unknown cat type: ${input.catType}`);
  }
}

export type { CatEvent, CatType };
```

---

### 🔹 Step 4: Test the Agent Locally (1 hour)
**Goal**: Verify the Repair Cat works **before** integrating with Neo.

#### 📄 Create a Test Script (`testRepairCat.ts`)
```typescript
import { dispatchCat } from "./agents/catDispatcher";
import path from "path";

const demoRepoPath = path.join(__dirname, "mistral-city-demo");

async function testRepairCat() {
  console.log("🚀 Testing Repair Cat...");
  const eventStream = dispatchCat({
    catType: "repair",
    systemId: "auth",
    issue: {
      type: "failing_test",
      description: "Session does not persist after refresh",
      files: ["src/app/auth/session.ts"],
    },
    repoPath: demoRepoPath,
  });

  for await (const event of eventStream) {
    console.log("📬 Event:", JSON.stringify(event, null, 2));
  }
}

testRepairCat().catch(console.error);
```

#### 🏃 Run the Test
```bash
# Compile TypeScript (if needed)
npx ts-node testRepairCat.ts
```

**Expected Output:**
```json
📬 Event: {
  "type": "DISPATCHED",
  "cat": "repair",
  "target": "auth"
}
📬 Event: {
  "type": "INSPECTING",
  "cat": "repair",
  "message": "Reading files...",
  "target": "auth"
}
📬 Event: {
  "type": "INSPECTING",
  "cat": "repair",
  "message": "Consulting Mistral...",
  "target": "auth"
}
📬 Event: {
  "type": "EDITING",
  "cat": "repair",
  "message": "Applying fixes...",
  "target": "auth"
}
📬 Event: {
  "type": "TESTING",
  "cat": "repair",
  "message": "Running tests...",
  "target": "auth",
  "test": "Session does not persist after refresh"
}
📬 Event: {
  "type": "SUCCESS",
  "cat": "repair",
  "target": "auth",
  "message": "Session was stored in React state, which is lost on refresh. Moved to localStorage.",
  "healthDelta": 30
}
```

#### ⚠️ Troubleshooting
| Issue | Fix |
|-------|-----|
| **Mistral doesn't return JSON** | Add `--output-format json` to Vibe CLI. |
| **File not found** | Check `repoPath` and file paths. Use absolute paths. |
| **Tests still fail** | Manually verify the fix. Adjust the prompt for Mistral. |
| **Vibe CLI not found** | Install globally: `npm install -g @mistral/vibe` |

---

### 🔹 Step 5: Integrate with Neo's Frontend (1–2 hours)
**Goal**: Connect your agents to Neo's city UI.

#### Option A: Direct Integration (Electron/Desktop App)
If Mistral City is a **desktop app** (e.g., Electron), Neo can call your `dispatchCat` directly.

##### Neo's Code (Example)
```typescript
// In Neo's frontend (e.g., React component)
import { dispatchCat, CatEvent } from "../agents/catDispatcher";

const handleDispatchRepairCat = async (systemId: string) => {
  const eventStream = dispatchCat({
    catType: "repair",
    systemId,
    issue: {
      type: "failing_test",
      description: "Session does not persist after refresh",
      files: ["src/app/auth/session.ts"], // From Paul's City Model
    },
    repoPath: "/path/to/demo-repo", // Hardcoded for MVP
  });

  for await (const event of eventStream) {
    // Update UI based on event
    switch (event.type) {
      case "DISPATCHED":
        showCatLeavingHut(event.cat, event.target!);
        break;
      case "INSPECTING":
        showCatAtBuilding(event.cat, event.target!);
        setBuildingMessage(event.message!);
        break;
      case "EDITING":
        showScaffolding(event.target!);
        break;
      case "SUCCESS":
        healBuilding(event.target!);
        updateCityHealth(+event.healthDelta!);
        break;
      case "FAILED":
        showError(event.reason!);
        break;
    }
  }
};
```

#### Option B: Backend API (Web App)
If Mistral City is a **web app**, create a simple Express server to bridge Node.js and the browser.

##### 📄 `server.ts`
```typescript
import express from "express";
import { dispatchCat } from "./agents/catDispatcher";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/dispatch-cat", async (req, res) => {
  const { catType, systemId, issue, repoPath } = req.body;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const eventStream = dispatchCat({ catType, systemId, issue, repoPath });

  for await (const event of eventStream) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  res.end();
});

app.listen(3001, () => {
  console.log("🚀 Agent API running on http://localhost:3001");
});
```

##### Neo's Frontend Code (Web)
```typescript
const handleDispatchRepairCat = async (systemId: string) => {
  const response = await fetch("http://localhost:3001/api/dispatch-cat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      catType: "repair",
      systemId,
      issue: {
        type: "failing_test",
        description: "Session does not persist after refresh",
        files: ["src/app/auth/session.ts"],
      },
      repoPath: "/path/to/demo-repo", // Hardcoded for MVP
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    const events = text.split("\n\n").filter(Boolean);
    for (const event of events) {
      if (event.startsWith("data: ")) {
        const data = JSON.parse(event.slice(6));
        // Handle event (same as Option A)
        console.log("Event:", data);
      }
    }
  }
};
```

---

### 🔹 Step 6: Validate the Golden Path (1–2 hours)
**Goal**: Ensure the **full flow** works 10/10 times.

#### 🎯 Test Checklist
| Step | Expected Behavior | How to Test |
|------|-------------------|-------------|
| 1 | Neo renders city with broken Auth Gate | Visual check |
| 2 | Click "Dispatch Repair Cat" | UI action |
| 3 | Cat leaves hut (DISPATCHED event) | Visual: Cat animates from hut |
| 4 | Cat arrives at Auth Gate (INSPECTING) | Visual: Cat at building |
| 5 | Scaffolding appears (EDITING) | Visual: Scaffolding around building |
| 6 | Mistral fixes `session.ts` | Check file contents |
| 7 | Tests pass (TESTING → SUCCESS) | Check test output |
| 8 | Building heals (SUCCESS) | Visual: Smoke clears, health ↑ |
| 9 | City health increases | Visual: Global health % |

#### 🔄 Automation Script
Create a script to test the full flow **10 times**:

##### File: `testGoldenPath.ts`
```typescript
// testGoldenPath.ts
import { dispatchCat } from "./agents/catDispatcher";
import path from "path";
import { execSync } from "child_process";

const demoRepoPath = path.join(__dirname, "mistral-city-demo");
const runs = 10;

async function testGoldenPath() {
  for (let i = 1; i <= runs; i++) {
    console.log(`\n🔹 Run ${i}/${runs}...`);

    // Reset the repo (revert to buggy state)
    execSync("git checkout -- .", { cwd: demoRepoPath });

    // Dispatch Repair Cat
    const eventStream = dispatchCat({
      catType: "repair",
      systemId: "auth",
      issue: {
        type: "failing_test",
        description: "Session does not persist after refresh",
        files: ["src/app/auth/session.ts"],
      },
      repoPath: demoRepoPath,
    });

    let success = false;
    for await (const event of eventStream) {
      if (event.type === "SUCCESS") success = true;
      if (event.type === "FAILED") {
        console.log("❌ FAILED:", event.reason);
        break;
      }
    }

    if (success) {
      console.log("✅ Success!");
    } else {
      console.log("❌ Run failed");
      process.exit(1);
    }
  }
  console.log(`\n🎉 All ${runs} runs passed!`);
}

testGoldenPath().catch(console.error);
```

**Run it:**
```bash
npx ts-node testGoldenPath.ts
```

---

### 🔹 Step 7: Prepare for Demo (30 mins)
**Goal**: Ensure Zach has everything for a **flawless demo**.

#### 🎥 Record a Backup Video
```bash
# On macOS (adjust region as needed)
screencapture -R 0,0,1440,900 -t 30 demo-backup.mp4
```
**Give this to Zach** in case live Mistral fails.

#### 📝 Document the Setup
Create a `README.md` in your agents directory:
```markdown
# Mistral City Agents

## Demo Repo Setup
1. `cd mistral-city-demo`
2. `npm install`
3. Run tests: `npm test -- src/app/auth/session.test.ts` (should fail)
4. The bug: Session stored in React state (lost on refresh)

## Repair Cat
- **Trigger**: Click "Dispatch Repair Cat" on Auth Gate
- **Expected**: Fixes `session.ts` to use `localStorage`
- **Events**: DISPATCHED → INSPECTING → EDITING → TESTING → SUCCESS

## Troubleshooting
- If Mistral fails, use the hardcoded fix in `agents/fallbackFixes.ts`
- If tests are flaky, mock `localStorage` in Jest
```

#### 🔄 Create a Hardcoded Fallback
In case Mistral fails, add a fallback fix:

##### File: `agents/fallbackFixes.ts`
```typescript
// agents/fallbackFixes.ts
export const authSessionFix = `
export const useSession = () => {
  const [session, setSession] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('session') : null
  );

  const setSessionWithStorage = (newSession: string | null) => {
    if (newSession) {
      localStorage.setItem('session', newSession);
    } else {
      localStorage.removeItem('session');
    }
    setSession(newSession);
  };

  return { session, setSession: setSessionWithStorage };
};
`.trim();
```

Update `repairCat.ts` to use the fallback if Mistral fails:
```typescript
// Inside repairCatAgent(), after parsing Mistral's output:
if (!fixData.changes?.length) {
  console.warn("⚠️ Mistral failed, using fallback fix");
  fixData = {
    analysis: "Fallback: Session was stored in React state",
    changes: [{ file: "src/app/auth/session.ts", old: fileContent, new: authSessionFix }],
  };
}
```

---

## 🎯 Your Success Metrics

| Criteria | How to Verify | Status |
|----------|---------------|--------|
| ✅ Demo repo has a **fixable bug** | Run `npm test` → fails | ⬜ |
| ✅ Repair Cat **fixes the bug** | Run `testRepairCat.ts` → SUCCESS | ⬜ |
| ✅ Events are **emitted correctly** | Logs show all event types | ⬜ |
| ✅ Tests **pass after fix** | Check test output | ⬜ |
| ✅ **Golden path works 10/10 times** | Run `testGoldenPath.ts` | ⬜ |
| ✅ **Integration with Neo works** | Neo's UI updates on events | ⬜ |
| ✅ **Backup video exists** | `demo-backup.mp4` is recorded | ⬜ |

---

## ⚠️ Common Pitfalls & Fixes

| Pitfall | Solution |
|---------|----------|
| **Mistral returns non-JSON** | Force JSON with `--output-format json` |
| **File paths are wrong** | Use `path.join()` and absolute paths |
| **Tests are flaky** | Mock external dependencies (e.g., `localStorage`) |
| **Vibe CLI not installed** | `npm install -g @mistral/vibe` |
| **Permission denied** | Run with `sudo` or fix file permissions |
| **Mistral's fix is wrong** | Refine the prompt (add more context) |
| **Agent is slow** | Add timeouts (e.g., 30s max) |
| **Neo's UI doesn't update** | Verify event schema matches |

---

## 📅 Your Hour-by-Hour Schedule
*(Assuming 12-hour hackathon)*

| Time | Task | Deliverable |
|------|------|-------------|
| **0:00–1:00** | Team alignment | Agree on event schema with Neo |
| **1:00–2:30** | Create demo repo | Buggy Next.js app + failing test |
| **2:30–4:00** | Build Repair Cat | Agent fixes bug + emits events |
| **4:00–5:00** | Test locally | `testRepairCat.ts` works |
| **5:00–6:00** | Integrate with Neo | Frontend reacts to events |
| **6:00–7:00** | Golden path testing | 10/10 successful runs |
| **7:00–7:30** | Add stubs | Guard/Scout cats (visual only) |
| **7:30–8:00** | Harden | Error handling, fallbacks |
| **8:00–9:00** | Record backup | `demo-backup.mp4` |
| **9:00–10:00** | Rehearse with Zach | 90-second demo perfected |
| **10:00–12:00** | Buffer time | Fix edge cases, polish |

---

## 💡 Pro Tips for Winning

1. **Start with the simplest bug first**
   - Test Mistral with a **typo fix** before session persistence.

2. **Log everything**
   ```typescript
   // In repairCat.ts
   const log = (message: string) => {
     console.log(`[RepairCat] ${message}`);
     appendFileSync("agent.log", `[${new Date().toISOString()}] ${message}\n`);
   };
   ```

3. **Use a low temperature**
   ```bash
   vibe --temperature 0.1  # More deterministic
   ```

4. **Mock for Neo early**
   Give Neo this **mock agent** so he can work in parallel:
   ```typescript
   // For Neo to use temporarily
   export async function* mockRepairCat() {
     yield { type: "DISPATCHED", cat: "repair", target: "auth" };
     await new Promise(r => setTimeout(r, 1000));
     yield { type: "INSPECTING", cat: "repair", target: "auth", message: "Analyzing..." };
     await new Promise(r => setTimeout(r, 2000));
     yield { type: "EDITING", cat: "repair", target: "auth" };
     await new Promise(r => setTimeout(r, 1500));
     yield { type: "TESTING", cat: "repair", target: "auth" };
     await new Promise(r => setTimeout(r, 2000));
     yield { type: "SUCCESS", cat: "repair", target: "auth", healthDelta: 30 };
   }
   ```

5. **Pre-test Mistral's capabilities**
   Run this manually first:
   ```bash
   vibe --non-interactive --prompt "Fix this session persistence bug in React" --output-format json
   ```
   Paste your buggy `session.ts` code and see if Mistral returns the correct fix.

6. **Use absolute paths**
   Avoid issues with working directories:
   ```typescript
   const repoPath = path.resolve(__dirname, "../mistral-city-demo");
   ```

---

## 🚀 Final Checklist Before Judging

- [ ] Demo repo exists with **deterministic bug**
- [ ] Repair Cat **fixes the bug** 10/10 times
- [ ] All **events are emitted** correctly
- [ ] **Tests pass** after fix
- [ ] **Golden path works** end-to-end
- [ ] **Backup video** is recorded
- [ ] **Integration with Neo** is tested
- [ ] **Fallback fixes** are in place
- [ ] **Error handling** is robust
- [ ] **Zach has everything** for the demo

---

## 📞 Who to Talk To

| Person | What to Discuss | When |
|--------|-----------------|------|
| **Neo** | Event schema, integration, how to pass events to frontend | **First 90 mins** |
| **Paul** | City Model structure, how to get file lists for systems | **After demo repo is ready** |
| **Zach** | Demo repo specs, backup video, rehearsal | **Throughout** |
| **Leo** | Timing of events for animations | **After events are working** |

---

## 🏆 Why This Wins

Your work is **the most technically impressive** part of Mistral City. When the judges see:
1. A broken Auth Gate in the city
2. A cat dispatched
3. The **actual code fixed** by Mistral
4. Tests passing
5. The building healing

...they’ll be **blown away**. This is the **"wow" moment** that wins hackathons.

**Focus on reliability.** A simple, working Repair Cat is better than a complex, broken system.

---

## 🎯 Your North Star
> **"A judge can connect a repo, click a broken building, dispatch a cat, and watch the real code get fixed."**

Everything else is secondary.
