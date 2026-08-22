/**
 * Test for session persistence bug
 * 
 * This test FAILS in the buggy version (session stored in component state)
 * This test PASSES after Repair Cat fixes it (session stored in localStorage)
 */

import { renderHook, act } from "@testing-library/react";
import { useSession, getSession } from "./session";

describe("Session Persistence", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("session persists after refresh", () => {
    // Simulate initial login
    const { result, unmount } = renderHook(() => useSession());
    
    // Login
    act(() => {
      result.current.setSession("user123");
    });
    
    // Verify session is set
    expect(result.current.session).toBe("user123");
    
    // Simulate page refresh: unmount and remount the hook
    unmount();
    
    // After refresh, session should still be available
    const { result: newResult } = renderHook(() => useSession());
    
    // ❌ FAILS in buggy version (session in component state)
    // ✅ PASSES after fix (session in localStorage)
    expect(newResult.current.session).toBe("user123");
  });

  test("getSession returns the current session", () => {
    // Login first
    const { result, unmount } = renderHook(() => useSession());
    act(() => {
      result.current.setSession("user456");
    });
    
    // getSession should return the session
    // Note: In buggy version, getSession always returns null
    // After fix, it should read from localStorage
    expect(getSession()).toBe("user456");
    
    unmount();
  });
});
