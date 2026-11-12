import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { khushiEnding, khushiStory, herName } from '../content/khushi';
import type { KhushiMood } from '../content/khushi';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { saveNote } from '../lib/noteApi';
import './mascot.css';
import './khushi.css';

const asset = (name: string) => `${import.meta.env.BASE_URL}mascot/${name}`;

const looks: Record<
  KhushiMood | 'ending',
  { expression: string; energy: string; feeling: string }
> = {
  hello: {
    expression: 'open',
    energy: 'excited',
    feeling: 'so happy to see you',
  },
  wistful: {
    expression: 'sad',
    energy: 'wistful',
    feeling: 'a little worried',
  },
  gentle: { expression: 'open', energy: 'gentle', feeling: 'being honest' },
  listening: { expression: 'open', energy: 'gentle', feeling: 'all ears' },
  rose: {
    expression: 'happy',
    energy: 'gentle',
    feeling: 'flower delivery boy',
  },
  wink: { expression: 'wink', energy: 'idle', feeling: 'being cheeky' },
  warm: { expression: 'happy', energy: 'gentle', feeling: 'in your corner' },
  ending: { expression: 'happy', energy: 'excited', feeling: 'hugged & happy' },
};

type NoteStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function KhushiPage() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState<NoteStatus>('idle');
  const [hearts, setHearts] = useState(0);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const reducedMotion = useReducedMotion();

  const current = khushiStory[step];
  const content = done ? khushiEnding : current;
  const look = looks[done ? 'ending' : current.mood];
  const showRose = !done && current.bouquet;
  const messageKey = done ? 'ending' : current.id;

  useEffect(() => {
    document.title = `For ${herName} ♡ | Biscuit`;
    document.documentElement.classList.add('theme-lilac');
    return () => document.documentElement.classList.remove('theme-lilac');
  }, []);

  useEffect(() => () => clearTimeout(heartTimer.current), []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const title = titleRef.current;
    title?.focus({ preventScroll: true });
    const bounds = title?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight))
      title?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'center',
      });
  }, [messageKey, reducedMotion]);

  function pet() {
    clearTimeout(heartTimer.current);
    setHearts((value) => value + 1);
    heartTimer.current = setTimeout(() => setHearts(0), 2400);
  }

  function next() {
    if (step < khushiStory.length - 1) setStep(step + 1);
    else {
      setDone(true);
      pet();
    }
  }

  function restart() {
    setDone(false);
    setStep(0);
  }

  async function sendNote() {
    if (!note.trim() || noteStatus === 'sending') return;
    setNoteStatus('sending');
    try {
      await saveNote(note);
      setNoteStatus('sent');
    } catch {
      setNoteStatus('error');
    }
  }

  return (
    <div className="page khushi-page">
      <div className="petals" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} style={{ '--i': index } as CSSProperties} />
        ))}
      </div>
      <header className="masthead">
        <span className="wordmark">
          <span className="paw" aria-hidden="true">
            ✿
          </span>{' '}
          for {herName.toLowerCase()}
        </span>
        <span className="stamp">
          HANDLE WITH CARE <span aria-hidden="true">♡</span>
        </span>
      </header>
      <main>
        <div className="intro">
          <span className="eyebrow">A LITTLE LETTER, ONLY FOR YOU</span>
          <h1>
            Dear <em>{herName},</em>
          </h1>
          <p>A certain golden pup has a few things to say.</p>
        </div>

        <section
          className="scene"
          aria-label={`A letter from Biscuit to ${herName}`}
        >
          <div
            className="mascot-stage virtual-pet"
            data-motion={reducedMotion ? 'paused' : 'running'}
            data-energy={look.energy}
            data-expression={look.expression}
            data-activity={hearts ? 'pet' : 'idle'}
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
            <span
              className="handwritten hello"
              key={messageKey}
              aria-hidden="true"
            >
              {done ? 'hug!!' : current.bubble}
            </span>
            <button
              type="button"
              className="dog-button"
              aria-label="Pet Biscuit"
              title="Give Biscuit a little pat"
              onClick={pet}
            >
              <span className="dog-look">
                <span className="dog-breathe">
                  <span className="dog-reaction" key={hearts || 'rest'}>
                    <span className="dog-rig" aria-hidden="true">
                      <img
                        className="dog-tail"
                        src={asset('biscuit-tail.png')}
                        alt=""
                        width="1280"
                        height="1280"
                        draggable="false"
                      />
                      <img
                        className="dog-body"
                        src={asset('biscuit-body.png')}
                        alt=""
                        width="1280"
                        height="1280"
                        fetchPriority="high"
                        draggable="false"
                      />
                      <span className="dog-face dog-blink">
                        <img
                          src={asset('biscuit-happy.png')}
                          alt=""
                          width="1280"
                          height="1280"
                          draggable="false"
                        />
                      </span>
                      <span className="dog-face dog-wink">
                        <img
                          src={asset('biscuit-wink.png')}
                          alt=""
                          width="1280"
                          height="1280"
                          draggable="false"
                        />
                      </span>
                      {showRose && (
                        <img
                          className="dog-rose"
                          src={asset('white-rose.png')}
                          alt=""
                          width="1024"
                          height="1536"
                          draggable="false"
                        />
                      )}
                      <span className="dog-face dog-sad">
                        <img
                          src={asset('biscuit-sad.png')}
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
              {hearts > 0 && (
                <span
                  className="pet-effect effect-pet"
                  key={hearts}
                  aria-hidden="true"
                >
                  <span>♡</span>
                  <span>♡</span>
                  <span>♡</span>
                </span>
              )}
            </button>
            <div className="name-tag">
              <span className="status-dot" aria-hidden="true" /> BISCUIT{' '}
              <span className="tag-divider">/</span> {look.feeling}
            </div>
            <p className="pet-message">Tap him. He likes it.</p>
          </div>

          <div className="note-wrap">
            <span className="tape" aria-hidden="true" />
            <article className="note">
              <div className="note-top">
                <span>FROM THE DESK OF BISCUIT</span>
                <span aria-hidden="true">♡</span>
              </div>
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

              {!done && current.bouquet && (
                <div className="bouquet" aria-label="A bouquet of white roses">
                  {[0, 1, 2].map((index) => (
                    <img
                      key={index}
                      src={asset('white-rose.png')}
                      alt=""
                      width="1024"
                      height="1536"
                      draggable="false"
                    />
                  ))}
                </div>
              )}

              {!done && current.checkIn && noteStatus !== 'sent' && (
                <form
                  className="check-in"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendNote();
                  }}
                >
                  <label htmlFor="khushi-note" className="check-in-label">
                    Tell Biscuit
                  </label>
                  <textarea
                    id="khushi-note"
                    value={note}
                    maxLength={2000}
                    rows={5}
                    placeholder="Honestly? I’ve been…"
                    onChange={(event) => {
                      setNote(event.target.value);
                      if (noteStatus === 'error') setNoteStatus('idle');
                    }}
                  />
                  <span className="check-in-count" aria-hidden="true">
                    {note.length}/2000
                  </span>
                  {noteStatus === 'error' && (
                    <p className="check-in-error" role="alert">
                      Biscuit dropped the envelope. Please try sending again.
                    </p>
                  )}
                  <div className="actions">
                    <button
                      type="submit"
                      className="primary"
                      disabled={!note.trim() || noteStatus === 'sending'}
                    >
                      {noteStatus === 'sending'
                        ? 'Sending…'
                        : 'Send to Biscuit'}
                      <span aria-hidden="true">✉</span>
                    </button>
                    <button type="button" className="secondary" onClick={next}>
                      {current.button}
                    </button>
                  </div>
                </form>
              )}

              {!done && current.checkIn && noteStatus === 'sent' && (
                <div className="check-in-thanks" role="status">
                  <p>
                    Got it. Thank you for trusting me with that, {herName}. ♡
                  </p>
                  <div className="actions">
                    <button type="button" className="primary" onClick={next}>
                      Continue
                      <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </div>
              )}

              {!current.checkIn || done ? (
                <div className="actions">
                  {done ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={restart}
                    >
                      Read it again
                    </button>
                  ) : (
                    <button type="button" className="primary" onClick={next}>
                      {current.button}
                      <span aria-hidden="true">↗</span>
                    </button>
                  )}
                </div>
              ) : null}

              <div className="note-bottom">
                <span>{content.footnote}</span>
                {!done && (
                  <div
                    className="progress"
                    role="img"
                    aria-label={`Page ${step + 1} of ${khushiStory.length}`}
                  >
                    {khushiStory.map((item, index) => (
                      <span
                        key={item.id}
                        className={index === step ? 'active' : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            </article>
            <span className="handwritten note-caption">
              written with a soft heart ♡
            </span>
          </div>
        </section>
      </main>
      <footer>
        <span>White roses, lilac skies, and one very good boy.</span>
        <span>
          Just for {herName}{' '}
          <span className="footer-heart" aria-hidden="true">
            ♡
          </span>
        </span>
      </footer>
    </div>
  );
}
