import { useEffect, useState } from "react";

export const useScript = (src: string) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") {
      setLoaded(true);
      return;
    }

    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = src;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const onLoad = () => {
      script.dataset.loaded = "true";
      setLoaded(true);
    };
    const onError = () => setError(`Failed to load ${src}`);

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [src]);

  return { loaded, error };
};