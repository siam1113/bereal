"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-surface! border-border! text-ink! shadow-md!",
          description: "text-ink-muted!",
          actionButton: "bg-accent! text-accent-foreground!",
          cancelButton: "bg-accent-soft! text-ink!",
        },
      }}
    />
  );
}

export { toast } from "sonner";
