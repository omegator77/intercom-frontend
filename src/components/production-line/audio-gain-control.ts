/**
 * Volume and mute for remote audio on Android.
 *
 * Chrome on Android ignores `volume` and `muted` of an <audio> element that plays a remote WebRTC
 * stream, so the volume slider and the speaker mute button had no effect there. Here the element
 * stays silent (it only has to keep the stream flowing - Chrome feeds Web Audio from a remote stream
 * only while an element plays it) and the sound goes through a GainNode instead. `volume` and `muted`
 * are redefined on the element itself, so every existing caller keeps working unchanged.
 */

type Control = { ctx: AudioContext; gain: GainNode; resume: () => void };

const controls = new WeakMap<HTMLAudioElement, Control>();

export const attachGainControl = (
  element: HTMLAudioElement,
  stream: MediaStream
): boolean => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return false;

    const ctx = new AudioContextClass();
    const gain = ctx.createGain();
    ctx.createMediaStreamSource(stream).connect(gain);
    gain.connect(ctx.destination);

    // Silence the element natively, before the properties are redefined below.
    Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "muted"
    )?.set?.call(element, true);

    let volume = 1;
    let muted = false;
    const apply = () => {
      gain.gain.value = muted ? 0 : volume;
    };
    Object.defineProperty(element, "volume", {
      configurable: true,
      get: () => volume,
      set: (value: number) => {
        volume = Math.min(1, Math.max(0, Number(value)));
        apply();
      },
    });
    Object.defineProperty(element, "muted", {
      configurable: true,
      get: () => muted,
      set: (value: boolean) => {
        muted = !!value;
        apply();
      },
    });

    // An AudioContext may start suspended until the page has been touched.
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    };
    resume();
    document.addEventListener("pointerdown", resume, { passive: true });
    controls.set(element, { ctx, gain, resume });
    return true;
  } catch {
    return false; // anything unexpected: keep the plain element behaviour
  }
};

export const getGainControl = (element: HTMLAudioElement) =>
  controls.get(element);

export const releaseGainControl = (element: HTMLAudioElement): void => {
  const control = controls.get(element);
  if (!control) return;
  controls.delete(element);
  document.removeEventListener("pointerdown", control.resume);
  control.ctx.close().catch(() => undefined);
};
