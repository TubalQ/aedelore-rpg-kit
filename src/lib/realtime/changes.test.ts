import { describe, expect, it } from "vitest";
import { parseChange } from "./changes";
import { keysFor } from "@/hooks/useCampaignLive";

describe("live updates (#82)", () => {
  it("reads only our payloads", () => {
    expect(parseChange('{"t":"characters","c":12}')).toEqual({ t: "characters", c: 12 });
    expect(parseChange('{"t":"users","c":12}')).toBeNull();
    expect(parseChange('{"t":"characters","c":"12"}')).toBeNull();
    expect(parseChange("not json")).toBeNull();
  });

  it("refetches only what shows the changed table", () => {
    expect(keysFor(7, ["characters"])).toEqual([["campaigns", 7, "characters"], ["campaigns", 7, "player-view"], ["characters"]]);
    expect(keysFor(7, ["game_sessions", "characters"])).toEqual([
      ["campaigns", 7, "sessions"], ["campaigns", 7, "player-view"], ["sessions"], ["campaigns", 7, "characters"], ["characters"],
    ]);
    expect(keysFor(7, ["all"])).toEqual([["campaigns", 7], ["campaigns"], ["sessions"], ["characters"]]);
  });
});
