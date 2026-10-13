import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLinePolling } from "./use-line-polling.ts";
import { API } from "../../api/api.ts";

const dispatch = vi.fn();
vi.mock("../../global-state/context-provider.tsx", () => ({
  useGlobalState: () => [{}, dispatch],
}));
vi.mock("../../api/api.ts", () => ({
  API: { fetchProductionLine: vi.fn() },
}));

const fetchLine = API.fetchProductionLine as ReturnType<typeof vi.fn>;
const options = {
  callId: "call-1",
  joinProductionOptions: {
    productionId: "4",
    lineId: "1",
    username: "u",
    lineUsedForProgramOutput: false,
    isProgramUser: false,
  },
};

const tick = async (seconds: number) => {
  for (let i = 0; i < seconds; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await vi.advanceTimersByTimeAsync(1000);
  }
};

describe("useLinePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dispatch.mockReset();
    fetchLine.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an error after five failed requests in a row", async () => {
    fetchLine.mockRejectedValue(new Error("Failed to fetch"));
    renderHook(() => useLinePolling(options));
    await tick(4);
    expect(dispatch).not.toHaveBeenCalled();
    await tick(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload.error).toBeInstanceOf(Error);
  });

  it("takes the error away again as soon as a request works", async () => {
    fetchLine.mockRejectedValue(new Error("Failed to fetch"));
    renderHook(() => useLinePolling(options));
    await tick(5);
    expect(dispatch).toHaveBeenCalledTimes(1);

    fetchLine.mockResolvedValue({ id: "1", name: "Ton", participants: [] });
    await tick(1);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "ERROR",
      payload: { callId: "call-1", error: null },
    });
  });

  it("does not touch the error state when nothing ever failed", async () => {
    fetchLine.mockResolvedValue({ id: "1", name: "Ton", participants: [] });
    renderHook(() => useLinePolling(options));
    await tick(6);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
