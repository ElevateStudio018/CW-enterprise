"use client";

import { useRef, type CSSProperties } from "react";
import { useImageLoaded } from "@/hooks/useImageLoaded";

/**
 * A lazily loaded photo that fades in once it has arrived instead of popping in. Pass any other transitions it needs
 * (such as a hover zoom) as `transition`; the fade is added to them.
 */
export function Photo({
  src,
  srcSet,
  sizes,
  alt = "",
  className = "",
  style,
  transition,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  transition?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const isLoaded = useImageLoaded(ref);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading="lazy"
      // Hidden at once while loading; only the way in is animated.
      style={{ ...style, transition: isLoaded ? [transition, "opacity 700ms ease-out"].filter(Boolean).join(", ") : transition }}
      className={`${isLoaded ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
