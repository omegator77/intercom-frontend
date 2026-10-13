import { useEffect, useRef, useState } from "react";
import { noop } from "../../helpers.ts";

export const MAX_RECONNECTS = 5;
export const RECONNECT_DELAY_MS = 2000;

/**
 * Rebuilds a call whose peer connection ended up in "failed" - typically after a mobile browser froze
 * the page (screen locked) long enough for ICE to time out. Without this the call card stayed hidden
 * while the session kept heartbeating: gone for you, still present for everyone else.
 *
 * Waits a little longer before every further attempt (the network may still be waking up), gives up
 * after MAX_RECONNECTS in a row and starts counting again once a connection has been established.
 */
export const useAutoReconnect = ({
  connectionState,
  onReconnect,
}: {
  connectionState: RTCPeerConnectionState | null;
  onReconnect: () => void;
}) => {
  const attempts = useRef(0);
  const latest = useRef(onReconnect);
  latest.current = onReconnect;
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (connectionState === "connected") {
      attempts.current = 0;
      setGaveUp(false);
      return noop;
    }
    if (connectionState !== "failed") return noop;

    if (attempts.current >= MAX_RECONNECTS) {
      setGaveUp(true);
      return noop;
    }

    const timer = window.setTimeout(
      () => {
        attempts.current += 1;
        latest.current();
      },
      RECONNECT_DELAY_MS * (attempts.current + 1)
    );
    return () => window.clearTimeout(timer);
  }, [connectionState]);

  return { gaveUp };
};
