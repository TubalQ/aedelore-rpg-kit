"use client";

import { useEffect } from "react";
import { useLocaleStore } from "@/stores/locale-store";

export function LocaleHydrator() {
  const hydrate = useLocaleStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return null;
}
