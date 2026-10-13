/**
 * An inaudible "pilot tone" that is played while a call is connected (Android only).
 *
 * Android browsers freeze a backgrounded tab - screen locked, nothing audible playing - after a short
 * while: timers stop, heartbeats stop, the server drops the session and the call is gone on return.
 * A tab that plays audio is left alone, but a call with nobody talking plays nothing audible. This
 * keeps a very quiet low tone looping in an audio element. It has to stay above the level at which the
 * browser treats a page as playing audio (about -72 dBFS RMS) and below what a phone speaker turns
 * into sound or noise: at -44 dBFS the speaker membrane already moved and crackled, so the default is
 * -63 dBFS. Both values can be tuned from the address bar without a new build: ?pilot=<Hz>,<dBFS>
 * (e.g. ?pilot=30,-66), which is remembered for the browser session.
 *
 * Counted by the connected calls and stopped with the last one.
 */
import { isAndroid } from "../../bowser.ts";

const SAMPLE_RATE = 8000;
const SECONDS = 10; // long enough for the browser to treat it as real media, whole cycles = seamless loop

export type PilotSettings = { frequencyHz: number; dbfs: number };
export const DEFAULT_PILOT: PilotSettings = { frequencyHz: 25, dbfs: -63 };

/** "30,-66" -> 30 Hz at -66 dBFS peak. Anything missing or out of range falls back to the default. */
export const parsePilotSettings = (
  raw: string | null | undefined
): PilotSettings => {
  const [hz, dbfs] = (raw ?? "").split(",").map((v) => Number(v.trim()));
  if (
    Number.isFinite(hz) &&
    Number.isFinite(dbfs) &&
    hz >= 10 &&
    hz <= 200 &&
    dbfs >= -80 &&
    dbfs <= -30
  ) {
    // whole cycles in the loop keep it seamless: resolution 0.1 Hz
    return { frequencyHz: Math.round(hz * 10) / 10, dbfs };
  }
  return DEFAULT_PILOT;
};

const SETTINGS_KEY = "pilot";

// Read at load: the app may redirect and drop the query string before the first call is connected.
try {
  const fromUrl = new URLSearchParams(window.location.search).get(SETTINGS_KEY);
  if (fromUrl) window.sessionStorage.setItem(SETTINGS_KEY, fromUrl);
} catch {
  // storage unavailable: the default stays
}

/**
 * TEMPORARY test switch: ?pilot=off turns the pilot tone off for this browser session, to find out
 * whether it is needed at all. Remove together with the pilot if it is not.
 */
const pilotDisabled = (): boolean => {
  try {
    return window.sessionStorage.getItem(SETTINGS_KEY) === "off";
  } catch {
    return false;
  }
};

const currentSettings = (): PilotSettings => {
  try {
    return parsePilotSettings(window.sessionStorage.getItem(SETTINGS_KEY));
  } catch {
    return DEFAULT_PILOT;
  }
};

/** 16-bit mono PCM WAV of the looping tone. */
export const buildPilotWav = (
  settings: PilotSettings = DEFAULT_PILOT
): Uint8Array => {
  const amplitude = 10 ** (settings.dbfs / 20);
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
    const v = Math.sin((2 * Math.PI * settings.frequencyHz * i) / SAMPLE_RATE);
    view.setInt16(44 + i * 2, Math.round(v * amplitude * 32767), true);
  }
  return bytes;
};

const WATCHDOG_MS = 5000;

let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let watchdog: number | null = null;
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

// The tone is a technical keep-alive, not something to pause: if the media notification (or anything
// else) pauses it, the page would fall asleep again. Start it again right away.
const onPaused = () => {
  if (element && users > 0) play();
};

const MEDIA_ACTIONS: MediaSessionAction[] = ["pause", "stop"];

export const startPilotTone = (): (() => void) => {
  if (!isAndroid || pilotDisabled()) return () => undefined;

  users += 1;
  if (!element) {
    objectUrl = URL.createObjectURL(
      new Blob([buildPilotWav(currentSettings()).buffer as ArrayBuffer], {
        type: "audio/wav",
      })
    );
    element = new Audio(objectUrl);
    element.loop = true;
    document.addEventListener("visibilitychange", resumeIfPaused);
    element.addEventListener("pause", onPaused);
    watchdog = window.setInterval(() => {
      if (element?.paused) play();
    }, WATCHDOG_MS);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Intercom - Leitung verbunden",
        artist: "Bitte nicht schließen",
      });
      MEDIA_ACTIONS.forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, play);
        } catch {
          // this browser does not know the action
        }
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
      element.removeEventListener("pause", onPaused);
      if (watchdog !== null) window.clearInterval(watchdog);
      watchdog = null;
      if ("mediaSession" in navigator) {
        MEDIA_ACTIONS.forEach((action) => {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch {
            // nothing to undo
          }
        });
      }
      element.pause();
      element = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };
};
