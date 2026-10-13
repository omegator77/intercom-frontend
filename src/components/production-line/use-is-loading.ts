import { useEffect, useState } from "react";

type TProps = {
  connectionState: string | null;
};

export const useIsLoading = ({ connectionState }: TProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<boolean>(false);

  useEffect(() => {
    if (connectionState === "connected") {
      setLoading(false);
      setConnectionError(false);
    } else if (connectionState === "failed") {
      setConnectionError(true);
    } else if (connectionState === null) {
      // the call is being (re)built: a rebuilt call must not stay stuck in the earlier failure
      setLoading(true);
      setConnectionError(false);
    }
  }, [connectionState]);

  return {
    loading,
    connectionError,
  };
};
