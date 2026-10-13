/**
 * An inaudible "pilot tone" that is played while a call is connected (Android only).
 *
 * Android browsers freeze a backgrounded tab - screen locked, nothing audible playing - after a short
 * while: timers stop, heartbeats stop, the server drops the session and the call is gone on return.
 * A tab that plays audio is left alone, but a call with nobody talking plays nothing audible. This
 * keeps a very quiet 25 Hz tone looping in an audio element: far below what a phone speaker can
 * reproduce and ~-48 dBFS, yet above the level at which the browser treats a page as playing audio.
 *
 * Counted by the connected calls and stopped with the last one.
 */
import { isAndroid } from "../../bowser.ts";

const SAMPLE_RATE = 8000;
const SECONDS = 10; // long enough for the browser to treat it as real media, whole cycles = seamless loop
const FREQUENCY_HZ = 25;
const AMPLITUDE = 0.006; // peak, about -44 dBFS

/** 16-bit mono PCM WAV of the looping tone. */
export const buildPilotWav = (): Uint8Array => {
  const samples = SAMPLE_RATE * SECONDS;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const v = Math.sin((2 * Math.PI * FREQUENCY_HZ * i) / SAMPLE_RATE);
    view.setInt16(44 + i * 2, Math.round(v * AMPLITUDE * 32767), true);
  }
  return bytes;
};

let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let users = 0;

const play = () => {
  element?.play().catch(() => {
    // Not allowed yet (no user activation): try again on the next touch
    document.addEventListener("pointerdown", play, { once: true });
  });
};

const resumeIfPaused = () => {
  if (element && element.paused && document.visibilityState === "visible") {
    play();
  }
};

export const startPilotTone = (): (() => void) => {
  if (!isAndroid) return () => undefined;

  users += 1;
  if (!element) {
    objectUrl = URL.createObjectURL(
      new Blob([buildPilotWav().buffer as ArrayBuffer], { type: "audio/wav" })
    );
    element = new Audio(objectUrl);
    element.loop = true;
    document.addEventListener("visibilitychange", resumeIfPaused);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Intercom - Leitung verbunden",
      });
    }
    play();
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    users -= 1;
    if (users === 0 && element) {
      document.removeEventListener("visibilitychange", resumeIfPaused);
      document.removeEventListener("pointerdown", play);
      element.pause();
      element = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };
};
