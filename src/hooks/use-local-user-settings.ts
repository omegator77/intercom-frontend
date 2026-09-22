import { Dispatch, useEffect, useRef } from "react";
import { DevicesState } from "../global-state/types";
import { TGlobalStateAction } from "../global-state/global-state-actions";
import { useStorage } from "../components/accessing-local-storage/access-local-storage";
import { TUserSettings } from "../components/user-settings/types";

type TUseLocalUserSettings = {
  devices: DevicesState;
  dispatch: Dispatch<TGlobalStateAction>;
  // Logged in users always join under their account name (or alias),
  // overriding whatever guest name was previously stored locally.
  accountUsername?: string;
  // Current settings, read back so a later run of this effect (e.g. once
  // accountUsername resolves) can preserve a device the user has since
  // chosen and saved via the settings form, instead of overwriting it.
  userSettings: TUserSettings | null;
};

export const useLocalUserSettings = ({
  devices,
  dispatch,
  accountUsername,
  userSettings,
}: TUseLocalUserSettings) => {
  const { readFromStorage, removeFromStorage } = useStorage();

  // localStorage's audioinput/audiooutput keys are a single global "last
  // used device" value shared across every window/tab of this origin. This
  // effect used to re-read them and re-dispatch UPDATE_USER_SETTINGS on
  // every `devices` change (e.g. joining another call, hitting "reload
  // devices") - which, since UPDATE_USER_SETTINGS fans out to every active
  // call in this window (see use-update-call-device.tsx), meant a device
  // change saved in one browser window would silently bleed into whatever
  // other window happened to next refresh its device list. Loading the
  // stored devices only once per window keeps the "restore last used
  // device" convenience without turning localStorage into a live
  // cross-window sync channel.
  const audioSettingsLoaded = useRef(false);
  const loadedAudioSettings = useRef<{
    audioinput?: string;
    audiooutput?: string;
  }>({});

  useEffect(() => {
    const username = accountUsername || readFromStorage("username") || "";

    if (!audioSettingsLoaded.current) {
      if (!(devices.input || devices.output)) {
        // Devices haven't loaded yet - most commonly because mic permission
        // hasn't been granted (or was denied/dismissed) yet. That must not
        // block the username from resolving too: a logged-in user has no
        // way to enter it manually (the field is hidden), so leaving this
        // dispatch unreached left them stuck on the device-selection screen
        // forever with no way out, even after answering the permission
        // prompt via the device settings form's own "no device" fallback.
        if (username !== userSettings?.username) {
          dispatch({ type: "UPDATE_USER_SETTINGS", payload: { username } });
        }
        return;
      }

      audioSettingsLoaded.current = true;

      const storedAudioInput = readFromStorage("audioinput");
      const storedAudioOutput = readFromStorage("audiooutput");

      const foundInputDevice =
        devices.input?.find((device) => device.deviceId === storedAudioInput)
          ?.deviceId ??
        (storedAudioInput === "no-device" ? "no-device" : undefined);

      const foundOutputDevice = devices.output?.find(
        (device) => device.deviceId === storedAudioOutput
      )?.deviceId;

      if (!foundInputDevice) removeFromStorage("audioinput");

      if (!foundOutputDevice) removeFromStorage("audiooutput");

      loadedAudioSettings.current = {
        audioinput: foundInputDevice,
        audiooutput: foundOutputDevice,
      };

      dispatch({
        type: "UPDATE_USER_SETTINGS",
        payload: {
          username,
          ...loadedAudioSettings.current,
        },
      });
      return;
    }

    // The one-time restore above already ran. From here on, only react to
    // the username actually changing (e.g. once accountUsername resolves,
    // or a later alias update) - and when it does, carry over whatever
    // device is *currently* saved rather than replaying the
    // loadedAudioSettings snapshot frozen at the original restore. That
    // snapshot is stale the moment the user manually picks and saves a
    // different device via the settings form; blindly re-dispatching it
    // silently wiped out their choice and bounced them back to the
    // device-selection screen right after it briefly succeeded.
    if (username !== userSettings?.username) {
      dispatch({
        type: "UPDATE_USER_SETTINGS",
        payload: {
          username,
          audioinput: userSettings?.audioinput,
          audiooutput: userSettings?.audiooutput,
        },
      });
    }
  }, [
    devices,
    dispatch,
    readFromStorage,
    removeFromStorage,
    accountUsername,
    userSettings,
  ]);
};
