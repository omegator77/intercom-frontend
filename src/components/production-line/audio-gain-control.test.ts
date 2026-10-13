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

describe("attachGainControl", () => {
  const stream = {} as MediaStream;

  beforeEach(() => {
    gainParam.value = 1;
    ctxInstance.resume.mockClear();
    ctxInstance.close.mockClear();
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextStub() {
        return ctxInstance;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes volume and mute of the element through the gain node", () => {
    const el = document.createElement("audio");
    expect(attachGainControl(el, stream)).toBe(true);

    el.volume = 0.5;
    expect(gainParam.value).toBe(0.5);
    expect(el.volume).toBe(0.5);

    el.muted = true;
    expect(gainParam.value).toBe(0);
    expect(el.muted).toBe(true);

    el.muted = false; // unmuting returns to the chosen volume
    expect(gainParam.value).toBe(0.5);
  });

  it("clamps the volume to 0..1", () => {
    const el = document.createElement("audio");
    attachGainControl(el, stream);
    el.volume = 3;
    expect(el.volume).toBe(1);
    el.volume = -1;
    expect(el.volume).toBe(0);
  });

  it("resumes a suspended context and closes it on release", () => {
    const el = document.createElement("audio");
    attachGainControl(el, stream);
    expect(ctxInstance.resume).toHaveBeenCalled();
    releaseGainControl(el);
    expect(ctxInstance.close).toHaveBeenCalledTimes(1);
    releaseGainControl(el); // a second release is a no-op
    expect(ctxInstance.close).toHaveBeenCalledTimes(1);
  });

  it("leaves the element alone when Web Audio is unavailable or fails", () => {
    vi.stubGlobal("AudioContext", undefined);
    const el = document.createElement("audio");
    expect(attachGainControl(el, stream)).toBe(false);
    el.volume = 0.3;
    expect(el.volume).toBeCloseTo(0.3);

    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextStub() {
        throw new Error("blocked");
      })
    );
    expect(attachGainControl(document.createElement("audio"), stream)).toBe(
      false
    );
  });
});
