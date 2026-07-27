"use client";

import { Component, type ReactNode } from "react";
import { reportError } from "@/lib/api/report-error";
import { useToastStore } from "@/stores/toast-store";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    reportError(error, "react-boundary");
    useToastStore.getState().addToast("Något gick fel. Försök ladda om sidan.", "error");
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <h2 className="font-display text-xl text-accent-gold">Något gick fel</h2>
          <p className="text-text-muted text-sm">Ett oväntat fel uppstod.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-lg bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors text-sm"
          >
            Försök igen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
