/**
 * Hook managing audio element state, ref synchronization, cleanup, and
 * unmount teardown. Extracted from use-rtc-connection.ts lines 297-329.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { releaseGainControl } from "./audio-gain-control.ts";
import { trace } from "./audio-debug-panel.ts";

let hookCounter = 0;

export const useAudioElements = () => {
  const [audioElements, setAudioElementsRaw] = useState<HTMLAudioElement[]>([]);
  const audioElementsRef = useRef<HTMLAudioElement[]>(audioElements);
  const idRef = useRef(0);
  if (idRef.current === 0) {
    hookCounter += 1;
    idRef.current = hookCounter;
  }
  const id = idRef.current;

  const setAudioElements: typeof setAudioElementsRaw = useCallback(
    (update) => {
      trace(`hook #${id}: setAudioElements called`);
      setAudioElementsRaw(update);
    },
    [id]
  );

  useEffect(() => {
    trace(`hook #${id}: mounted`);
    return () => trace(`hook #${id}: UNMOUNTED`);
  }, [id]);

  // Keep ref in sync with state so cleanup always uses latest array
  useEffect(() => {
    audioElementsRef.current = audioElements;
    trace(`hook #${id}: state holds ${audioElements.length} element(s)`);
  }, [audioElements, id]);

  const cleanUpAudio = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      releaseGainControl(el);
      el.pause();
      // eslint-disable-next-line no-param-reassign
      el.srcObject = null;
    });
  }, [audioElementsRef]);

  // Teardown on unmount
  useEffect(
    () => () => {
      cleanUpAudio();
    },
    [cleanUpAudio]
  );

  return { audioElements, setAudioElements, cleanUpAudio };
};
