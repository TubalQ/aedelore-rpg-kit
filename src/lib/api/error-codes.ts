// ---------------------------------------------------------------------------
// API error codes (the owner 2026-11-15): errors a player can meet carry a stable
// `code` (and `params`) next to an English `error`. The page shows the code in
// the player's language (i18n key `apiError.<code>`); the MCP server and the
// AI read the English text. Add a code here and the two i18n keys together.
// ---------------------------------------------------------------------------

export const API_ERRORS = {
  inviteCodeInvalid: "That share code doesn't match any campaign. Check the code with your DM.",
  ownCampaign: "You are the DM of this campaign.",
  excludedFromCampaign: "The DM has excluded you from this campaign.",
  characterUnavailable: "That character does not exist or is already in another campaign.",
  onePerCampaign: "You already have a character in this campaign.",
  nameTaken: 'There is already a character called "{name}" in the campaign.',
  notCampaignMember: "You are not a member of that campaign.",
  notEnoughXp: "Not enough XP, no points given, or the character was not found.",
  itemNotHeld: "The character does not have that item.",
  notDmOrNotFound: "Character not found, or you are not the DM of the campaign.",
  imageTooLarge: "The image is too large. Maximum size is {max} MB.",
  imageInvalid: "That file is not an image. Allowed: JPEG, PNG, GIF and WebP.",
  imageDamaged: "The image file is damaged or incomplete.",
  uploadLimit: "Too many uploads. Try again in an hour.",
  passwordTooShort: "The password must be at least {min} characters.",
  passwordTooLong: "The password must be at most {max} characters.",
  passwordCommon: "That password is too common. Pick something less guessable.",
  passwordRepetitive: "That password repeats too few characters. Pick something less guessable.",
  passwordKeyboardRun: "That password contains a keyboard sequence. Pick something less guessable.",
  passwordPersonal: "The password must not contain your name or email address.",
  registrationFailed: "No account could be created with that email address. Try signing in instead.",
  tooManyAttempts: "Too many attempts. Try again in a while.",
  wrongCurrentPassword: "The current password is wrong.",
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;
export type ApiErrorParams = Record<string, string | number>;

/** The JSON body for an error with a code: `{ error, code, params? }`. */
export function apiErrorBody(code: ApiErrorCode, params?: ApiErrorParams): { error: string; code: ApiErrorCode; params?: ApiErrorParams } {
  let error: string = API_ERRORS[code];
  for (const [k, v] of Object.entries(params ?? {})) error = error.replace(`{${k}}`, String(v));
  return params ? { error, code, params } : { error, code };
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && Object.hasOwn(API_ERRORS, value);
}
