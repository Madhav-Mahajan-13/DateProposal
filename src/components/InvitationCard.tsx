import { useEffect, useRef } from 'react';
import { endings, story } from '../content/invitation';
import type { Outcome } from '../content/invitation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useDeclineProximity } from '../hooks/useDeclineProximity';
import PuppyAppeal from './PuppyAppeal';
import type { PuppyOrigin } from './PuppyAppeal';
import DatePlanForm from './DatePlanForm';

interface InvitationCardProps {
  step: number;
  outcome: Outcome | null;
  onContinue: () => void;
  onDecline: () => void;
  onRestart: () => void;
  onDeclineApproach: (near: boolean) => void;
  appealOrigin: PuppyOrigin | null;
  onFinalDecline: () => void;
}

export default function InvitationCard({
  step,
  outcome,
  onContinue,
  onDecline,
  onRestart,
  onDeclineApproach,
  appealOrigin,
  onFinalDecline,
}: InvitationCardProps) {
  const content = outcome ? endings[outcome] : story[step];
  const messageKey = appealOrigin ? 'puppy-appeal' : (outcome ?? String(step));
  const previousMessage = useRef(messageKey);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const declineRef = useRef<HTMLButtonElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  useDeclineProximity(
    !outcome && !appealOrigin && step === story.length - 1,
    declineRef,
    acceptRef,
    onDeclineApproach,
  );

  useEffect(() => {
    if (previousMessage.current === messageKey) return;
    previousMessage.current = messageKey;
    const title = titleRef.current;
    title?.focus({ preventScroll: true });
    const bounds = title?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
      title?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'center',
      });
    }
  }, [messageKey, reducedMotion]);

  return (
    <div className="note-wrap">
      <span className="tape" aria-hidden="true" />
      <article className="note">
        <div className="note-top">
          <span>FROM THE DESK OF BISCUIT</span>
          <span aria-hidden="true">♡</span>
        </div>
        {appealOrigin ? (
          <PuppyAppeal
            origin={appealOrigin}
            onAccept={onContinue}
            onDecline={onFinalDecline}
          />
        ) : outcome === 'accepted' ? (
          <DatePlanForm onRestart={onRestart} />
        ) : (
          <>
            <div aria-live="polite" aria-atomic="true">
              <div key={messageKey} className="message enter">
                <span className="chapter">{content.chapter}</span>
                <h2 ref={titleRef} tabIndex={-1}>
                  {content.title}
                </h2>
                <p className="lead">{content.lead}</p>
                <p className="aside">{content.aside}</p>
              </div>
            </div>
            <div className="actions">
              {outcome ? (
                <button type="button" className="secondary" onClick={onRestart}>
                  Read it again
                </button>
              ) : (
                <>
                  <button
                    ref={acceptRef}
                    type="button"
                    className="primary"
                    onClick={onContinue}
                  >
                    {story[step].button}
                    <span aria-hidden="true">↗</span>
                  </button>
                  {step === story.length - 1 && (
                    <button
                      ref={declineRef}
                      type="button"
                      className="secondary"
                      onClick={onDecline}
                    >
                      No, thank you
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="note-bottom">
              <span>{content.footnote}</span>
              {!outcome && (
                <div
                  className="progress"
                  role="img"
                  aria-label={`Step ${step + 1} of ${story.length}`}
                >
                  {story.map((item, index) => (
                    <span
                      key={item.chapter}
                      className={index === step ? 'active' : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </article>
      <span className="handwritten note-caption">
        sealed with a little courage ♡
      </span>
    </div>
  );
}
