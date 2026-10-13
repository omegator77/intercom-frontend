import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAudioElement } from "./audio-element-factory.ts";

// Mock bowser so we can control browser detection
vi.mock("../../bowser.ts", () => ({
  isBrowserSafari: false,
  isMobile: false,
  isIpad: false,
  isAndroid: false,
}));

describe("createAudioElement", () => {
  let mockStream: MediaStream;
  let onError: (error: Error) => void;
  let onSinkError: (error: Error) => void;
  let origSrcObjectDesc: PropertyDescriptor | undefined;

  beforeEach(() => {
    mockStream = {
      id: "mock-stream",
      getAudioTracks: () => [],
    } as unknown as MediaStream;
    onError = vi.fn();
    onSinkError = vi.fn();

    // happy-dom validates srcObject must be a real MediaStream.
    // Override the property to accept any value in tests.
    origSrcObjectDesc = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "srcObject"
    );
    let stored: MediaStream | null = null;
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      get() {
        return stored;
      },
      set(v: MediaStream | null) {
        stored = v;
      },
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original srcObject descriptor
    if (origSrcObjectDesc) {
      Object.defineProperty(
        HTMLMediaElement.prototype,
        "srcObject",
        origSrcObjectDesc
      );
    }
  });

  it("creates an audio element with autoplay enabled", () => {
    const el = createAudioElement({
      stream: mockStream,
      lineId: "line-1",
      audiooutput: undefined,
      onError,
      onSinkError,
    });

    expect(el).toBeInstanceOf(HTMLAudioElement);
    expect(el.autoplay).toBe(true);
    expect(el.controls).toBe(false);
  });

  it("sets srcObject to the provided stream", () => {
    const el = createAudioElement({
      stream: mockStream,
      lineId: "line-1",
      audiooutput: undefined,
      onError,
      onSinkError,
    });

    expect(el.srcObject).toBe(mockStream);
  });

  it("sets an id containing the lineId", () => {
    const el = createAudioElement({
      stream: mockStream,
      lineId: "my-line",
      audiooutput: undefined,
      onError,
      onSinkError,
    });

    expect(el.id).toContain("rtc-audio-my-line-");
  });

  it("calls setSinkId when audiooutput is provided", () => {
    const setSinkIdMock = vi.fn().mockResolvedValue(undefined);
    const origSetSinkId = HTMLAudioElement.prototype.setSinkId;
    HTMLAudioElement.prototype.setSinkId = setSinkIdMock;

    createAudioElement({
      stream: mockStream,
      lineId: "line-1",
      audiooutput: "speaker-device-1",
      onError,
      onSinkError,
    });

    expect(setSinkIdMock).toHaveBeenCalledWith("speaker-device-1");

    HTMLAudioElement.prototype.setSinkId = origSetSinkId;
  });

  it("does not call setSinkId when audiooutput is undefined", () => {
    const setSinkIdMock = vi.fn().mockResolvedValue(undefined);
    const origSetSinkId = HTMLAudioElement.prototype.setSinkId;
    HTMLAudioElement.prototype.setSinkId = setSinkIdMock;

    createAudioElement({
      stream: mockStream,
      lineId: "line-1",
      audiooutput: undefined,
      onError,
      onSinkError,
    });

    expect(setSinkIdMock).not.toHaveBeenCalled();

    HTMLAudioElement.prototype.setSinkId = origSetSinkId;
  });

  it("calls onSinkError callback when setSinkId rejects", async () => {
    const sinkError = new Error("Sink not found");
    const setSinkIdMock = vi.fn().mockRejectedValue(sinkError);
    const origSetSinkId = HTMLAudioElement.prototype.setSinkId;
    HTMLAudioElement.prototype.setSinkId = setSinkIdMock;

    createAudioElement({
      stream: mockStream,
      lineId: "line-1",
      audiooutput: "bad-device",
      onError,
      onSinkError,
    });

    // Wait for the promise rejection to be handled
    await vi.waitFor(() => {
      expect(onSinkError).toHaveBeenCalledWith(sinkError);
    });

    HTMLAudioElement.prototype.setSinkId = origSetSinkId;
  });

  describe("recovery", () => {
    const make = () => {
      const el = createAudioElement({
        stream: mockStream,
        lineId: "line-1",
        audiooutput: undefined,
        onError,
        onSinkError,
      });
      el.play = vi.fn().mockResolvedValue(undefined);
      return el;
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("still reports a media error and then re-attaches the stream and plays again", () => {
      const el = make();
      el.onerror?.(new Event("error"));
      expect(onError).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(600);
      expect(el.srcObject).toBe(mockStream);
      expect(el.play).toHaveBeenCalledTimes(1);
    });

    it("gives up after a few failed attempts, but starts over once playback runs again", () => {
      const el = make();
      for (let i = 0; i < 8; i += 1) {
        el.onerror?.(new Event("error"));
        vi.advanceTimersByTime(5000);
      }
      expect(el.play).toHaveBeenCalledTimes(5);

      el.dispatchEvent(new Event("playing")); // it works again: the counter resets
      el.onerror?.(new Event("error"));
      vi.advanceTimersByTime(5000);
      expect(el.play).toHaveBeenCalledTimes(6);
    });

    it("does not touch an element that was torn down during the delay", () => {
      const el = make();
      el.onerror?.(new Event("error"));
      el.srcObject = null;
      vi.advanceTimersByTime(5000);
      expect(el.srcObject).toBeNull();
      expect(el.play).not.toHaveBeenCalled();
    });

    it("resumes a paused element when the page becomes visible again", () => {
      const el = make();
      Object.defineProperty(el, "paused", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(el.play).toHaveBeenCalledTimes(1);
    });
  });
});
