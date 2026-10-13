/**
 * Volume and mute for remote audio on Android.
 *
 * Chrome on Android plays a remote WebRTC stream on its own audio path and ignores `volume` and `muted`
 * of the <audio> element, and the hardware volume keys do not reach it either, so the volume slider
 * and the speaker mute button did nothing there. Here the sound is routed through a Web Audio GainNode
 * instead, and the element only gets a silent (disabled) copy of the stream: Chrome feeds Web Audio from
 * a remote stream only while an element plays one, but it must not play the real sound a second time
 * on the path that cannot be controlled.
 *
 * `volume` and `muted` are redefined on the element itself, so every existing caller keeps working.
 */

/** How often the app set volume / muted on the element (diagnostics: does the app reach THIS element?). */
export type SetterStats = {
  volumeSets: number;
  mutedSets: number;
  lastVolume: number | null;
  lastMuted: boolean | null;
};

type Control = {
  ctx: AudioContext;
  gain: GainNode;
  silent: MediaStream;
  resume: () => void;
  stats: SetterStats;
};

const controls = new WeakMap<HTMLAudioElement, Control>();

/** Returns the silent stream the element must play, or null when Web Audio could not be set up. */
export const attachGainControl = (
  element: HTMLAudioElement,
  stream: MediaStream
): MediaStream | null => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return null;

    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    ctx.createMediaStreamSource(stream).connect(gain);
    gain.connect(ctx.destination);

    const silent = stream.clone();
    silent.getAudioTracks().forEach((track) => {
      // eslint-disable-next-line no-param-reassign
      track.enabled = false;
    });
    // eslint-disable-next-line no-param-reassign
    element.srcObject = silent;

    // Silence the element natively, before the properties are redefined below.
    Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "muted"
    )?.set?.call(element, true);

    let volume = 1;
    let muted = false;
    const stats: SetterStats = {
      volumeSets: 0,
      mutedSets: 0,
      lastVolume: null,
      lastMuted: null,
    };
    const apply = () => {
      gain.gain.value = muted ? 0 : volume;
    };
    Object.defineProperty(element, "volume", {
      configurable: true,
      get: () => volume,
      set: (value: number) => {
        volume = Math.min(1, Math.max(0, Number(value)));
        stats.volumeSets += 1;
        stats.lastVolume = volume;
        apply();
      },
    });
    Object.defineProperty(element, "muted", {
      configurable: true,
      get: () => muted,
      set: (value: boolean) => {
        muted = !!value;
        stats.mutedSets += 1;
        stats.lastMuted = muted;
        apply();
      },
    });

    // An AudioContext may start suspended until the page has been touched.
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    };
    resume();
    document.addEventListener("pointerdown", resume, { passive: true });
    controls.set(element, { ctx, gain, silent, resume, stats });
    return silent;
  } catch {
    return null; // anything unexpected: keep the plain element behaviour
  }
};

export const getGainControl = (element: HTMLAudioElement) =>
  controls.get(element);

export const releaseGainControl = (element: HTMLAudioElement): void => {
  const control = controls.get(element);
  if (!control) return;
  controls.delete(element);
  document.removeEventListener("pointerdown", control.resume);
  control.silent.getTracks().forEach((track) => track.stop());
  control.ctx.close().catch(() => undefined);
};
