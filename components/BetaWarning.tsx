"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLocalStorage } from "../hooks/use-local-storage";

export function BetaWarning() {
  const STORAGE_KEY = "beta-warning-dismissed";
  const [visible, setVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useLocalStorage<boolean>(STORAGE_KEY, false);

  useEffect(() => {
    if (isDismissed) return;
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [isDismissed]);

  const dismiss = () => {
    setVisible(false);
    setIsDismissed(true);
  };

  if (!visible || isDismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto md:max-w-lg p-3 bg-card text-card-foreground shadow-xl rounded-lg border border-border z-50 transform transition-all duration-200 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>

        <div className="flex-grow">
          <p className="text-sm font-semibold text-foreground">You’re using a Beta version</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This beta may be incomplete or unstable and might not work as expected for Non-CSE Branches. Features or data could change.
            Please report issues via the whatsapp group or directly to the admin.
          </p>
        </div>

        <button
          onClick={dismiss}
          aria-label="Dismiss beta warning"
          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex-shrink-0 -mr-1 -mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


