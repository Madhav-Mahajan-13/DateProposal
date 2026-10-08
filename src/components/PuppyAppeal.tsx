import { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import './puppy-appeal.css';

export interface PuppyOrigin {
  left: number;
  top: number;
  width: number;
  height: number;
  motionAllowed: boolean;
}

interface PuppyAppealProps {
  origin: PuppyOrigin;
  onAccept: () => void;
  onDecline: () => void;
}

export default function PuppyAppeal({
  origin,
  onAccept,
  onDecline,
}: PuppyAppealProps) {
  const dogRef = useRef<HTMLImageElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const dog = dogRef.current;
    const heading = headingRef.current;
    if (!dog || !heading) return;
    heading.focus({ preventScroll: true });
    const note = heading.closest('.note');
    const noteBounds = note?.getBoundingClientRect();
    if (
      noteBounds &&
      (noteBounds.top < 0 || noteBounds.top > window.innerHeight / 2)
    ) {
      note?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    if (reducedMotion || !origin.motionAllowed) return;

    let cancelled = false;
    let animation: Animation | undefined;
    // Wait for the face to decode so the travel never animates an empty image.
    void dog
      .decode()
      .then(() => {
        if (cancelled) return;
        const destination = dog.getBoundingClientRect();
        const sourceTop = origin.top - window.scrollY;
        const sourceLeft = origin.left - window.scrollX;
        const sourceVisible =
          sourceTop + origin.height > 0 && sourceTop < window.innerHeight;
        animation = dog.animate(
          sourceVisible
            ? [
                {
                  transform: `translate(${sourceLeft - destination.left}px, ${sourceTop - destination.top}px) scale(${origin.width / destination.width})`,
                },
                { transform: 'translate(0, -10px) scale(1.03)', offset: 0.82 },
                { transform: 'translate(0, 0) scale(1)' },
              ]
            : [
                { opacity: 0, transform: 'translateY(22px) scale(.92)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' },
              ],
          { duration: 750, easing: 'cubic-bezier(.22,.65,.3,1)' },
        );
      })
      .catch(() => {
        /* The descriptive alt text remains available if artwork cannot load. */
      });
    return () => {
      cancelled = true;
      animation?.cancel();
    };
  }, [origin, reducedMotion]);

  return (
    <div className="puppy-appeal">
      <span className="chapter">A SMALL WORD FROM YOUR WINGDOG</span>
      <div className="appeal-portrait">
        <img
          ref={dogRef}
          className="appeal-dog"
          src={`${import.meta.env.BASE_URL}mascot/biscuit-teary.png`}
          alt="Biscuit steps forward with a sad little face and tears in his eyes."
          width="1280"
          height="1280"
        />
        <span className="handwritten appeal-whisper" aria-hidden="true">
          one tiny pitch?
        </span>
      </div>
      <h2 ref={headingRef} tabIndex={-1}>
        Hear a little puppy out?
      </h2>
      <p className="lead">
        One crispy dosa. Coffee after. My human doing his best to make you
        smile.
      </p>
      <p className="aside">
        And if a street-food stall catches your eye, we’re stopping.
        <br />
        I’ve personally approved the snack plan. ♡
      </p>
      <div className="actions appeal-actions">
        <button type="button" className="primary" onClick={onAccept}>
          Okay, dosa it is <span aria-hidden="true">♡</span>
        </button>
        <button type="button" className="secondary" onClick={onDecline}>
          Still no, thank you
        </button>
      </div>
      <p className="appeal-reassurance">
        Either way, you’re still getting a friendly paw-five.
      </p>
    </div>
  );
}
