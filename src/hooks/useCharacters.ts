"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TRASH_KEY, useUndoableTrash } from "@/hooks/useTrash";
import { api } from "@/lib/api/client";
import { cancelRowRefetch, writeSavedRow } from "@/hooks/saved-row";
import type { CharacterResponse, CreateCharacterInput, UpdateCharacterInput, LockStepInput, SpendXpInput } from "@/lib/schemas/character";

const CHARACTERS_KEY = ["characters"] as const;

function characterKey(id: number) {
  return ["characters", id] as const;
}

export function useCharacters() {
  return useQuery({
    queryKey: CHARACTERS_KEY,
    queryFn: () => api<CharacterResponse[]>("/api/characters"),
  });
}

export function useCharacter(id: number) {
  return useQuery({
    queryKey: characterKey(id),
    queryFn: () => api<CharacterResponse>(`/api/characters/${id}`),
    enabled: id > 0,
    refetchInterval: 30_000,
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCharacterInput) =>
      api<CharacterResponse>("/api/characters", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY });
    },
  });
}

/**
 * The character wizard's final step as ONE mutation: create the character,
 * apply race/class through the server's starting-data endpoint (the same code
 * the MCP uses), then save the rest of the chosen data. Nothing is created
 * before the user confirms, so an abandoned wizard leaves no stub behind.
 */
export function useCreateCharacterWithSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      raceClass: { race: string; class: string; religion?: string } | null;
      data: Record<string, unknown>;
    }) => {
      const created = await api<{ id: number }>("/api/characters", {
        method: "POST",
        body: { name: input.name, campaignId: null },
      });
      if (input.raceClass) {
        await api(`/api/characters/${created.id}/race-class`, { method: "POST", body: input.raceClass });
      }
      if (Object.keys(input.data).length > 0) {
        await api(`/api/characters/${created.id}`, { method: "PUT", body: { data: input.data } });
      }
      return created;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CHARACTERS_KEY }),
  });
}

/** A save's answer: the character, and the keys not written because they changed meanwhile (C2). */
export type UpdateCharacterResponse = CharacterResponse & { conflicts?: string[] };

export function useUpdateCharacter(id: number, options: { handlesErrors?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    meta: { handlesErrors: options.handlesErrors },
    mutationFn: (input: UpdateCharacterInput) =>
      api<UpdateCharacterResponse>(`/api/characters/${id}`, {
        method: "PUT",
        body: input,
      }),
    onMutate: () => cancelRowRefetch(qc, characterKey(id)),
    onSuccess: async (data) => {
      const { conflicts: _conflicts, ...row } = data;
      // Merge (inte ersätt) så vy-only-fält som `viewerIsDm` - som PUT-svaret inte
      // innehåller - bevaras från GET-cachen; annars tappas DM-läget vid varje sparning.
      await writeSavedRow<CharacterResponse>(qc, characterKey(id), (old) =>
        old ? { ...old, ...row } : row,
      );
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY, exact: true });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  const notifyTrash = useUndoableTrash();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ success: boolean }>(`/api/characters/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY });
      qc.invalidateQueries({ queryKey: TRASH_KEY });
      notifyTrash("characters", id);
    },
  });
}

export function useLockStep(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LockStepInput) =>
      api<CharacterResponse>(`/api/characters/${id}/lock`, {
        method: "POST",
        body: input,
      }),
    onMutate: () => cancelRowRefetch(qc, characterKey(id)),
    onSuccess: async (data) => {
      await writeSavedRow<CharacterResponse>(qc, characterKey(id), data);
      // Lock status is shown in the character list and DM party/build views.
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY, exact: true });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useSpendXp(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deltas: SpendXpInput) =>
      api<CharacterResponse>(`/api/characters/${id}/xp`, {
        method: "POST",
        body: deltas,
      }),
    onMutate: () => cancelRowRefetch(qc, characterKey(id)),
    onSuccess: async (data) => {
      await writeSavedRow<CharacterResponse>(qc, characterKey(id), data);
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY, exact: true });
      // XP totals also surface in the player's campaign view.
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
