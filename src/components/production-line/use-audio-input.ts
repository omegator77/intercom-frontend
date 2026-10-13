import { Dispatch, useCallback, useEffect, useState } from "react";
import { noop } from "../../helpers";
import { TJoinProductionOptions } from "./types.ts";
import { TGlobalStateAction } from "../../global-state/global-state-actions.ts";
import { adoptKeepAliveCapture } from "./keep-alive-capture.ts";

type TGetMediaDevicesOptions = {
  audioInputId: TJoinProductionOptions["audioinput"] | null;
  dispatch: Dispatch<TGlobalStateAction>;
};

export type TUseAudioInputValues = MediaStream | "no-device" | null;

type TUseAudioInput = (
  options: TGetMediaDevicesOptions
) => [TUseAudioInputValues, boolean, () => void];

// A hook for fetching the user selected audio input as a MediaStream
export const useAudioInput: TUseAudioInput = ({ audioInputId, dispatch }) => {
  const [audioInput, setAudioInput] = useState<TUseAudioInputValues>(null);
  const [audioInputError, setAudioInputError] = useState<boolean>(false);

  useEffect(() => {
    let aborted = false;
    // Tracks the stream actually handed to this effect instance, so the
    // cleanup below can release it even though `audioInput` state isn't a
    // dependency here (adding it would re-run this whole effect on every
    // stream change).
    let activeStream: MediaStream | null = null;
    // Android browsers freeze a backgrounded tab without a live capture, see keep-alive-capture.ts
    let releaseKeepAlive: () => void = noop;

    if (!audioInputId) return noop;

    if (audioInputId === "no-device") return setAudioInput("no-device");

    // First request a generic audio stream to "reset" permissions
    navigator.mediaDevices.getUserMedia({ audio: true }).then((resetStream) => {
      // It was only needed to trigger the permission reset, so it is stopped here -
      // except on Android, where ONE shared copy is kept for the whole page (see
      // keep-alive-capture.ts). Leaving one per call open blocked the other calls'
      // devices, which is why this used to be stopped always.
      if (aborted) {
        resetStream.getTracks().forEach((t) => t.stop());
      } else {
        releaseKeepAlive = adoptKeepAliveCapture(resetStream);
      }

      // Then request the specific audio input the user has selected
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            deviceId: {
              exact: audioInputId,
            },
            noiseSuppression: true,
          },
        })
        .then((stream) => {
          if (aborted) {
            // The hook was torn down (unmount, or audioInputId/dispatch
            // changed) while this request was in flight - release the
            // device instead of leaving it held with nothing referencing it.
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          activeStream = stream;

          // Default to muted input
          stream.getTracks().forEach((t) => {
            // eslint-disable-next-line no-param-reassign
            t.enabled = false;
          });

          setAudioInput(stream);
        })
        .catch(() => {
          setAudioInputError(true);
          dispatch({
            type: "ERROR",
            payload: {
              error: new Error("Selected devices are not available"),
            },
          });
        });
    });

    return () => {
      aborted = true;
      releaseKeepAlive();
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [audioInputId, dispatch]);

  // Reset function to set audioInput to null
  const reset = useCallback(() => {
    if (audioInput && audioInput !== "no-device") {
      audioInput.getTracks().forEach((t) => t.stop());
    }
    setAudioInput(null);
  }, [audioInput]);

  return [audioInput, audioInputError, reset];
};
