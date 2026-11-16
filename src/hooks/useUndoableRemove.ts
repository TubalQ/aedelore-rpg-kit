"use client";

import { useCallback, useEffect, useRef } from "react";
import { useToastStore } from "@/stores/toast-store";
import { useT } from "@/lib/i18n";

/**
 * Remove an element from a list with an "X removed · Undo" toast. The undo
 * re-inserts it at its old position in the list as it is AT THAT MOMENT (edits
 * made after the removal are kept), so it reads the latest list via a ref.
 */
export function useUndoableRemove<T>(list: readonly T[], setList: (next: T[]) => void) {
  const { t } = useT();
  const latest = useRef({ list, setList });
  useEffect(() => {
    latest.current = { list, setList };
  }, [list, setList]);

  return useCallback(
    (index: number, label: string) => {
      const removed = latest.current.list[index];
      if (removed === undefined) return;
      latest.current.setList(latest.current.list.filter((_, i) => i !== index));
      useToastStore.getState().addActionToast(t("common.removedItem", { name: label || "…" }), {
        label: t("common.undo"),
        onClick: () => {
          const current = latest.current.list;
          const at = Math.min(index, current.length);
          latest.current.setList([...current.slice(0, at), removed, ...current.slice(at)]);
        },
      });
    },
    [t],
  );
}
