import { useEffect } from 'react';
import type { RefObject } from 'react';

// React only updates when the cursor crosses the boundary, not on every move.
export function useDeclineProximity(
  enabled: boolean,
  declineRef: RefObject<HTMLButtonElement | null>,
  acceptRef: RefObject<HTMLButtonElement | null>,
  onChange: (near: boolean) => void,
) {
  useEffect(() => {
    const decline = declineRef.current;
    if (!enabled || !decline) return;

    let active = false;
    let pointer: { x: number; y: number } | null = null;

    function publish(next: boolean) {
      if (next === active) return;
      active = next;
      onChange(next);
    }

    function distanceTo(rect: DOMRect) {
      if (!pointer) return Infinity;
      return Math.hypot(
        Math.max(rect.left - pointer.x, 0, pointer.x - rect.right),
        Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom),
      );
    }

    function check() {
      if (!decline) return;
      const distance = distanceTo(decline.getBoundingClientRect());
      const accept = acceptRef.current;
      const acceptDistance = accept
        ? distanceTo(accept.getBoundingClientRect())
        : Infinity;
      publish(
        decline.matches(':focus-visible') ||
          (distance <= 85 && distance < acceptDistance),
      );
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      pointer = { x: event.clientX, y: event.clientY };
      check();
    }

    function reset() {
      pointer = null;
      publish(false);
    }

    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', check, true);
    window.addEventListener('resize', check);
    decline.addEventListener('focus', check);
    decline.addEventListener('blur', check);

    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      window.removeEventListener('scroll', check, true);
      window.removeEventListener('resize', check);
      decline.removeEventListener('focus', check);
      decline.removeEventListener('blur', check);
      reset();
    };
  }, [enabled, declineRef, acceptRef, onChange]);
}
