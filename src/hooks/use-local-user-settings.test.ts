import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLocalUserSettings } from "./use-local-user-settings.ts";
import { DevicesState } from "../global-state/types.ts";
import { TUserSettings } from "../components/user-settings/types.ts";

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
    renderHook(() =>
      useLocalUserSettings({ devices, dispatch, userSettings: null })
    );

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
        userSettings: null,
      })
    );

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ username: "Alice" }),
      })
    );
  });

  it("resolves the username even when devices never load (e.g. mic permission denied)", () => {
    const dispatch = vi.fn();
    const noDevices: DevicesState = { input: null, output: null };

    renderHook(() =>
      useLocalUserSettings({
        devices: noDevices,
        dispatch,
        accountUsername: "Alice",
        userSettings: null,
      })
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: "UPDATE_USER_SETTINGS",
      payload: { username: "Alice" },
    });
  });

  it("does not re-read audioinput/audiooutput from storage once already loaded, so a device saved in another window doesn't bleed in later", () => {
    mockReadFromStorage.mockImplementation((key: string) => {
      if (key === "username") return "guest-name";
      if (key === "audioinput") return "mic-1";
      return null;
    });

    const dispatch = vi.fn();
    const { rerender } = renderHook(
      ({ devices, userSettings }) =>
        useLocalUserSettings({ devices, dispatch, userSettings }),
      { initialProps: { devices, userSettings: null as TUserSettings | null } }
    );

    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ audioinput: "mic-1" }),
      })
    );

    // Simulate another browser window writing a different device to the
    // shared localStorage key, then this window's device list refreshing
    // for an unrelated reason (e.g. "Add Call", "reload devices"). Also
    // reflect what the previous dispatch actually produced, as the real
    // app's reducer would.
    mockReadFromStorage.mockImplementation((key: string) => {
      if (key === "username") return "guest-name";
      if (key === "audioinput") return "mic-2";
      return null;
    });
    rerender({
      devices: otherWindowDevices,
      userSettings: { username: "guest-name", audioinput: "mic-1" },
    });

    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "UPDATE_USER_SETTINGS",
        payload: expect.objectContaining({ audioinput: "mic-1" }),
      })
    );
  });

  it("does not overwrite a device the user has since manually saved when the effect re-runs for an unrelated reason", () => {
    // Reproduces the "flash then bounce back" bug: devices load, the
    // one-time restore dispatches with no stored device yet, the user then
    // manually saves a real device via the settings form (which updates
    // userSettings, exactly as the real app would), and only *afterward*
    // does accountUsername resolve (e.g. the account's alias finishes
    // loading, or an unrelated display-name update completes). That must
    // not replay the empty snapshot from the original restore.
    const dispatch = vi.fn();

    const { rerender } = renderHook(
      ({ userSettings, accountUsername }) =>
        useLocalUserSettings({ devices, dispatch, userSettings, accountUsername }),
      {
        initialProps: {
          userSettings: null as TUserSettings | null,
          accountUsername: undefined as string | undefined,
        },
      }
    );

    // Initial restore: nothing stored yet.
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "UPDATE_USER_SETTINGS",
      payload: { username: "guest-name", audioinput: undefined, audiooutput: undefined },
    });

    dispatch.mockClear();

    // The user picks a real device and saves it - reflect that in
    // userSettings, as the real app's reducer would after that dispatch.
    // accountUsername still hasn't resolved.
    rerender({
      userSettings: { username: "guest-name", audioinput: "mic-1" },
      accountUsername: undefined,
    });
    expect(dispatch).not.toHaveBeenCalled();

    // accountUsername resolves - the only thing that should change now.
    rerender({
      userSettings: { username: "guest-name", audioinput: "mic-1" },
      accountUsername: "Alice",
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "UPDATE_USER_SETTINGS",
      payload: {
        username: "Alice",
        audioinput: "mic-1",
        audiooutput: undefined,
      },
    });
  });
});
