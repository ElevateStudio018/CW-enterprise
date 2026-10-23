"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * False while a photo is still on its way, so it can fade in when it arrives instead of popping in. Starts out true,
 * so the server-rendered photo shows as it is without JavaScript and an already loaded one never blinks.
 */
export function useImageLoaded(ref: RefObject<HTMLImageElement>) {
  const [isLoaded, setIsLoaded] = useState(true);

  useEffect(() => {
    const image = ref.current;
    if (!image || image.complete) return;

    setIsLoaded(false);
    const show = () => setIsLoaded(true);
    image.addEventListener("load", show);
    image.addEventListener("error", show);
    return () => {
      image.removeEventListener("load", show);
      image.removeEventListener("error", show);
    };
  }, [ref]);

  return isLoaded;
}
