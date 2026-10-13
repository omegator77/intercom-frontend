/**
 * Keeps one live (not muted) microphone capture open for the page while calls are active.
 *
 * Android browsers (Chrome and Firefox) freeze or discard a backgrounded tab (screen locked, nothing
 * audible playing) after a few minutes: heartbeats stop, the session expires and the call is gone on
 * return. Until September the app kept a stray live capture open by accident: the first, generic
 * getUserMedia stream (opened to reset the permission) was never stopped, and calls survived a locked
 * screen. That leak was fixed because several calls each kept their own extra stream and blocked each
 * other's device.
 *
 * This keeps the useful part with exactly ONE shared stream per page, in the same order as before: the
 * generic stream a call opens first is handed over here instead of being stopped. It is counted by the
 * calls that need it and stopped with the last one. It is never sent anywhere. Only Android uses it.
 */
import { isAndroid } from "../../bowser.ts";

let stream: MediaStream | null = null;
let users = 0;

const stopTracks = (s: MediaStream) => s.getTracks().forEach((t) => t.stop());

/**
 * Takes over `candidate` (the generic stream a call just opened) as the shared keep-alive capture, or
 * stops it when one is already held or this is not Android. Returns the function that ends this call's
 * hold; releasing twice is harmless.
 */
export const adoptKeepAliveCapture = (candidate: MediaStream): (() => void) => {
  if (!isAndroid) {
    stopTracks(candidate);
    return () => undefined;
  }

  users += 1;
  if (stream) {
    stopTracks(candidate); // the page already holds one
  } else {
    stream = candidate;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0 && stream) {
      stopTracks(stream);
      stream = null;
    }
  };
};
