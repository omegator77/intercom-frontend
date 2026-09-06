import { useEffect, useState } from "react";

export const useDevicePermissions = ({
  continueToApp,
}: {
  continueToApp: boolean;
}) => {
  const [permission, setPermission] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!continueToApp) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        // Only needed to check permission - release the device immediately
        // instead of holding it open for the lifetime of the mount.
        stream.getTracks().forEach((t) => t.stop());
        setDenied(false);
        setPermission(true);
      })
      .catch(() => {
        setDenied(true);
        setPermission(false);
      });
  }, [continueToApp]);

  return { permission, denied };
};
