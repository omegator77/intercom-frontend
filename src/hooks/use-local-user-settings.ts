import { Dispatch, useEffect, useRef } from "react";
import { DevicesState } from "../global-state/types";
import { TGlobalStateAction } from "../global-state/global-state-actions";
import { useStorage } from "../components/accessing-local-storage/access-local-storage";

type TUseLocalUserSettings = {
  devices: DevicesState;
  dispatch: Dispatch<TGlobalStateAction>;
  // Logged in users always join under their account name (or alias),
  // overriding whatever guest name was previously stored locally.
  accountUsername?: string;
};

export const useLocalUserSettings = ({
  devices,
  dispatch,
  accountUsername,
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
    if (!audioSettingsLoaded.current) {
      if (!(devices.input || devices.output)) return;

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
    }

    dispatch({
      type: "UPDATE_USER_SETTINGS",
      payload: {
        username: accountUsername || readFromStorage("username") || "",
        ...loadedAudioSettings.current,
      },
    });
  }, [devices, dispatch, readFromStorage, removeFromStorage, accountUsername]);
};
