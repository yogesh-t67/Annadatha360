"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

/** Cloudflare Turnstile ("I'm not a robot", usually invisible). Off when the server has no TURNSTILE_SITE_KEY. */

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

/** The site key comes from the server at run time (GET /api/public-config); "" means no robot check. */
export function useTurnstileSiteKey(): string | undefined {
  const { data } = useSWR<{ turnstile_site_key: string }>("public-config", () => fetch("/api/public-config").then((r) => r.json()), {
    revalidateOnFocus: false,
  });
  return data?.turnstile_site_key;
}

export function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey || !loaded || !box.current || !window.turnstile) return;
    widget.current = window.turnstile.render(box.current, {
      sitekey: siteKey,
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
    });
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [loaded, onToken, siteKey]);

  // A token works once: after a failed submit, ask for a fresh one.
  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      onToken(null);
      window.turnstile?.reset(widget.current);
    }
  }, [resetKey, onToken]);

  if (!siteKey) return null;
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
