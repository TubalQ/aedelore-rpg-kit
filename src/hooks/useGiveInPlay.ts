"use client";

import { useCallback } from "react";
import { useDmCharacterControl } from "@/hooks/useCampaigns";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";
import type { SessionData, SessionEquipment, SessionItem } from "@/lib/schemas/session";
import { STASH_EQUIPMENT_KEYS } from "@/lib/schemas/stash";
import {
  givenAfterGive,
  givenAfterTakeBack,
  withGivenTo,
  type GiveKind,
  type GiveMode,
} from "@/lib/session/give";

/** Applies a change to one session list against the editor's latest copy, and saves it. */
export type UpdateGiveList = <K extends GiveKind>(key: K, change: (list: SessionData[K]) => SessionData[K]) => void;

type Entry = SessionItem | SessionEquipment;

/** A character to give to or take back from. `id` is null when no character in the campaign has that name any more. */
export type Holder = { id: number | null; name: string };

/**
 * Handing session items and equipment to characters in play, and taking them
 * back. The server changes the characters; the session card's holders follow
 * once the server has answered, so the card never claims a hand-over that did
 * not happen.
 */
export function useGiveInPlay(campaignId: number, sessionNumber: number | undefined, updateList: UpdateGiveList) {
  const { t } = useT();
  const addToast = useToastStore((s) => s.addToast);
  const control = useDmCharacterControl(campaignId);

  const setHolders = useCallback(
    (kind: GiveKind, index: number, entry: Entry, change: (current: readonly string[]) => string[], found: boolean) => {
      const ref = { stashId: entry.stashId, name: entry.name };
      if (kind === "items") {
        updateList("items", (list) => withGivenTo(list, index, ref, change, found ? { found: true } : {}));
      } else {
        updateList("equipment", (list) => withGivenTo(list, index, ref, change));
      }
    },
    [updateList],
  );

  const give = useCallback(
    (kind: GiveKind, index: number, entry: Entry, target: { id: number; name: string }, mode: GiveMode) => {
      const move = mode === "move";
      const payload =
        kind === "items"
          ? {
              action: "giveItem",
              characterId: target.id,
              move,
              item: {
                name: entry.name,
                description: entry.description,
                sessionName: sessionNumber ? `Session ${sessionNumber}` : "",
                stashId: entry.stashId ?? undefined,
              },
            }
          : {
              action: "giveEquipment",
              characterId: target.id,
              move,
              // The stashId keeps it the same stash entry (content edits in the
              // stash reach the character).
              equipment: {
                ...Object.fromEntries(STASH_EQUIPMENT_KEYS.map((k) => [k, (entry as SessionEquipment)[k]])),
                stashId: entry.stashId ?? undefined,
              },
            };
      control.mutate(payload, {
        onSuccess: () => {
          setHolders(kind, index, entry, (current) => givenAfterGive(current, target.name, mode), true);
          addToast(t(move ? "play.given" : "play.shared", { name: target.name, what: entry.name }), "success");
        },
      });
    },
    [control, sessionNumber, setHolders, addToast, t],
  );

  const takeBack = useCallback(
    (kind: GiveKind, index: number, entry: Entry, holder: Holder) => {
      const clear = () => setHolders(kind, index, entry, (current) => givenAfterTakeBack(current, holder.name), false);
      // Nobody in the campaign has that name any more (renamed or left): there
      // is no character to take it from, only the card to correct.
      if (holder.id === null) {
        clear();
        addToast(t("play.takenBackNoCharacter", { name: holder.name }), "info");
        return;
      }
      const stashId = entry.stashId ?? undefined;
      const payload =
        kind === "items"
          ? { action: "removeItem", characterId: holder.id, itemName: entry.name, stashId }
          : { action: "removeEquipment", characterId: holder.id, equipmentName: entry.name, stashId };
      control.mutate(payload, {
        onSuccess: () => {
          clear();
          addToast(t("play.takenBack", { name: holder.name, what: entry.name }), "success");
        },
        // The character does not have it (taken back elsewhere, or no longer in
        // the campaign). The error toast says so; the card stops claiming it.
        onError: (err) => {
          if (err instanceof ApiError && err.status === 404) clear();
        },
      });
    },
    [control, setHolders, addToast, t],
  );

  return { give, takeBack, pending: control.isPending };
}
