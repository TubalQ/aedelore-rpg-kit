import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { API_ERRORS, apiErrorBody } from "./error-codes";
import { errorMessage } from "./error-message";
import { sv } from "@/lib/i18n/sv";
import { en } from "@/lib/i18n/en";
import { useLocaleStore } from "@/stores/locale-store";

// the owner 2026-11-15: the API sends a code, the page shows it in the player's language.

afterEach(() => useLocaleStore.setState({ locale: "en" }));

describe("coded API errors", () => {
  it("has a Swedish and an English text for every code", () => {
    for (const code of Object.keys(API_ERRORS)) {
      expect(sv).toHaveProperty(`apiError.${code}`);
      expect(en).toHaveProperty(`apiError.${code}`);
    }
  });

  it("sends English text with the code and its params", () => {
    expect(apiErrorBody("nameTaken", { name: "Mira" })).toEqual({
      error: 'There is already a character called "Mira" in the campaign.',
      code: "nameTaken",
      params: { name: "Mira" },
    });
  });

  it("shows the code in the player's language, and plain errors as they came", () => {
    const coded = new ApiError(400, apiErrorBody("excludedFromCampaign"));
    useLocaleStore.setState({ locale: "sv" });
    expect(errorMessage(coded)).toBe("DM:n har uteslutit dig ur kampanjen.");
    useLocaleStore.setState({ locale: "en" });
    expect(errorMessage(coded)).toBe("The DM has excluded you from this campaign.");
    expect(errorMessage(new ApiError(400, { error: "Validation failed" }))).toBe("Validation failed");
  });
});
