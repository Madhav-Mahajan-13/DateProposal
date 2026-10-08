import { useEffect, useRef, useState } from 'react';
import Mascot from './components/Mascot';
import InvitationCard from './components/InvitationCard';
import Celebration from './components/Celebration';
import { story } from './content/invitation';
import type { Outcome } from './content/invitation';
import type { PuppyOrigin } from './components/PuppyAppeal';

export default function App() {
  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [nearDecline, setNearDecline] = useState(false);
  const [appealOrigin, setAppealOrigin] = useState<PuppyOrigin | null>(null);
  const mascotHome = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}mascot/biscuit-teary.png`;
  }, []);

  function showPuppyAppeal() {
    const dog = mascotHome.current?.querySelector('.dog-button');
    const bounds = dog?.getBoundingClientRect();
    setNearDecline(false);
    setAppealOrigin({
      left: (bounds?.left ?? 0) + window.scrollX,
      top: (bounds?.top ?? 0) + window.scrollY,
      width: bounds?.width ?? 220,
      height: bounds?.height ?? 220,
      motionAllowed:
        dog?.closest<HTMLElement>('.virtual-pet')?.dataset.motion !== 'paused',
    });
  }

  function finish(answer: Outcome) {
    setNearDecline(false);
    setAppealOrigin(null);
    setOutcome(answer);
  }
  function continueStory() {
    setNearDecline(false);
    if (step < story.length - 1) setStep(step + 1);
    else finish('accepted');
  }
  function restart() {
    setNearDecline(false);
    setAppealOrigin(null);
    setStep(0);
    setOutcome(null);
  }

  return (
    <>
      <div className="page">
        <header className="masthead">
          <a
            className="wordmark"
            href={import.meta.env.BASE_URL}
            aria-label="Start again"
          >
            <span className="paw" aria-hidden="true">
              ✿
            </span>{' '}
            a little hello
          </a>
          <span className="stamp">
            SPECIAL DELIVERY <span aria-hidden="true">♡</span>
          </span>
        </header>
        <main>
          <div className="intro">
            <span className="eyebrow">A SMALL SURPRISE, JUST FOR YOU</span>
            <h1>
              Someone wanted to
              <br />
              make you <em>smile.</em>
            </h1>
            <p>So they sent their most charming friend.</p>
          </div>
          <section
            className={`scene ${appealOrigin ? 'scene--appeal' : outcome === 'accepted' ? 'scene--planning' : ''}`}
            aria-label="A message from Biscuit"
          >
            <div className="mascot-home" ref={mascotHome}>
              <Mascot step={step} outcome={outcome} nearDecline={nearDecline} />
            </div>
            <InvitationCard
              step={step}
              outcome={outcome}
              onContinue={continueStory}
              onDecline={showPuppyAppeal}
              onRestart={restart}
              onDeclineApproach={setNearDecline}
              appealOrigin={appealOrigin}
              onFinalDecline={() => finish('declined')}
            />
          </section>
        </main>
        <footer>
          <span>A little courage. A little puppy charm.</span>
          <span>
            Made with a hopeful heart{' '}
            <span className="footer-heart" aria-hidden="true">
              ♡
            </span>
          </span>
        </footer>
      </div>
      {outcome === 'accepted' && <Celebration />}
    </>
  );
}
