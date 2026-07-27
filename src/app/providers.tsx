"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { GlobalErrorHandler } from "@/components/layout/global-error-handler";
import { LocaleHydrator } from "@/components/layout/locale-hydrator";
import { ToastContainer } from "@/components/ui/toast-container";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
