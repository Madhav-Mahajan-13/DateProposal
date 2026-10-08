import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { loadDatePlan, saveDatePlan } from '../lib/datePlanApi';
import './date-plan.css';

const foodChoices = [
  { name: 'Dosa', detail: 'crispy, obviously' },
  { name: 'Street food', detail: 'one more bite' },
  { name: 'Coffee', detail: 'make it a long one' },
];

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function DatePlanForm({ onRestart }: { onRestart: () => void }) {
  const [foods, setFoods] = useState<string[]>([]);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');
  const [itinerary, setItinerary] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [hasSavedPlan, setHasSavedPlan] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadDatePlan(controller.signal)
      .then((saved) => {
        if (controller.signal.aborted) return;
        if (saved) {
          setFoods(saved.plan.foods);
          setDay(saved.plan.day);
          setTime(saved.plan.time);
          setPlace(saved.plan.place);
          setItinerary(saved.plan.itinerary);
          setHasSavedPlan(true);
        }
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus('error');
      });
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    const title = titleRef.current;
    title?.focus({ preventScroll: true });
    const bounds = title?.getBoundingClientRect();
    if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight)) {
      title?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [submitted]);

  function toggleFood(food: string) {
    setFoods((current) =>
      current.includes(food)
        ? current.filter((item) => item !== food)
        : [...current, food],
    );
  }

  async function prepareReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadStatus !== 'ready' || isSaving) return;
    setCopyStatus('');
    setSaveError('');
    setIsSaving(true);
    try {
      await saveDatePlan({ foods, day, time, place, itinerary });
      setHasSavedPlan(true);
      setSubmitted(true);
    } catch {
      setSaveError(
        'Biscuit couldn’t save your plan just yet. Your answers are still here—please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const parsedDay = day ? new Date(`${day}T12:00:00`) : null;
  const prettyDay =
    parsedDay && Number.isFinite(parsedDay.getTime())
      ? new Intl.DateTimeFormat('en', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(parsedDay)
      : 'Let’s pick a day together';
  const reply = [
    'Yes, I’d love to go out with you! ♡',
    '',
    `On the menu: ${
      foods.length
        ? foodChoices
            .filter((food) => foods.includes(food.name))
            .map((food) => food.name)
            .join(', ')
        : 'Surprise me with something yummy'
    }`,
    `Day: ${prettyDay}`,
    `Time: ${time || 'I’m flexible'}`,
    `Meet at: ${place.trim() || 'Let’s choose a spot together'}`,
    '',
    `My little itinerary: ${itinerary.trim() || 'Surprise me — we can figure out the little details together.'}`,
    '',
    'P.S. Please give Biscuit a treat for me. 🐾',
  ].join('\n');

  async function copyReply() {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(reply);
      setCopyStatus('Copied! Paste this into your chat with him. ♡');
    } catch {
      replyRef.current?.focus();
      replyRef.current?.select();
      setCopyStatus(
        'Your note is selected. Copy it, then paste it into your chat with him.',
      );
    }
  }

  return (
    <div className="date-plan">
      <div className="plan-kicker">
        <span className="chapter">
          {submitted
            ? 'ONE LITTLE NOTE, READY TO GO'
            : 'BISCUIT’S VERY IMPORTANT OUTING NOTES'}
        </span>
        <span aria-hidden="true">♡</span>
      </div>
      <h2 ref={titleRef} tabIndex={-1}>
        {submitted ? 'Going out, your way.' : 'Yay! Let’s make it lovely.'}
      </h2>
      {submitted ? (
        <>
          <p className="plan-intro">
            Your little plan is saved in Biscuit’s notebook. Let the happy
            planning begin.
          </p>
          <div className="reply-envelope">
            <span className="handwritten reply-caption">
              a yes, with a few little wishes…
            </span>
            <label htmlFor="date-reply" className="plan-label">
              Your reply
            </label>
            <textarea
              id="date-reply"
              ref={replyRef}
              className="date-reply"
              value={reply}
              readOnly
              rows={12}
            />
          </div>
          <div className="actions plan-actions">
            <button
              type="button"
              className="primary"
              onClick={() => void copyReply()}
            >
              Copy my reply <span aria-hidden="true">♡</span>
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSubmitted(false);
                setCopyStatus('');
              }}
            >
              Edit my plan
            </button>
          </div>
          <p className="copy-status" role="status">
            {copyStatus}
          </p>
          <p className="plan-delivery-note">
            Saved for next time. You can copy a reply to send him, too.
          </p>
          <button type="button" className="plan-restart" onClick={onRestart}>
            Read Biscuit’s invitation again
          </button>
        </>
      ) : (
        <>
          <p className="plan-intro">
            Any special little itinerary in mind?
            <br />
            You dream it up. Biscuit will take notes.
          </p>
          {loadStatus === 'loading' && (
            <p className="plan-storage-status" role="status">
              Biscuit is checking his notebook…
            </p>
          )}
          {loadStatus === 'ready' && hasSavedPlan && (
            <p className="plan-storage-status" role="status">
              Your saved plan is here. Change anything you like. ♡
            </p>
          )}
          {loadStatus === 'error' && (
            <div className="plan-storage-error" role="alert">
              Biscuit couldn’t find his notebook. Please try again before
              filling in your plan.
              <button
                type="button"
                onClick={() => {
                  setLoadStatus('loading');
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Try again
              </button>
            </div>
          )}
          <form
            onSubmit={(event) => void prepareReply(event)}
            className="date-plan-form"
            aria-busy={isSaving || loadStatus === 'loading'}
          >
            <fieldset
              className="plan-inputs"
              disabled={loadStatus !== 'ready' || isSaving}
            >
              <fieldset className="food-fieldset">
                <legend>What are we craving?</legend>
                <p className="field-hint" id="food-hint">
                  Pick one, two, or make it a whole food adventure.
                </p>
                <div className="food-options" aria-describedby="food-hint">
                  {foodChoices.map((food) => (
                    <label
                      key={food.name}
                      className={`food-option ${foods.includes(food.name) ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        name="food"
                        value={food.name}
                        checked={foods.includes(food.name)}
                        onChange={() => toggleFood(food.name)}
                      />
                      <span className="food-check" aria-hidden="true">
                        {foods.includes(food.name) ? '✓' : '+'}
                      </span>
                      <span className="food-name">{food.name}</span>
                      <span className="food-detail">{food.detail}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="plan-field-row">
                <label className="plan-field" htmlFor="date-day">
                  <span>A day that feels right</span>
                  <input
                    id="date-day"
                    name="day"
                    type="date"
                    min={localToday()}
                    max="9999-12-31"
                    value={day}
                    onChange={(event) => setDay(event.target.value)}
                  />
                </label>
                <label className="plan-field" htmlFor="date-time">
                  <span>And the time?</span>
                  <select
                    id="date-time"
                    name="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  >
                    <option value="">I’m flexible</option>
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                  </select>
                </label>
              </div>
              <label className="plan-field" htmlFor="date-place">
                <span>Got a favorite little spot?</span>
                <input
                  id="date-place"
                  name="place"
                  type="text"
                  maxLength={160}
                  placeholder="That dosa place, a cozy café, your favorite street…"
                  value={place}
                  onChange={(event) => setPlace(event.target.value)}
                />
              </label>
              <label className="plan-field" htmlFor="date-itinerary">
                <span>
                  Your perfect little itinerary{' '}
                  <span className="handwritten">the fun part ♡</span>
                </span>
                <textarea
                  id="date-itinerary"
                  name="itinerary"
                  maxLength={1500}
                  rows={4}
                  placeholder="Dosa first, a stroll past the street-food stalls, then coffee… or something completely different?"
                  value={itinerary}
                  onChange={(event) => setItinerary(event.target.value)}
                />
              </label>
              <p className="plan-optional">
                No perfect plan needed. Leave anything blank and we’ll figure it
                out together.
              </p>
              <div className="actions plan-actions">
                <button type="submit" className="primary">
                  {isSaving
                    ? 'Biscuit is jotting it down…'
                    : 'Save my little plan'}{' '}
                  <span aria-hidden="true">♡</span>
                </button>
              </div>
            </fieldset>
            {saveError && (
              <p className="plan-storage-error" role="alert">
                {saveError}
              </p>
            )}
            <p className="plan-delivery-note">
              Biscuit will remember your answers on this browser when you save.
            </p>
          </form>
        </>
      )}
    </div>
  );
}
