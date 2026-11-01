"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/** Cloudflare Turnstile ("I'm not a robot", usually invisible). Off when NEXT_PUBLIC_TURNSTILE_SITE_KEY is empty. */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !loaded || !box.current || !window.turnstile) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [loaded, onToken]);

  // A token works once: after a failed submit, ask for a fresh one.
  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      onToken(null);
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey, onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
      />
      <div ref={box} />
    </>
  );
}
