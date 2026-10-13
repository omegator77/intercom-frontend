import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  MAX_RECONNECTS,
  RECONNECT_DELAY_MS,
  useAutoReconnect,
} from "./use-auto-reconnect.ts";

type State = RTCPeerConnectionState | null;

describe("useAutoReconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (initial: State) => {
    const onReconnect = vi.fn();
    const hook = renderHook(
      ({ state }: { state: State }) =>
        useAutoReconnect({ connectionState: state, onReconnect }),
      { initialProps: { state: initial } }
    );
    return { onReconnect, ...hook };
  };

  it("does nothing while the connection is healthy or still being set up", () => {
    const { onReconnect, rerender } = setup(null);
    rerender({ state: "connecting" });
    rerender({ state: "connected" });
    rerender({ state: "disconnected" }); // may recover on its own
    vi.advanceTimersByTime(60_000);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it("reconnects once after a delay when the connection failed", () => {
    const { onReconnect, rerender } = setup("connected");
    rerender({ state: "failed" });
    vi.advanceTimersByTime(RECONNECT_DELAY_MS - 1);
    expect(onReconnect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending attempt when the connection recovers by itself", () => {
    const { onReconnect, rerender } = setup("connected");
    rerender({ state: "failed" });
    rerender({ state: "connected" });
    vi.advanceTimersByTime(60_000);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it("waits longer before every further attempt and gives up after the limit", () => {
    const { onReconnect, result, rerender } = setup("connected");
    for (let i = 1; i <= MAX_RECONNECTS; i += 1) {
      rerender({ state: "failed" });
      vi.advanceTimersByTime(RECONNECT_DELAY_MS * i - 1);
      expect(onReconnect).toHaveBeenCalledTimes(i - 1);
      vi.advanceTimersByTime(1);
      expect(onReconnect).toHaveBeenCalledTimes(i);
      rerender({ state: null }); // the rebuilt call starts over and fails again
    }
    expect(result.current.gaveUp).toBe(false);
    rerender({ state: "failed" });
    vi.advanceTimersByTime(600_000);
    expect(onReconnect).toHaveBeenCalledTimes(MAX_RECONNECTS);
    expect(result.current.gaveUp).toBe(true);
  });

  it("starts counting again once a connection was established", () => {
    const { onReconnect, result, rerender } = setup("connected");
    for (let i = 1; i <= MAX_RECONNECTS; i += 1) {
      rerender({ state: "failed" });
      act(() => {
        vi.advanceTimersByTime(RECONNECT_DELAY_MS * i);
      });
      rerender({ state: null });
    }
    rerender({ state: "failed" });
    expect(result.current.gaveUp).toBe(true);

    rerender({ state: "connected" });
    expect(result.current.gaveUp).toBe(false);
    rerender({ state: "failed" });
    onReconnect.mockClear();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
