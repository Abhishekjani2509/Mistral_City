/**
 * Session management - BUGGY VERSION
 * 
 * The bug: Session is stored in React component state, which is lost on page refresh.
 * This is the deterministic bug that Repair Cat should fix.
 */

"use client";

import { useState } from "react";

/**
 * ❌ BUG: Session stored in component state (lost on refresh)
 * Repair Cat should fix this to use localStorage
 */
export const useSession = () => {
  const [session, setSession] = useState<string | null>(null);
  return { session, setSession };
};

// Helper for tests
export const getSession = (): string | null => {
  // In the buggy version, we can't restore session after refresh
  // This will always return null on page reload
  if (typeof window !== "undefined") {
    // Try to read from a non-existent location
    return null;
  }
  return null;
};
