import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, fireEvent, act } from "@testing-library/react";
import { createElement, useState, type ReactNode } from "react";
import { useFetchProduction } from "./use-fetch-production.ts";
import { GlobalStateContext } from "../../global-state/context-provider.tsx";
import { TGlobalState } from "../../global-state/types.ts";
import { TGlobalStateAction } from "../../global-state/global-state-actions.ts";
import { API, TBasicProductionResponse } from "../../api/api.ts";

vi.mock("../../api/api.ts", () => ({
  API: {
    fetchProduction: vi.fn(),
  },
}));

const mockFetchProduction = API.fetchProduction as ReturnType<typeof vi.fn>;

const mockDispatch = vi.fn();

const baseState: TGlobalState = {
  calls: {},
  error: {},
  reloadProductionList: false,
  production: null,
  selectedProductionId: null,
  devices: { input: null, output: null },
  userSettings: null,
  apiError: false,
  websocket: null,
};

const wrapperWithState = (state: TGlobalState) =>
  ({ children }: { children: ReactNode }) =>
    createElement(
      GlobalStateContext.Provider,
      { value: [state, mockDispatch] },
      children
    );

const production: TBasicProductionResponse = {
  name: "Test Production",
  productionId: "1",
  lines: [],
};

// Harness that owns real state so PRODUCTION_UPDATED-style reloads can be
// simulated (in the real app the global reducer flips reloadProductionList,
// and PRODUCTION_LIST_FETCHED flips it back — RTL's renderHook can't rerender
// a wrapper with new props, so this harness stands in for the reducer).
const latest: { current: ReturnType<typeof useFetchProduction> | null } = {
  current: null,
};

const Probe = ({ id }: { id: number }) => {
  latest.current = useFetchProduction(id);
  return null;
};

const Harness = ({ id }: { id: number }) => {
  const [state, setState] = useState<TGlobalState>(baseState);

  const dispatch = (action: TGlobalStateAction) => {
    mockDispatch(action);
    if (action.type === "PRODUCTION_LIST_FETCHED") {
      setState((s) => ({ ...s, reloadProductionList: false }));
    }
  };

  return createElement(
    GlobalStateContext.Provider,
    { value: [state, dispatch] },
    createElement(Probe, { id }),
    createElement(
      "button",
      {
        "data-testid": "trigger-reload",
        onClick: () => setState((s) => ({ ...s, reloadProductionList: true })),
      },
      "reload"
    )
  );
};

describe("useFetchProduction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latest.current = null;
  });

  it("fetches the production when an id is given", async () => {
    mockFetchProduction.mockResolvedValue(production);

    const { result } = renderHook(() => useFetchProduction(1), {
      wrapper: wrapperWithState(baseState),
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchProduction).toHaveBeenCalledWith(1);
    expect(result.current.production).toEqual(production);
  });

  it("does not fetch when id is null", () => {
    renderHook(() => useFetchProduction(null), {
      wrapper: wrapperWithState(baseState),
    });

    expect(mockFetchProduction).not.toHaveBeenCalled();
  });

  it("refetches when reloadProductionList flips to true, without clearing the current production first", async () => {
    mockFetchProduction.mockResolvedValue(production);

    const { getByTestId } = render(createElement(Harness, { id: 1 }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchProduction).toHaveBeenCalledTimes(1);
    expect(latest.current?.production).toEqual(production);

    // Simulate a line being added elsewhere (dispatches PRODUCTION_UPDATED,
    // which sets reloadProductionList: true in global state).
    const updated: TBasicProductionResponse = {
      ...production,
      lines: [
        {
          name: "Line 1",
          id: "l1",
          smbConferenceId: "smb1",
          participants: [],
        },
      ],
    };
    mockFetchProduction.mockResolvedValue(updated);

    fireEvent.click(getByTestId("trigger-reload"));

    // Production must not be nulled out while the refetch is in flight —
    // that would flash a loading state for consumers like the Manage modal.
    expect(latest.current?.production).toEqual(production);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetchProduction).toHaveBeenCalledTimes(2);
    expect(latest.current?.production).toEqual(updated);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "PRODUCTION_LIST_FETCHED",
    });
  });
});
