import { useEffect, useRef, useState } from 'react';
import { saveDecline } from '../lib/datePlanApi';

export default function DeclineStatus() {
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<{ attempt: number; promise: Promise<void> } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    if (!pending.current || pending.current.attempt !== attempt)
      pending.current = { attempt, promise: saveDecline() };
    void pending.current.promise
      .then(() => {
        if (active) setStatus('saved');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <div className="decline-status">
      <p role="status">
        {status === 'saving'
          ? 'Saving your answer…'
          : status === 'saved'
            ? 'Your answer has been saved. Thank you for letting him know.'
            : 'Your answer couldn’t be saved. Please try again.'}
      </p>
      {status === 'error' && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setStatus('saving');
            setAttempt((value) => value + 1);
          }}
        >
          Try saving again
        </button>
      )}
    </div>
  );
}
