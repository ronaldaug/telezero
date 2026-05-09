import { useCallback, useEffect, useState } from 'react';

const PANEL_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * Drives right-edge overlay enter/exit: CSS transitions need a *change* in computed
 * style while mounted; on first paint alone, `transition-all` does nothing. Exit keeps
 * the overlay mounted until transform finishes so the panel can slide out.
 */
export function useSlidingOverlayPresence(
  wantsOpen: boolean,
  onExitComplete?: () => void,
): {
  rendered: boolean;
  entered: boolean;
  onPanelTransitionEnd: (e: React.TransitionEvent<HTMLElement>) => void;
  panelStyle: React.CSSProperties;
} {
  const [rendered, setRendered] = useState(wantsOpen);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (wantsOpen) {
      setRendered(true);
      setEntered(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
  }, [wantsOpen]);

  const onPanelTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.propertyName !== 'transform') return;
      if (wantsOpen) return;
      if (onExitComplete) {
        onExitComplete();
        setRendered(false);
        return;
      }
      setRendered(false);
    },
    [wantsOpen, onExitComplete],
  );

  /* If transform transitionend is skipped (e.g. reduced motion, interrupted), still tear down. */
  useEffect(() => {
    if (wantsOpen) return;
    if (!rendered) return;
    const id = window.setTimeout(() => {
      onExitComplete?.();
      setRendered(false);
    }, 500);
    return () => clearTimeout(id);
  }, [wantsOpen, onExitComplete, rendered]);

  return {
    rendered,
    entered,
    onPanelTransitionEnd,
    panelStyle: { transitionTimingFunction: PANEL_EASE },
  };
}
