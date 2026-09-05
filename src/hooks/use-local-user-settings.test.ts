import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLocalUserSettings } from "./use-local-user-settings.ts";
import { DevicesState } from "../global-state/types.ts";

const otherWindowDevices: DevicesState = {
  input: [{ deviceId: "mic-2", label: "Mic 2" } as MediaDeviceInfo],
  output: null,
};

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

  it("does not re-read audioinput/audiooutput from storage once already loaded, so a device saved in another window doesn't bleed in later", () => {
    mockReadFromStorage.mockImplementation((key: string) => {
      if (key === "username") return "guest-name";
      if (key === "audioinput") return "mic-1";
      return null;
    });

    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ devices }) => useLocalUserSettings({ devices, dispatch }),
      { initialProps: { devices } }
    );

    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ audioinput: "mic-1" }),
      })
    );

    // Simulate another browser window writing a different device to the
    // shared localStorage key, then this window's device list refreshing
    // for an unrelated reason (e.g. "Add Call", "reload devices").
    mockReadFromStorage.mockImplementation((key: string) => {
      if (key === "username") return "guest-name";
      if (key === "audioinput") return "mic-2";
      return null;
    });
    rerender({ devices: otherWindowDevices });

    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ audioinput: "mic-1" }),
      })
    );
  });
});
