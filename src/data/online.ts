/**
 * TALAS — network/online status (offline/online sync).
 *
 * A tiny observable around `navigator.onLine` and the window online/offline
 * events. The sync engine subscribes to auto-sync on reconnect; the UI uses
 * `useOnline()` to show an offline indicator.
 */

import { useEffect, useState } from "react";

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

/** Returns the current online status. Defaults to true outside the browser. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function emit(online: boolean): void {
  for (const listener of listeners) {
    try {
      listener(online);
    } catch {
      // A misbehaving listener must not break the others.
    }
  }
}

// Wire up the browser events once at module load.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => emit(true));
  window.addEventListener("offline", () => emit(false));
}

/**
 * Subscribes to online/offline transitions. Returns an unsubscribe function.
 * The callback receives the new online boolean.
 */
export function onStatusChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Subscribes specifically to the offline→online transition (reconnect).
 * Returns an unsubscribe function.
 */
export function onOnline(callback: () => void): () => void {
  return onStatusChange((online) => {
    if (online) callback();
  });
}

/** React hook: re-renders when connectivity changes. */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(isOnline());

  useEffect(() => onStatusChange(setOnline), []);

  return online;
}
