import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent } from 'react';
import type { Outcome } from '../content/invitation';
import { story } from '../content/invitation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import PetIcon from './PetIcon';
import './mascot.css';

type Activity = 'pet' | 'treat' | 'play';
type Reaction = { activity: Activity; id: number; context: string };
interface MascotProps {
  step: number;
  outcome: Outcome | null;
  nearDecline: boolean;
}

const reactions = {
  pet: {
    feeling: 'feeling adored',
    message: 'Oh. A head pat? I think I’m in love now too.',
    greeting: 'you get me. ♡',
  },
  treat: {
    feeling: 'snack enthusiast',
    message: 'A biscuit for Biscuit? You know the way to my heart.',
    greeting: 'for me?!',
  },
  play: {
    feeling: 'very, very excited',
    message: 'You. Me. This ball. Best afternoon ever.',
    greeting: 'again! again!',
  },
};
const moods = [
  {
    feeling: 'happy to see you',
    message: 'A little hello, and a tail that won’t keep a secret.',
    greeting: 'oh, hi there!',
  },
  {
    feeling: 'being a little cheeky',
    message: 'Who, me? Flirting? I’m just the messenger.',
    greeting: 'our little secret…',
  },
  {
    feeling: 'on wingdog duty',
    message: 'He’s a little nervous. I told him you seem lovely.',
    greeting: 'I believe in him.',
  },
  {
    feeling: 'flower delivery boy',
    message: 'He remembered your favorite. I insisted on delivering it myself.',
    greeting: 'a white rose, for you.',
  },
  {
    feeling: 'all ears',
    message: 'Take your time. I’ll be right here.',
    greeting: 'no rush, lovely.',
  },
];

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

export default function Mascot({ step, outcome, nearDecline }: MascotProps) {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sequence = useRef(0);
  const lookRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const pageVisible = useSyncExternalStore(
    subscribeToVisibility,
    () => !document.hidden,
    () => true,
  );
  const motionPaused = paused || reducedMotion || !pageVisible;
  const context = `${step}:${outcome ?? 'reading'}`;
  const activity = reaction?.context === context ? reaction.activity : null;
  const offeringRose = !outcome && story[step].gift === 'white-rose';
  const message = activity
    ? reactions[activity]
    : outcome === 'accepted'
      ? {
          feeling: 'one happy wingdog',
          message: 'A date! I knew my human had good taste.',
          greeting: 'best. day. ever.',
        }
      : outcome === 'declined'
        ? {
            feeling: 'still your friend',
            message: 'Still a friendly paw-five. Hope your day is lovely.',
            greeting: 'friends? always.',
          }
        : moods[Math.min(step, moods.length - 1)];
  const isWistful = nearDecline && !outcome && step === story.length - 1;
  const expression = isWistful
    ? 'sad'
    : activity === 'pet' ||
        activity === 'treat' ||
        offeringRose ||
        outcome === 'accepted'
      ? 'happy'
      : !outcome && step === 1
        ? 'wink'
        : 'open';
  const energy = isWistful
    ? 'wistful'
    : activity || outcome === 'accepted'
      ? 'excited'
      : outcome === 'declined' || offeringRose || step === story.length - 1
        ? 'gentle'
        : 'idle';

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function interact(nextActivity: Activity) {
    clearTimeout(timerRef.current);
    sequence.current += 1;
    setReaction({ activity: nextActivity, id: sequence.current, context });
    timerRef.current = setTimeout(() => setReaction(null), 4200);
  }

  function followPointer(event: PointerEvent<HTMLButtonElement>) {
    if (motionPaused || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientX - bounds.left) / bounds.width - 0.5;
    lookRef.current?.style.setProperty('--look-angle', `${offset * 5}deg`);
  }

  function resetLook() {
    lookRef.current?.style.setProperty('--look-angle', '0deg');
  }

  return (
    <div
      className="mascot-stage virtual-pet"
      data-motion={motionPaused ? 'paused' : 'running'}
      data-energy={energy}
      data-activity={activity ?? 'idle'}
      data-expression={expression}
      data-gift={offeringRose ? 'white-rose' : undefined}
    >
      <div className="halo" aria-hidden="true" />
      <span className="doodle heart-one" aria-hidden="true">
        ♡
      </span>
      <span className="doodle star" aria-hidden="true">
        ✧
      </span>
      <span className="doodle heart-two" aria-hidden="true">
        ♡
      </span>
      <span className="handwritten hello" aria-hidden="true">
        {message.greeting}
      </span>

      <button
        type="button"
        className="dog-button"
        aria-label="Pet Biscuit"
        title="Give Biscuit a little pat"
        onClick={() => interact('pet')}
        onPointerMove={followPointer}
        onPointerLeave={resetLook}
        onBlur={resetLook}
      >
        <span className="dog-look" ref={lookRef}>
          <span className="dog-breathe">
            <span
              className="dog-reaction"
              key={activity ? reaction?.id : 'rest'}
            >
              <span className="dog-rig" aria-hidden="true">
                <img
                  className="dog-tail"
                  src={`${import.meta.env.BASE_URL}mascot/biscuit-tail.png`}
                  alt=""
                  width="1280"
                  height="1280"
                  draggable="false"
                />
                <img
                  className="dog-body"
                  src={`${import.meta.env.BASE_URL}mascot/biscuit-body.png`}
                  alt=""
                  width="1280"
                  height="1280"
                  fetchPriority="high"
                  draggable="false"
                />
                <span className="dog-face dog-blink">
                  <img
                    src={`${import.meta.env.BASE_URL}mascot/biscuit-happy.png`}
                    alt=""
                    width="1280"
                    height="1280"
                    draggable="false"
                  />
                </span>
                <span className="dog-face dog-wink">
                  <img
                    src={`${import.meta.env.BASE_URL}mascot/biscuit-wink.png`}
                    alt=""
                    width="1280"
                    height="1280"
                    draggable="false"
                  />
                </span>
                {offeringRose && (
                  <img
                    className="dog-rose"
                    src={`${import.meta.env.BASE_URL}mascot/white-rose.png`}
                    alt=""
                    width="1024"
                    height="1536"
                    draggable="false"
                  />
                )}
                <span className="dog-face dog-sad">
                  <img
                    src={`${import.meta.env.BASE_URL}mascot/biscuit-sad.png`}
                    alt=""
                    width="1280"
                    height="1280"
                    draggable="false"
                  />
                </span>
              </span>
            </span>
          </span>
        </span>
        {activity && (
          <span
            className={`pet-effect effect-${activity}`}
            key={reaction?.id}
            aria-hidden="true"
          >
            {activity === 'pet' ? (
              <>
                <span>♡</span>
                <span>♡</span>
                <span>♡</span>
              </>
            ) : (
              <PetIcon kind={activity} />
            )}
          </span>
        )}
      </button>

      <div className="name-tag">
        <span className="status-dot" aria-hidden="true" /> BISCUIT{' '}
        <span className="tag-divider">/</span> {message.feeling}
      </div>
      <p
        className="pet-message"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message.message}
      </p>
      <div
        className="pet-controls"
        role="group"
        aria-label="Spend a moment with Biscuit"
      >
        {(['pet', 'treat', 'play'] as const).map((kind) => (
          <button
            type="button"
            key={kind}
            className={`pet-action ${activity === kind ? 'is-active' : ''}`}
            onClick={() => interact(kind)}
            aria-label={
              kind === 'pet'
                ? 'Pet Biscuit'
                : kind === 'treat'
                  ? 'Give Biscuit a treat'
                  : 'Play ball with Biscuit'
            }
          >
            <PetIcon kind={kind} />
            {kind === 'pet' ? 'Pet' : kind === 'treat' ? 'Treat' : 'Play'}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="motion-toggle"
        aria-pressed={motionPaused}
        disabled={reducedMotion}
        onClick={() => {
          setPaused(!paused);
          resetLook();
        }}
      >
        <span aria-hidden="true">{motionPaused ? '▷' : 'Ⅱ'}</span>{' '}
        {reducedMotion
          ? 'Reduced motion is on'
          : paused
            ? 'Resume motion'
            : 'Pause motion'}
      </button>
    </div>
  );
}
