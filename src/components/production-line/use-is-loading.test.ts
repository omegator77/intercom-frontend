import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsLoading } from "./use-is-loading.ts";

describe("useIsLoading", () => {
  const setup = (initial: string | null) =>
    renderHook(({ state }) => useIsLoading({ connectionState: state }), {
      initialProps: { state: initial },
    });

  it("is loading until the connection is up", () => {
    const { result, rerender } = setup(null);
    expect(result.current).toEqual({ loading: true, connectionError: false });
    rerender({ state: "connecting" });
    expect(result.current.loading).toBe(true);
    rerender({ state: "connected" });
    expect(result.current).toEqual({ loading: false, connectionError: false });
  });

  it("flags a failed connection", () => {
    const { result, rerender } = setup("connected");
    rerender({ state: "failed" });
    expect(result.current.connectionError).toBe(true);
  });

  it("starts over when the call is rebuilt and clears the error once connected", () => {
    const { result, rerender } = setup("connected");
    rerender({ state: "failed" });
    rerender({ state: null }); // reconnect resets the state
    expect(result.current).toEqual({ loading: true, connectionError: false });
    rerender({ state: "connected" });
    expect(result.current).toEqual({ loading: false, connectionError: false });
  });
});
