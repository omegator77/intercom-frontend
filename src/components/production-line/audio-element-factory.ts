/**
 * Pure factory function to create an HTMLAudioElement from a media stream.
 * Extracted from use-rtc-connection.ts lines 70-106 (onRtcTrack handler).
 */

import { isBrowserSafari, isIpad, isMobile } from "../../bowser.ts";

export type AudioElementOptions = {
  stream: MediaStream;
  lineId: string;
  audiooutput: string | undefined;
  onError: (error: Error) => void;
  onSinkError: (error: Error) => void;
};

const MAX_RECOVERIES = 5;
const RECOVERY_DELAY_MS = 500;

export const createAudioElement = ({
  stream,
  lineId,
  audiooutput,
  onError,
  onSinkError,
}: AudioElementOptions): HTMLAudioElement => {
  const audioElement = new Audio();

  audioElement.id = `rtc-audio-${lineId}-${Date.now()}`;
  audioElement.controls = false;
  audioElement.autoplay = true;
  // A media error (e.g. code 3 on Chrome for Android after an audio focus or route change) leaves the
  // element dead for good: the call looks fine but nothing is played. Report it as before, then try to
  // bring the same stream back. The counter resets as soon as playback runs again.
  let recoveries = 0;
  audioElement.onerror = () => {
    onError(
      new Error(
        `Audio Error: ${audioElement.error?.code} - ${audioElement.error?.message}`
      )
    );
    if (recoveries >= MAX_RECOVERIES) return;
    recoveries += 1;
    window.setTimeout(() => {
      if (!audioElement.srcObject) return; // torn down in the meantime
      audioElement.srcObject = null;
      audioElement.srcObject = stream;
      audioElement.play().catch(() => undefined);
    }, RECOVERY_DELAY_MS * recoveries);
  };
  audioElement.addEventListener("playing", () => {
    recoveries = 0;
  });

  // Mobile browsers pause media when the screen is locked or the tab is hidden. Resume when it is shown
  // again, as long as the element has not been torn down.
  const resumeWhenVisible = () => {
    if (!audioElement.srcObject) {
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      return;
    }
    if (document.visibilityState === "visible" && audioElement.paused) {
      audioElement.play().catch(() => undefined);
    }
  };
  document.addEventListener("visibilitychange", resumeWhenVisible);

  audioElement.srcObject = stream;

  if (audiooutput && (!isBrowserSafari || !isMobile || !isIpad)) {
    audioElement.setSinkId(audiooutput).catch((e) => {
      onSinkError(
        e instanceof Error ? e : new Error("Error assigning audio sink.")
      );
    });
  }

  return audioElement;
};
