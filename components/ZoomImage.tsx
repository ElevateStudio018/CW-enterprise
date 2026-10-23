"use client";

import type { CSSProperties } from "react";
import { useInView } from "@/hooks/useInView";
import { useImageLoaded } from "@/hooks/useImageLoaded";

const parallaxClasses = { top: "parallax-top", band: "parallax-band" } as const;

interface ZoomImageProps {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  srcSet?: string;
  sizes?: string;
  /** The photo at the top of a page: fetched ahead of everything else. */
  priority?: boolean;
  /**
   * Move a little slower than the page while scrolling: "top" for a photo at the top of a page, "band" for one further
   * down, whose frame must then clip with overflow-clip rather than overflow-hidden.
   */
  parallax?: keyof typeof parallaxClasses;
}

/**
 * A photo that slowly eases from a slight zoom to its normal size the first time it comes into view; one at the top
 * of a page does so as the page loads. One still loading fades in when it arrives. Its frame must clip overflow.
 */
export function ZoomImage({ src, alt = "", className = "", style, loading, srcSet, sizes, priority, parallax }: ZoomImageProps) {
  const { ref, isInView } = useInView<HTMLImageElement>();
  const isLoaded = useImageLoaded(ref);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={loading}
      fetchPriority={priority ? "high" : undefined}
      style={style}
      className={`${
        isLoaded
          ? "opacity-100 [transition:transform_1800ms_cubic-bezier(0.22,1,0.36,1),opacity_700ms_ease-out]"
          : "opacity-0 [transition:transform_1800ms_cubic-bezier(0.22,1,0.36,1)]"
      } ${isInView ? "scale-100" : "scale-[1.08]"} ${parallax ? parallaxClasses[parallax] : ""} ${className}`}
    />
  );
}
