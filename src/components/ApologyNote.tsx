import { useEffect, useRef, useState, type RefObject } from 'react';
import { apology } from '../content/apology';
import './apology.css';

// A letter laid over the page on every visit. It can always be closed, and a
// blinking envelope sticker in the corner opens it again.
export default function ApologyNote() {
  const [open, setOpen] = useState(true);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      // Only one focusable control, so keep Tab on it.
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      {/* Stays mounted (just hidden) so focus can return to it on close. */}
      <button
        className="apology-sticker"
        hidden={open}
        onClick={() => setOpen(true)}
        aria-label="Open the letter"
      >
        <span className="apology-sticker-ring" aria-hidden="true" />
        <svg viewBox="0 0 64 48" aria-hidden="true">
          <rect x="2" y="2" width="60" height="44" rx="5" fill="#1c1a18" />
          <rect
            x="2"
            y="2"
            width="60"
            height="44"
            rx="5"
            fill="none"
            stroke="#45403a"
            strokeWidth="2"
          />
          <path
            d="M4 6 32 28 60 6"
            fill="none"
            stroke="#45403a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* A cracked heart for the seal */}
          <path
            d="M32 38c-6-4-9-7-8-10.5 1-3 4.6-3.6 8-.6 3.4-3 7-2.4 8 .6 1 3.5-2 6.5-8 10.5Z"
            fill="#8b847b"
          />
          <path
            d="M32 26.9 30.4 30.2 33.2 32.4 31 35.4 32 38"
            fill="none"
            stroke="#1c1a18"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        <span className="apology-sticker-dot" aria-hidden="true" />
        <span className="apology-sticker-label">a note for you</span>
      </button>
      {open && (
        <Letter onClose={() => setOpen(false)} buttonRef={closeButton} />
      )}
    </>
  );
}

function Letter({
  onClose,
  buttonRef,
}: {
  onClose: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="apology-backdrop">
      <div
        className="apology-letter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apology-title"
      >
        <span className="apology-mark" aria-hidden="true">
          ♡
        </span>
        <h2 id="apology-title">Before anything else…</h2>
        <div className="apology-body">
          {apology.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <button ref={buttonRef} className="apology-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
