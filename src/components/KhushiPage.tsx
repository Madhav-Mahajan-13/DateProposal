import { useEffect, useRef, useState } from 'react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { beats, ending, envelope, herName } from '../content/khushi';
import type { Item, Mood, ReplyOption, Sky } from '../content/khushi';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { saveNote } from '../lib/noteApi';
import { isMuted, play, setMuted } from '../lib/softSound';
import './khushi.css';

const asset = (name: string) => `${import.meta.env.BASE_URL}mascot/${name}`;
const faces: Record<Exclude<Mood, 'open'>, string> = {
  happy: asset('biscuit-happy.png'),
  wink: asset('biscuit-wink.png'),
  sad: asset('biscuit-sad.png'),
  teary: asset('biscuit-teary.png'),
};
const rose = asset('white-rose.png');
// Randomness and clocks for decorative effects (only used in event handlers).
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clock = () => performance.now();
const isMessage = (
  item: Item | undefined,
): item is Extract<Item, { text: string }> => Boolean(item && 'text' in item);

// Where the dropped roses land in the scene (percent of the scene box).
const roseSpots = [
  { left: 9, top: 22, tilt: -24 },
  { left: 80, top: 14, tilt: 18 },
  { left: 74, top: 62, tilt: -8 },
];
const clouds = [
  { left: 4, top: 6, size: 1 },
  { left: 62, top: 2, size: 1.25 },
  { left: 34, top: 14, size: 0.8 },
  { left: 80, top: 24, size: 0.9 },
];

export default function KhushiPage() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'envelope' | 'opening' | 'story'>(
    'envelope',
  );
  const [beat, setBeat] = useState(0);
  const [queue, setQueue] = useState<Item[]>(beats[0].messages);
  const [pos, setPos] = useState(0);
  const [run, setRun] = useState(0);
  const [baseMood, setBaseMood] = useState<Mood>('happy');
  const [typed, setTyped] = useState({ key: '', n: 0 });
  const [herLine, setHerLine] = useState<{ id: number; text: string } | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [flying, setFlying] = useState(false);
  const [tears, setTears] = useState(0);
  const [picked, setPicked] = useState([false, false, false]);
  const [popped, setPopped] = useState<number[]>([]);
  const [hugging, setHugging] = useState(false);
  const [hop, setHop] = useState(0);
  const [muted, setMutedState] = useState(isMuted);
  const fxRef = useRef<HTMLDivElement>(null);
  const dogRef = useRef<HTMLButtonElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const rubbed = useRef(0);
  const lastTrail = useRef(0);

  const key = `${run}:${pos}`;
  const current = queue[pos] as Item | undefined;
  const gate = current && 'gate' in current ? current : null;
  const lastShown = [...queue.slice(0, pos + 1)].reverse().find(isMessage);
  const bubbleText = gate ? gate.prompt : (lastShown?.text ?? '');
  const animatingText = isMessage(current) || Boolean(gate);
  const shown =
    reducedMotion || !animatingText
      ? bubbleText.length
      : typed.key === key
        ? Math.min(typed.n, bubbleText.length)
        : 0;
  const doneTyping = shown >= bubbleText.length;
  const reply = !current && beat < beats.length ? beats[beat].reply : null;
  const finished = !current && beat >= beats.length;
  const sky: Sky =
    phase !== 'story'
      ? 'night'
      : finished
        ? 'morning'
        : beats[Math.min(beat, beats.length - 1)].sky;
  const stormy = sky === 'storm' || sky === 'dusk';
  const mood: Mood =
    gate?.gate === 'tears'
      ? tears >= 1
        ? 'open'
        : 'teary'
      : hugging
        ? 'happy'
        : ((
            [...queue.slice(0, pos + 1)]
              .reverse()
              .find((item) => isMessage(item) && item.mood) as
              { mood: Mood } | undefined
          )?.mood ?? baseMood);
  const bouquetReady = picked.every(Boolean);
  const journey = finished ? beats.length : beat;

  useEffect(() => {
    document.title = `for ${herName.toLowerCase()} 🤍`;
    document.documentElement.classList.add('theme-khushi');
    for (const src of [...Object.values(faces), rose]) new Image().src = src;
    return () => document.documentElement.classList.remove('theme-khushi');
  }, []);

  // Typewriter: Biscuit "speaks" each line.
  useEffect(() => {
    if (phase !== 'story' || reducedMotion || !animatingText) return;
    play('pop');
    let count = 0;
    const length = bubbleText.length;
    const timer = setInterval(() => {
      count += 1;
      setTyped((value) => ({
        key,
        n: value.key === key ? Math.max(value.n, count) : count,
      }));
      if (count % 4 === 0) play('tick');
      if (count >= length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [key, phase, reducedMotion, animatingText, bubbleText]);

  // Let the story breathe forward by itself after a moment of reading.
  useEffect(() => {
    if (phase !== 'story' || !isMessage(current) || !doneTyping) return;
    const timer = setTimeout(
      () => setPos((value) => value + 1),
      1700 + current.text.length * 38,
    );
    return () => clearTimeout(timer);
  }, [phase, current, doneTyping, key]);

  function next() {
    if (phase !== 'story' || !isMessage(current)) return;
    if (!doneTyping) setTyped({ key, n: bubbleText.length });
    else setPos((value) => value + 1);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('button, textarea, input, a')) return;
      if (
        event.key === ' ' ||
        event.key === 'Enter' ||
        event.key === 'ArrowRight'
      ) {
        event.preventDefault();
        next();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function startQueue(items: Item[], nextBeat: number) {
    setBaseMood(mood);
    setQueue(items);
    setPos(0);
    setRun((value) => value + 1);
    setBeat(nextBeat);
  }

  function say(text: string) {
    setHerLine({ id: clock(), text });
  }

  // ----- little effects -----
  function spawn(
    className: string,
    x: number,
    y: number,
    content: string,
    dx = 0,
    dy = -120,
  ) {
    const layer = fxRef.current;
    if (!layer || reducedMotion) return;
    const element = document.createElement('span');
    element.className = className;
    element.textContent = content;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.setProperty('--dx', `${dx}px`);
    element.style.setProperty('--dy', `${dy}px`);
    element.style.setProperty('--r', `${rand(-40, 40)}deg`);
    layer.append(element);
    element.addEventListener('animationend', () => element.remove(), {
      once: true,
    });
  }

  function hearts(x: number, y: number, count = 5, spread = 90) {
    for (let index = 0; index < count; index++)
      spawn(
        'kh-fx-heart',
        x,
        y,
        index % 3 ? '🤍' : '💜',
        rand(-spread, spread),
        -80 - rand(0, spread * 1.6),
      );
  }

  function dogCenter() {
    const box = dogRef.current?.getBoundingClientRect();
    return box
      ? { x: box.left + box.width / 2, y: box.top + box.height * 0.35 }
      : { x: innerWidth / 2, y: innerHeight / 2 };
  }

  function trail(event: ReactPointerEvent) {
    const stage = tiltRef.current;
    if (stage) {
      const offset = event.clientX / innerWidth - 0.5;
      stage.style.setProperty('--look', `${offset * 7}deg`);
      stage.style.setProperty('--lean', `${offset * 14}px`);
    }
    const now = clock();
    if (now - lastTrail.current < 55) return;
    lastTrail.current = now;
    spawn(
      'kh-fx-petal',
      event.clientX,
      event.clientY,
      '',
      rand(-20, 20),
      rand(40, 80),
    );
  }

  // ----- Biscuit -----
  function addTears(amount: number) {
    if (gate?.gate !== 'tears' || tears >= 1) return;
    const value = Math.min(1, tears + amount);
    setTears(value);
    if (value >= 1) {
      play('chime');
      const { x, y } = dogCenter();
      hearts(x, y, 10, 120);
      setTimeout(() => setPos((p) => p + 1), reducedMotion ? 0 : 700);
    }
  }

  function petDog(event: ReactMouseEvent<HTMLButtonElement> | null) {
    setHop((value) => value + 1);
    play('boop');
    const { x, y } =
      event && event.detail > 0
        ? { x: event.clientX, y: event.clientY }
        : dogCenter();
    hearts(x, y, 4);
    addTears(0.34);
  }

  function rubDog(event: ReactPointerEvent<HTMLButtonElement>) {
    if (gate?.gate !== 'tears') return;
    rubbed.current += Math.abs(event.movementX) + Math.abs(event.movementY);
    if (rubbed.current > 140) {
      rubbed.current = 0;
      spawn('kh-fx-sparkle', event.clientX, event.clientY, '✧', 0, -50);
      play('tick');
      addTears(0.12);
    }
  }

  // ----- interactions -----
  function pickRose(index: number, event: ReactMouseEvent<HTMLButtonElement>) {
    if (picked[index]) return;
    const nextPicked = picked.map((value, i) => value || i === index);
    setPicked(nextPicked);
    play('pop');
    hearts(event.clientX, event.clientY, 3, 50);
    if (nextPicked.every(Boolean))
      setTimeout(
        () => {
          play('chime');
          setPos((p) => p + 1);
        },
        reducedMotion ? 0 : 800,
      );
  }

  function popCloud(index: number, event: ReactMouseEvent<HTMLButtonElement>) {
    setPopped((value) => [...value, index]);
    play('puff');
    for (let i = 0; i < 6; i++)
      spawn(
        'kh-fx-puff',
        event.clientX,
        event.clientY,
        '',
        Math.cos(i) * 60,
        Math.sin(i) * 60,
      );
  }

  function choose(option: ReplyOption) {
    play('boop');
    say(option.label);
    startQueue(
      [...(option.followUp ?? []), ...(beats[beat + 1]?.messages ?? [])],
      beat + 1,
    );
  }

  async function sendNote() {
    const current = beats[beat]?.reply;
    const text = note.trim();
    if (current?.kind !== 'note' || !text || flying) return;
    setFlying(true);
    play('whoosh');
    const flight = new Promise((resolve) =>
      setTimeout(resolve, reducedMotion ? 0 : 1300),
    );
    try {
      await Promise.all([saveNote(text), flight]);
      setNote('');
      setFlying(false);
      say('sent 📨');
      startQueue(
        [...current.thanks, ...(beats[beat + 1]?.messages ?? [])],
        beat + 1,
      );
    } catch {
      await flight;
      setFlying(false);
      startQueue(current.failed, beat);
    }
  }

  function hugDone() {
    const current = beats[beat]?.reply;
    if (current?.kind !== 'hug') return;
    play('chime');
    const { x, y } = dogCenter();
    hearts(x, y, 34, 260);
    say(current.label);
    startQueue(current.followUp, beat + 1);
  }

  function openEnvelope() {
    if (phase !== 'envelope') return;
    setPhase('opening');
    play('chime');
    setTimeout(() => setPhase('story'), reducedMotion ? 0 : 1300);
  }

  function restart() {
    setPhase('envelope');
    setBeat(0);
    setQueue(beats[0].messages);
    setPos(0);
    setRun((value) => value + 1);
    setBaseMood('happy');
    setHerLine(null);
    setTears(0);
    setPicked([false, false, false]);
    setPopped([]);
    setNote('');
  }

  function toggleSound() {
    setMuted(!muted);
    setMutedState(!muted);
    if (muted) play('pop');
  }

  return (
    <div
      className="kh-stage"
      data-sky={sky}
      data-phase={phase}
      onPointerMove={reducedMotion ? undefined : trail}
    >
      <Backdrop sky={sky} bloom={journey} />

      <div className="kh-topbar">
        <ol
          className="kh-journey"
          aria-label={`Chapter ${Math.min(journey + 1, beats.length)} of ${beats.length}`}
        >
          {beats.map((_, index) => (
            <li
              key={index}
              className={
                index < journey ? 'is-done' : index === journey ? 'is-here' : ''
              }
            >
              <span aria-hidden="true">🐾</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="kh-sound"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {phase !== 'story' ? (
        <div
          className="kh-envelope-scene"
          onPointerMove={(event) => {
            const box = envelopeRef.current;
            if (!box || reducedMotion) return;
            box.style.setProperty(
              '--rx',
              `${(event.clientY / innerHeight - 0.5) * -14}deg`,
            );
            box.style.setProperty(
              '--ry',
              `${(event.clientX / innerWidth - 0.5) * 18}deg`,
            );
          }}
        >
          <div
            ref={envelopeRef}
            className={`kh-envelope ${phase === 'opening' ? 'is-opening' : ''}`}
          >
            <img
              className="kh-peek"
              src={faces.happy}
              alt=""
              width="1280"
              height="1280"
              draggable="false"
            />
            <div className="kh-envelope-back" aria-hidden="true" />
            <div className="kh-letter" aria-hidden="true">
              <span>hi {herName.toLowerCase()} 🤍</span>
            </div>
            <div className="kh-envelope-front">
              <p className="kh-to">{envelope.to}</p>
              <p className="kh-from">{envelope.from}</p>
            </div>
            <div className="kh-flap" aria-hidden="true" />
            <button
              type="button"
              className="kh-seal"
              onClick={openEnvelope}
              aria-label={`Open the letter ${envelope.to}`}
            >
              K
            </button>
          </div>
          <p className="kh-hint" aria-hidden="true">
            tap the seal to {envelope.open} <span>✨</span>
          </p>
        </div>
      ) : (
        <>
          <div
            className="kh-scene"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button, textarea'))
                return;
              next();
            }}
          >
            {stormy &&
              clouds.map(
                (cloud, index) =>
                  !popped.includes(index) && (
                    <button
                      type="button"
                      key={index}
                      className="kh-cloud"
                      style={
                        {
                          left: `${cloud.left}%`,
                          top: `${cloud.top}%`,
                          '--s': cloud.size,
                          '--i': index,
                        } as CSSProperties
                      }
                      onClick={(event) => popCloud(index, event)}
                      aria-label="Tap the cloud away"
                    >
                      <span className="kh-cloud-body" aria-hidden="true">
                        ☁
                      </span>
                      <span className="kh-rain" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    </button>
                  ),
              )}
            {stormy && popped.length < clouds.length && beat === 1 && (
              <p className="kh-toast">psst… you can tap the clouds away ☁</p>
            )}

            {gate?.gate === 'roses' &&
              roseSpots.map(
                (spot, index) =>
                  !picked[index] && (
                    <button
                      type="button"
                      key={index}
                      className="kh-loose-rose"
                      style={
                        {
                          left: `${spot.left}%`,
                          top: `${spot.top}%`,
                          '--tilt': `${spot.tilt}deg`,
                          '--i': index,
                        } as CSSProperties
                      }
                      onClick={(event) => pickRose(index, event)}
                      aria-label={`Pick up white rose ${index + 1}`}
                    >
                      <img
                        src={rose}
                        alt=""
                        width="1024"
                        height="1536"
                        draggable="false"
                      />
                    </button>
                  ),
              )}

            <div className="kh-bubble-wrap" aria-hidden="true">
              <div key={key} className={`kh-bubble ${gate ? 'is-gate' : ''}`}>
                <p>
                  {bubbleText.slice(0, shown)}
                  {!doneTyping && <span className="kh-caret" />}
                  <span className="kh-ghost">{bubbleText.slice(shown)}</span>
                </p>
                {isMessage(current) && doneTyping && (
                  <span className="kh-next-hint">tap ▸</span>
                )}
              </div>
            </div>
            <p className="kh-sr" aria-live="polite">
              {bubbleText}
            </p>

            {herLine && (
              <p key={herLine.id} className="kh-her" aria-hidden="true">
                {herLine.text}
              </p>
            )}

            <div className="kh-dog-zone" ref={tiltRef}>
              <button
                ref={dogRef}
                type="button"
                className="kh-dog"
                data-mood={mood}
                data-hugging={hugging || undefined}
                data-rubbing={gate?.gate === 'tears' || undefined}
                style={{ '--wipe': tears } as CSSProperties}
                onClick={(event) => petDog(event)}
                onPointerMove={rubDog}
                aria-label={
                  gate?.gate === 'tears'
                    ? 'Pat Biscuit to cheer him up'
                    : 'Pet Biscuit'
                }
              >
                <span className="kh-dog-hop" key={hop}>
                  <span className="kh-dog-breathe">
                    <span className="kh-rig" aria-hidden="true">
                      <img
                        className="kh-tail"
                        src={asset('biscuit-tail.png')}
                        alt=""
                        width="1280"
                        height="1280"
                        draggable="false"
                      />
                      <img
                        className="kh-body"
                        src={asset('biscuit-body.png')}
                        alt=""
                        width="1280"
                        height="1280"
                        draggable="false"
                      />
                      {(Object.keys(faces) as (keyof typeof faces)[]).map(
                        (face) => (
                          <span
                            key={face}
                            className={`kh-face kh-face--${face}`}
                          >
                            <img
                              src={faces[face]}
                              alt=""
                              width="1280"
                              height="1280"
                              draggable="false"
                            />
                          </span>
                        ),
                      )}
                      <span className="kh-blush" />
                    </span>
                  </span>
                </span>
              </button>
              {bouquetReady && (
                <div
                  className="kh-bouquet"
                  aria-label="Your bouquet of white roses"
                >
                  {[0, 1, 2].map((index) => (
                    <img
                      key={index}
                      src={rose}
                      alt=""
                      width="1024"
                      height="1536"
                      draggable="false"
                    />
                  ))}
                </div>
              )}
              <div className="kh-shadow" aria-hidden="true" />
            </div>
          </div>

          <div className="kh-controls">
            {gate?.gate === 'tears' && (
              <div className="kh-gate">
                <div className="kh-meter" aria-hidden="true">
                  <span style={{ width: `${tears * 100}%` }} />
                </div>
                <button
                  type="button"
                  className="kh-chip"
                  onClick={() => petDog(null)}
                >
                  pat his head 🫳
                </button>
              </div>
            )}
            {gate?.gate === 'roses' && (
              <p className="kh-gate-note">
                {picked.filter(Boolean).length} / 3 roses
              </p>
            )}
            {reply?.kind === 'chips' && (
              <div
                className="kh-chips"
                role="group"
                aria-label="Reply to Biscuit"
              >
                {reply.options.map((option, index) => (
                  <button
                    type="button"
                    key={option.label}
                    className="kh-chip"
                    style={{ '--i': index } as CSSProperties}
                    onClick={() => choose(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {reply?.kind === 'note' && (
              <form
                className={`kh-paper ${flying ? 'is-flying' : ''}`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendNote();
                }}
              >
                <label className="kh-sr" htmlFor="kh-note">
                  Tell Biscuit how you’re really doing
                </label>
                <textarea
                  id="kh-note"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  placeholder={reply.placeholder}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={flying}
                />
                <div className="kh-paper-row">
                  <button
                    type="button"
                    className="kh-skip"
                    onClick={() => choose(reply.skip)}
                    disabled={flying}
                  >
                    {reply.skip.label}
                  </button>
                  <button
                    type="submit"
                    className="kh-send"
                    disabled={!note.trim() || flying}
                  >
                    {flying ? 'flying to him…' : 'fold & send'}{' '}
                    <span aria-hidden="true">✈</span>
                  </button>
                </div>
                {flying && (
                  <span className="kh-plane" aria-hidden="true">
                    ✈
                  </span>
                )}
              </form>
            )}
            {reply?.kind === 'hug' && (
              <HoldToHug
                label={reply.label}
                prompt={reply.prompt}
                onHolding={setHugging}
                onDone={hugDone}
              />
            )}
            {finished && (
              <div className="kh-finished">
                <p>{ending.signoff}</p>
                <button type="button" className="kh-chip" onClick={restart}>
                  {ending.restart} ↺
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {finished && !reducedMotion && (
        <div className="kh-rose-rain" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <img
              key={index}
              src={rose}
              alt=""
              style={{ '--i': index } as CSSProperties}
            />
          ))}
        </div>
      )}
      <div className="kh-fx" ref={fxRef} aria-hidden="true" />
    </div>
  );
}

function Backdrop({ sky, bloom }: { sky: Sky; bloom: number }) {
  const open = Math.round((bloom + 0.6) * 1.6);
  return (
    <div className="kh-backdrop" aria-hidden="true">
      {(['night', 'storm', 'dusk', 'dawn', 'morning'] as const).map((layer) => (
        <div
          key={layer}
          className={`kh-sky kh-sky--${layer} ${layer === sky ? 'is-on' : ''}`}
        />
      ))}
      <div className="kh-stars">
        {Array.from({ length: 28 }, (_, index) => (
          <span key={index} style={{ '--i': index } as CSSProperties} />
        ))}
      </div>
      <div className="kh-moon" />
      <div className="kh-sun" />
      <div className="kh-hill">
        {Array.from({ length: 11 }, (_, index) => (
          <span
            key={index}
            className={`kh-flower ${index < open ? 'is-open' : ''}`}
            style={{ '--i': index } as CSSProperties}
          >
            <span />
          </span>
        ))}
      </div>
    </div>
  );
}

function HoldToHug({
  label,
  prompt,
  onHolding,
  onDone,
}: {
  label: string;
  prompt: string;
  onHolding: (holding: boolean) => void;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const done = useRef(false);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function begin() {
    if (done.current) return;
    cancelAnimationFrame(frame.current);
    const start = clock();
    onHolding(true);
    play('boop');
    const tick = (now: number) => {
      const value = Math.min(1, (now - start) / 1500);
      setProgress(value);
      if (value >= 1) {
        done.current = true;
        onHolding(false);
        onDone();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  function cancel() {
    if (done.current) return;
    cancelAnimationFrame(frame.current);
    setProgress(0);
    onHolding(false);
  }

  const circumference = 2 * Math.PI * 30;
  return (
    <div className="kh-hug">
      <button
        type="button"
        className="kh-hug-button"
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
            event.preventDefault();
            begin();
          }
        }}
        onKeyUp={cancel}
        aria-label={`${label}. ${prompt}`}
      >
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="30" className="kh-hug-track" />
          <circle
            cx="36"
            cy="36"
            r="30"
            className="kh-hug-fill"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <span aria-hidden="true">🤗</span>
      </button>
      <p>
        <strong>{label}</strong>
        <span>{progress > 0 ? 'keep holding…' : prompt}</span>
      </p>
    </div>
  );
}
