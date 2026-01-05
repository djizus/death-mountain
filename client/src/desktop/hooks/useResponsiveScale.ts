import { useState, useEffect, useCallback, useMemo } from 'react';

// Base design dimensions (16:9 reference at 1920x1080)
const BASE_WIDTH = 1920;
const BASE_HEIGHT = 1080;

// Scale bounds
const MIN_SCALE = 0.65;  // For ~1024px screens
const MAX_SCALE = 1.4;   // For 2560px+ screens

// Debounce delay for resize events
const RESIZE_DEBOUNCE_MS = 100;

export interface ResponsiveValues {
  /** Current scale factor (0.65 - 1.4) */
  scale: number;
  /** Scale a pixel value based on current viewport */
  scalePx: (px: number) => number;
  /** Scale a pixel value with a minimum bound */
  scalePxMin: (px: number, min: number) => number;
  /** Current viewport dimensions */
  viewport: { width: number; height: number };
  /** Left offset for 16:9 centering (from existing getMenuLeftOffset logic) */
  contentOffset: number;
  /** Available content width within 16:9 constraint */
  contentWidth: number;
}

/**
 * Calculate the scale factor based on viewport dimensions.
 * Uses the smaller of width/height scaling to ensure content fits.
 */
function calculateScale(viewportWidth: number, viewportHeight: number): number {
  // Calculate scale based on viewport dimensions relative to base
  const widthScale = viewportWidth / BASE_WIDTH;
  const heightScale = viewportHeight / BASE_HEIGHT;

  // Use the limiting dimension (smaller scale) to ensure fit
  const rawScale = Math.min(widthScale, heightScale);

  // Clamp between min and max bounds
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
}

/**
 * Calculate the content offset for 16:9 aspect ratio centering.
 * This mirrors the logic from utils/utils.ts getMenuLeftOffset()
 */
function calculateContentOffset(viewportWidth: number, viewportHeight: number): number {
  const windowAspect = viewportWidth / viewportHeight;
  const imageAspect = 16 / 9;

  if (windowAspect > imageAspect) {
    // Window is wider than 16:9, calculate horizontal offset
    const imageHeight = viewportHeight;
    const imageWidth = imageHeight * imageAspect;
    return (viewportWidth - imageWidth) / 2;
  }

  return 0;
}

/**
 * Calculate the available content width within 16:9 constraint
 */
function calculateContentWidth(viewportWidth: number, viewportHeight: number): number {
  const windowAspect = viewportWidth / viewportHeight;
  const imageAspect = 16 / 9;

  if (windowAspect > imageAspect) {
    // Window is wider than 16:9, content is height-constrained
    return viewportHeight * imageAspect;
  }

  // Window is narrower or equal to 16:9, use full width
  return viewportWidth;
}

/**
 * Hook that provides responsive scaling values based on viewport size.
 *
 * Designed for screens from 1024px to 2560px+ width, scaling proportionally.
 * Maintains compatibility with the existing 16:9 aspect ratio centering approach.
 *
 * @example
 * ```tsx
 * const { scalePx, scale, contentOffset } = useResponsiveScale();
 *
 * const styles = {
 *   panel: {
 *     width: scalePx(310),  // 310px at 1920, ~200px at 1024, ~434px at 2560
 *     left: contentOffset + scalePx(32),
 *   }
 * };
 * ```
 */
export function useResponsiveScale(): ResponsiveValues {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : BASE_HEIGHT,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setViewport({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);

    // Initial calculation
    handleResize();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const scale = useMemo(
    () => calculateScale(viewport.width, viewport.height),
    [viewport.width, viewport.height]
  );

  const contentOffset = useMemo(
    () => calculateContentOffset(viewport.width, viewport.height),
    [viewport.width, viewport.height]
  );

  const contentWidth = useMemo(
    () => calculateContentWidth(viewport.width, viewport.height),
    [viewport.width, viewport.height]
  );

  const scalePx = useCallback(
    (px: number): number => Math.round(px * scale),
    [scale]
  );

  const scalePxMin = useCallback(
    (px: number, min: number): number => Math.max(Math.round(px * scale), min),
    [scale]
  );

  return {
    scale,
    scalePx,
    scalePxMin,
    viewport,
    contentOffset,
    contentWidth,
  };
}

export default useResponsiveScale;
