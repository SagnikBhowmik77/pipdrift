"use client";

import { useEffect, useState } from "react";

/**
 * Confirmation toast driven by a server-rendered value. The key changes when a
 * new confirmation arrives, remounting the component so a repeat action shows
 * the toast again rather than silently reusing a dismissed one.
 */
export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-5 motion-safe:animate-[fade-in_200ms_ease-out]"
    >
      <p className="rounded-xl border border-mint/30 bg-ink-soft px-5 py-3 text-sm font-medium text-mint shadow-lg shadow-black/40">
        {message}
      </p>
    </div>
  );
}
