"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { GlobalErrorHandler } from "@/components/layout/global-error-handler";
import { LocaleHydrator } from "@/components/layout/locale-hydrator";
import { ToastContainer } from "@/components/ui/toast-container";
import { useToastStore } from "@/stores/toast-store";
import { errorMessage } from "@/lib/api/error-message";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Every failed mutation is shown to the user (rule 4), in the user's
        // language, unless the component handles the error itself.
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.handlesErrors) return;
            useToastStore.getState().addToast(errorMessage(error), "error");
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <GlobalErrorHandler />
          <LocaleHydrator />
          {children}
        </ErrorBoundary>
        <ToastContainer />
      </QueryClientProvider>
    </SessionProvider>
  );
}
