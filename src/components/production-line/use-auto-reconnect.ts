import { useEffect, useRef, useState } from "react";
import { noop } from "../../helpers.ts";

export const MAX_RECONNECTS = 5;
export const RECONNECT_DELAY_MS = 2000;
export const RETURN_DELAY_MS = 1000;

/**
 * Rebuilds a call that died while a mobile browser had frozen the page (screen locked). Without this
 * the call card stayed hidden while the session kept heartbeating: gone for you, still present for
 * everyone else.
 *
 * Two triggers:
 *  - the peer connection reports "failed": rebuild after a short wait that grows with every attempt
 *    (the network may still be waking up);
 *  - the page becomes visible again and `isHealthy()` says the call is not fine: rebuild after a
 *    second instead of waiting for the browser to notice, which can take a minute.
 *
 * Gives up after MAX_RECONNECTS in a row and starts counting again once a connection is established.
 */
export const useAutoReconnect = ({
  connectionState,
  isHealthy,
  onReconnect,
}: {
  connectionState: RTCPeerConnectionState | null;
  isHealthy: () => boolean;
  onReconnect: () => void;
}) => {
  const attempts = useRef(0);
  const timer = useRef<number | null>(null);
  const latest = useRef({ isHealthy, onReconnect });
  latest.current = { isHealthy, onReconnect };
  const [gaveUp, setGaveUp] = useState(false);

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const schedule = (delay: number) => {
    if (timer.current !== null) return; // an attempt is already on its way
    if (attempts.current >= MAX_RECONNECTS) {
      setGaveUp(true);
      return;
    }
    timer.current = window.setTimeout(() => {
      timer.current = null;
      attempts.current += 1;
      latest.current.onReconnect();
    }, delay);
  };

  useEffect(() => {
    if (connectionState === "connected") {
      attempts.current = 0;
      setGaveUp(false);
      cancel(); // it recovered by itself while a rebuild was pending
      return noop;
    }
    if (connectionState !== "failed") return noop;

    schedule(RECONNECT_DELAY_MS * (attempts.current + 1));
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (latest.current.isHealthy()) return;
      schedule(RETURN_DELAY_MS);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { gaveUp };
};
