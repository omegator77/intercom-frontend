import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPilotWav, startPilotTone } from "./pilot-tone.ts";

const flags = vi.hoisted(() => ({ android: true }));
vi.mock("../../bowser.ts", () => ({
  get isAndroid() {
    return flags.android;
  },
}));

describe("buildPilotWav", () => {
  const wav = buildPilotWav();
  const view = new DataView(wav.buffer);

  it("is a valid 16-bit mono PCM WAV of ten seconds", () => {
    const text = (o: number, n: number) =>
      String.fromCharCode(...wav.slice(o, o + n));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    const rate = view.getUint32(24, true);
    expect(view.getUint32(40, true) / 2 / rate).toBe(10);
  });

  it("is very quiet but not digital silence", () => {
    let peak = 0;
    for (let o = 44; o < wav.length; o += 2) {
      peak = Math.max(peak, Math.abs(view.getInt16(o, true)));
    }
    const dbfs = 20 * Math.log10(peak / 32767);
    expect(dbfs).toBeLessThan(-40);
    expect(dbfs).toBeGreaterThan(-55);
  });

  it("loops without a click: it ends where it starts", () => {
    const first = view.getInt16(44, true);
    const last = view.getInt16(wav.length - 2, true);
    expect(Math.abs(first)).toBeLessThan(5);
    expect(Math.abs(last - first)).toBeLessThan(40);
  });
});

describe("startPilotTone", () => {
  let play: ReturnType<typeof vi.fn>;
  let pause: ReturnType<typeof vi.fn>;
  let created: HTMLAudioElement[];

  beforeEach(() => {
    flags.android = true;
    created = [];
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    vi.stubGlobal("Audio", function AudioStub(this: object) {
      const el = {
        loop: false,
        paused: false,
        play,
        pause,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLAudioElement;
      created.push(el);
      return el;
    });
    URL.createObjectURL = vi.fn(() => "blob:pilot");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays one looping element for several calls and stops with the last one", () => {
    const release1 = startPilotTone();
    const release2 = startPilotTone();
    expect(created).toHaveLength(1);
    expect(created[0].loop).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);

    release1();
    release1(); // releasing twice must not drop the other call's hold
    expect(pause).not.toHaveBeenCalled();
    release2();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pilot");
  });

  it("can start again after it was stopped", () => {
    startPilotTone()();
    const release = startPilotTone();
    expect(created).toHaveLength(2);
    release();
  });

  it("does nothing when it is not Android", () => {
    flags.android = false;
    startPilotTone()();
    expect(created).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });

  it("tries again on the next touch when playback was not allowed yet", async () => {
    play.mockRejectedValueOnce(new Error("NotAllowedError"));
    const release = startPilotTone();
    await Promise.resolve();
    await Promise.resolve();
    document.dispatchEvent(new Event("pointerdown"));
    expect(play).toHaveBeenCalledTimes(2);
    release();
  });

  describe("staying alive", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const fire = (el: HTMLAudioElement, type: string) =>
      (el.addEventListener as unknown as ReturnType<typeof vi.fn>).mock.calls
        .filter(([name]) => name === type)
        .forEach(([, handler]) => handler());

    it("starts the tone again when something pauses it", () => {
      const release = startPilotTone();
      const el = created[0];
      play.mockClear();
      fire(el, "pause");
      expect(play).toHaveBeenCalledTimes(1);
      release();
    });

    it("does not restart it after the last call ended", () => {
      const release = startPilotTone();
      const el = created[0];
      release();
      play.mockClear();
      fire(el, "pause");
      expect(play).not.toHaveBeenCalled();
    });

    it("checks every few seconds and resumes a paused tone", () => {
      const release = startPilotTone();
      const el = created[0];
      play.mockClear();
      vi.advanceTimersByTime(5000);
      expect(play).not.toHaveBeenCalled();
      (el as unknown as { paused: boolean }).paused = true;
      vi.advanceTimersByTime(5000);
      expect(play).toHaveBeenCalledTimes(1);
      release();
      play.mockClear();
      vi.advanceTimersByTime(30_000);
      expect(play).not.toHaveBeenCalled();
    });
  });
});
