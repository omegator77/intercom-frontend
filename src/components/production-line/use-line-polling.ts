import { useEffect, useState } from "react";
import { noop } from "../../helpers.ts";
import { API } from "../../api/api.ts";
import { TJoinProductionOptions, TLine } from "./types.ts";
import { useGlobalState } from "../../global-state/context-provider.tsx";
import logger from "../../utils/logger.ts";

type TProps = {
  callId: string;
  joinProductionOptions: TJoinProductionOptions | null;
};

export const useLinePolling = ({ callId, joinProductionOptions }: TProps) => {
  const [line, setLine] = useState<TLine | null>(null);
  const [, dispatch] = useGlobalState();

  useEffect(() => {
    if (!joinProductionOptions) return noop;

    let consecutiveFailureCount = 0;
    let errorShown = false;
    const productionId = parseInt(joinProductionOptions.productionId, 10);
    const lineId = parseInt(joinProductionOptions.lineId, 10);

    const interval = window.setInterval(() => {
      API.fetchProductionLine(productionId, lineId)
        .then((l) => {
          consecutiveFailureCount = 0;
          if (errorShown) {
            // the network is back (typically right after a locked phone was woken up): the banner
            // about the failed requests is out of date, take it away again
            errorShown = false;
            dispatch({ type: "ERROR", payload: { callId, error: null } });
          }
          setLine(l);
        })
        .catch(() => {
          consecutiveFailureCount += 1;
          logger.red(
            `Error fetching production line ${productionId}/${lineId}. For call-id: ${callId}`
          );
          if (consecutiveFailureCount >= 5) {
            errorShown = true;
            dispatch({
              type: "ERROR",
              payload: {
                callId,
                error: new Error(
                  `Could not fetch production line ${productionId}/${lineId}. For call-id: ${callId}`
                ),
              },
            });
          }
          if (consecutiveFailureCount >= 10) {
            dispatch({
              type: "ERROR",
              payload: {
                callId,
                error: new Error(
                  "Line polling stopped after 10 consecutive failures."
                ),
              },
            });
            window.clearInterval(interval);
          }
        });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [callId, dispatch, joinProductionOptions]);

  return line;
};
