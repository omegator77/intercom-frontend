export type TUserSettings = {
  username?: string;
  // Editable display name for logged-in users (guests use `username` instead).
  alias?: string;
  // Not all devices have input available
  audioinput?: string | "no-device";
  // Not all devices allow choosing output
  audiooutput?: string;
};
