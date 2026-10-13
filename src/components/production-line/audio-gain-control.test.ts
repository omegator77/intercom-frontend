import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { attachGainControl, releaseGainControl } from "./audio-gain-control.ts";

const gainParam = { value: 1 };
const ctxInstance = {
  state: "suspended",
  destination: {},
  createGain: vi.fn(() => ({ gain: gainParam, connect: vi.fn() })),
  createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
  resume: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
};

const fakeStream = () => {
  const cloneTrack = { enabled: true, stop: vi.fn() };
  const clone = {
    getAudioTracks: () => [cloneTrack],
    getTracks: () => [cloneTrack],
  } as unknown as MediaStream;
  const stream = { clone: () => clone } as unknown as MediaStream;
  return { stream, clone, cloneTrack };
};

describe("attachGainControl", () => {
  beforeEach(() => {
    gainParam.value = 1;
    ctxInstance.resume.mockClear();
    ctxInstance.close.mockClear();
    let stored: unknown = null;
    vi.spyOn(HTMLMediaElement.prototype, "srcObject", "set").mockImplementation(
      (v) => {
        stored = v;
      }
    );
    vi.spyOn(HTMLMediaElement.prototype, "srcObject", "get").mockImplementation(
      () => stored as MediaStream
    );
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextStub() {
        return ctxInstance;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("routes volume and mute of the element through the gain node", () => {
    const el = document.createElement("audio");
    expect(attachGainControl(el, fakeStream().stream)).not.toBeNull();

    el.volume = 0.5;
    expect(gainParam.value).toBe(0.5);
    expect(el.volume).toBe(0.5);

    el.muted = true;
    expect(gainParam.value).toBe(0);
    expect(el.muted).toBe(true);

    el.muted = false; // unmuting returns to the chosen volume
    expect(gainParam.value).toBe(0.5);
  });

  it("gives the element a SILENT copy of the stream, so the real sound is only heard through the gain", () => {
    const el = document.createElement("audio");
    const { stream, clone, cloneTrack } = fakeStream();
    const silent = attachGainControl(el, stream);

    expect(silent).toBe(clone);
    expect(el.srcObject).toBe(clone);
    expect(cloneTrack.enabled).toBe(false);
  });

  it("clamps the volume to 0..1", () => {
    const el = document.createElement("audio");
    attachGainControl(el, fakeStream().stream);
    el.volume = 3;
    expect(el.volume).toBe(1);
    el.volume = -1;
    expect(el.volume).toBe(0);
  });

  it("resumes a suspended context and releases everything", () => {
    const el = document.createElement("audio");
    const { stream, cloneTrack } = fakeStream();
    attachGainControl(el, stream);
    expect(ctxInstance.resume).toHaveBeenCalled();

    releaseGainControl(el);
    expect(ctxInstance.close).toHaveBeenCalledTimes(1);
    expect(cloneTrack.stop).toHaveBeenCalledTimes(1);
    releaseGainControl(el); // a second release is a no-op
    expect(ctxInstance.close).toHaveBeenCalledTimes(1);
  });

  it("leaves the element alone when Web Audio is unavailable or fails", () => {
    vi.stubGlobal("AudioContext", undefined);
    const el = document.createElement("audio");
    expect(attachGainControl(el, fakeStream().stream)).toBeNull();
    el.volume = 0.3;
    expect(el.volume).toBeCloseTo(0.3);

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextStub() {
        throw new Error("blocked");
      })
    );
    expect(
      attachGainControl(document.createElement("audio"), fakeStream().stream)
    ).toBeNull();
  });
});
