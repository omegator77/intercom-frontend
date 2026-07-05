import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLocalUserSettings } from "./use-local-user-settings.ts";
import { DevicesState } from "../global-state/types.ts";

const mockReadFromStorage = vi.fn();
const mockRemoveFromStorage = vi.fn();

vi.mock(
  "../components/accessing-local-storage/access-local-storage.ts",
  () => ({
    useStorage: () => ({
      readFromStorage: mockReadFromStorage,
      removeFromStorage: mockRemoveFromStorage,
    }),
  })
);

const devices: DevicesState = {
  input: [{ deviceId: "mic-1", label: "Mic 1" } as MediaDeviceInfo],
  output: null,
};

describe("useLocalUserSettings", () => {
  beforeEach(() => {
    mockReadFromStorage.mockReset();
    mockRemoveFromStorage.mockReset();
    mockReadFromStorage.mockImplementation((key: string) =>
      key === "username" ? "guest-name" : null
    );
  });

  it("uses the stored guest name when there is no account username", () => {
    const dispatch = vi.fn();
    renderHook(() => useLocalUserSettings({ devices, dispatch }));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ username: "guest-name" }),
      })
    );
  });

  it("prefers the account username/alias over the stored guest name", () => {
    const dispatch = vi.fn();
    renderHook(() =>
      useLocalUserSettings({
        devices,
        dispatch,
        accountUsername: "Alice",
      })
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ username: "Alice" }),
      })
    );
  });
});
