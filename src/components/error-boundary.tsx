"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

// Catches render errors in any screen so a single failure shows a friendly
// recovery card instead of blanking the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => this.setState({ error: null });

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <h2 className="text-2xl font-normal tracking-tight text-heading">
            This screen hit a snag.
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Something didn&apos;t load right. Your data is safe — try again, or
            reload the app.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={this.reset}
              className="rounded-2xl bg-primary px-5 py-3 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try again
            </button>
            <button
              onClick={this.reload}
              className="rounded-2xl border border-border bg-card px-5 py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
