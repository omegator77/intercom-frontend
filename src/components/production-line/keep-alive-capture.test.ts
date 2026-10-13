import { describe, it, expect, vi, beforeEach } from "vitest";
import { adoptKeepAliveCapture } from "./keep-alive-capture.ts";

const flags = vi.hoisted(() => ({ android: true }));
vi.mock("../../bowser.ts", () => ({
  get isAndroid() {
    return flags.android;
  },
}));

const fakeStream = () => {
  const track = { stop: vi.fn() };
  return {
    stream: { getTracks: () => [track] } as unknown as MediaStream,
    track,
  };
};

describe("adoptKeepAliveCapture", () => {
  beforeEach(() => {
    flags.android = true;
  });

  it("keeps the first stream open for the calls that use it", () => {
    const { stream, track } = fakeStream();
    const release = adoptKeepAliveCapture(stream);
    expect(track.stop).not.toHaveBeenCalled();
    release();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("holds ONE stream for several calls: extra ones are stopped, the last release closes it", () => {
    const first = fakeStream();
    const second = fakeStream();
    const release1 = adoptKeepAliveCapture(first.stream);
    const release2 = adoptKeepAliveCapture(second.stream);

    expect(second.track.stop).toHaveBeenCalledTimes(1); // a second stream is never kept
    expect(first.track.stop).not.toHaveBeenCalled();

    release1();
    release1(); // releasing twice must not drop the other call's hold
    expect(first.track.stop).not.toHaveBeenCalled();
    release2();
    expect(first.track.stop).toHaveBeenCalledTimes(1);
  });

  it("can start over after the last call ended", () => {
    const a = fakeStream();
    adoptKeepAliveCapture(a.stream)();
    const b = fakeStream();
    const release = adoptKeepAliveCapture(b.stream);
    expect(b.track.stop).not.toHaveBeenCalled();
    release();
    expect(b.track.stop).toHaveBeenCalledTimes(1);
  });

  it("stops the stream right away when this is not Android", () => {
    flags.android = false;
    const { stream, track } = fakeStream();
    const release = adoptKeepAliveCapture(stream);
    expect(track.stop).toHaveBeenCalledTimes(1);
    release();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });
});
