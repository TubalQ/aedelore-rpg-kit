import { ApiError } from "@/lib/api/client";
import { isApiErrorCode } from "@/lib/api/error-codes";
import { translate, type TranslationKey } from "@/lib/i18n";
import { useLocaleStore } from "@/stores/locale-store";

/**
 * User-facing text for a failed request, in the player's language: a coded
 * error (error-codes.ts) through its i18n key, else the API's own message,
 * else a translated fallback.
 */
export function errorMessage(error: unknown): string {
  const locale = useLocaleStore.getState().locale;
  if (error instanceof ApiError) {
    const { code, params, error: text } = error.data ?? {};
    if (isApiErrorCode(code)) return translate(`apiError.${code}` as TranslationKey, locale, params);
    // "Validation failed" says nothing; the first field error says what.
    const fieldErrors = (error.data?.details as { fieldErrors?: Record<string, string[] | undefined> } | undefined)?.fieldErrors;
    const first = fieldErrors && Object.entries(fieldErrors).find(([, v]) => v && v.length > 0);
    if (first) return `${first[0]}: ${first[1]![0]}`;
    if (text) return text;
  }
  return translate("error.requestFailed", locale);
}
