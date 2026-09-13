"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const appRoot = useRef(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLegacyInterface() {
      try {
        const response = await fetch("/gst/index.html");
        if (!response.ok) throw new Error(`GST interface returned ${response.status}`);
        const html = await response.text();
        const body = new DOMParser().parseFromString(html, "text/html").body;
        const scripts = Array.from(body.querySelectorAll("script"));
        scripts.forEach((script) => script.remove());

        if (!active || !appRoot.current) return;
        appRoot.current.innerHTML = body.innerHTML;

        const appScript = document.createElement("script");
        appScript.src = "/gst/app.js";
        appScript.async = false;
        appRoot.current.appendChild(appScript);
      } catch (error) {
        if (active) setLoadError(error.message);
      }
    }

    loadLegacyInterface();
    return () => {
      active = false;
    };
  }, []);

  if (loadError) {
    return <main className="next-load-error">Unable to load GST Billing: {loadError}</main>;
  }

  return <main ref={appRoot} aria-label="GST Billing application" />;
}
