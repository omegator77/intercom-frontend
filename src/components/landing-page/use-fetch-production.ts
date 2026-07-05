import { useEffect, useRef, useState } from "react";
import { API, TBasicProductionResponse } from "../../api/api";
import { useGlobalState } from "../../global-state/context-provider";

type TUseFetchProduction = (id: number | null) => {
  production: TBasicProductionResponse | null;
  error: Error | null;
  loading: boolean;
};

export const useFetchProduction: TUseFetchProduction = (id) => {
  const [production, setProduction] = useState<TBasicProductionResponse | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [{ reloadProductionList }, dispatch] = useGlobalState();
  const lastFetchedId = useRef<number | null>(null);

  useEffect(() => {
    let aborted = false;

    if (!id) {
      lastFetchedId.current = null;
      setProduction(null);
      setLoading(false);
      return () => {
        aborted = true;
      };
    }

    // Only refetch when the id actually changed or a reload was requested
    // (e.g. after adding/removing a line) — otherwise the PRODUCTION_LIST_FETCHED
    // dispatch below would flip reloadProductionList back to false, re-running
    // this effect and re-fetching a second, redundant time.
    if (lastFetchedId.current === id && !reloadProductionList) {
      return () => {
        aborted = true;
      };
    }

    setLoading(true);
    API.fetchProduction(id)
      .then((p) => {
        if (aborted) return;

        lastFetchedId.current = id;
        setError(null);
        setLoading(false);
        setProduction(p);
        if (reloadProductionList) {
          dispatch({ type: "PRODUCTION_LIST_FETCHED" });
        }
      })
      .catch((e) => {
        if (aborted) return;

        setProduction(null);
        setLoading(false);
        setError(e);
      });

    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloadProductionList]);

  return {
    error,
    production,
    loading,
  };
};
