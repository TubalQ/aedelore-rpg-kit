"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CreateCharacterInput, UpdateCharacterInput, LockStepInput, SpendXpInput } from "@/lib/schemas/character";

const CHARACTERS_KEY = ["characters"] as const;

function characterKey(id: number) {
  return ["characters", id] as const;
}

export function useCharacters() {
  return useQuery({
    queryKey: CHARACTERS_KEY,
    queryFn: () => api<Record<string, unknown>[]>("/api/characters"),
  });
}

export function useCharacter(id: number) {
  return useQuery({
    queryKey: characterKey(id),
    queryFn: () => api<Record<string, unknown>>(`/api/characters/${id}`),
    enabled: id > 0,
    refetchInterval: 30_000,
  });
}

export function useCreateCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCharacterInput) =>
      api<Record<string, unknown>>("/api/characters", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY });
    },
  });
}

export function useUpdateCharacter(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCharacterInput) =>
      api<Record<string, unknown>>(`/api/characters/${id}`, {
        method: "PUT",
        body: input,
      }),
    onSuccess: (data) => {
      // Merge (inte ersätt) så vy-only-fält som `viewerIsDm` - som PUT-svaret inte
      // innehåller - bevaras från GET-cachen; annars tappas DM-läget vid varje sparning.
      qc.setQueryData(characterKey(id), (old: Record<string, unknown> | undefined) =>
        old ? { ...old, ...data } : data,
      );
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY, exact: true });
    },
  });
}

export function useDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ success: boolean }>(`/api/characters/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY });
    },
  });
}

export function useLockStep(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LockStepInput) =>
      api<Record<string, unknown>>(`/api/characters/${id}/lock`, {
        method: "POST",
        body: input,
      }),
    onSuccess: (data) => {
      qc.setQueryData(characterKey(id), data);
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
      api<Record<string, unknown>>(`/api/characters/${id}/xp`, {
        method: "POST",
        body: deltas,
      }),
    onSuccess: (data) => {
      qc.setQueryData(characterKey(id), data);
      qc.invalidateQueries({ queryKey: CHARACTERS_KEY, exact: true });
      // XP totals also surface in the player's campaign view.
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
