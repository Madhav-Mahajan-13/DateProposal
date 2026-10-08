import { useEffect, useState } from 'react';
import type { SavedResponse } from '../lib/datePlanApi';
import './admin.css';

function formatDate(value: string, includeTime = false) {
  const date = new Date(includeTime ? value : `${value}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

export default function AdminPage() {
  const [entries, setEntries] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState('');

  async function clearEntries() {
    if (loading || clearing || !entries.length) return;
    if (
      !window.confirm(
        'Clear all saved entries? This cannot be undone. Her form will no longer be prefilled with these answers.',
      )
    )
      return;
    setClearing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin-44444/entries', {
        method: 'DELETE',
        headers: { 'X-Confirm-Clear': 'all-entries' },
      });
      if (!response.ok) throw new Error('Could not clear entries');
      setEntries([]);
      setNotice('All saved entries have been cleared.');
    } catch {
      setError('Could not clear the entries. Please try again.');
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    document.title = 'Biscuit’s notebook | Saved plans';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin-44444/entries', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load entries');
        const data: { entries: SavedResponse[] } = await response.json();
        if (!controller.signal.aborted) setEntries(data.entries);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Biscuit couldn’t open his notebook. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  return (
    <div className="page admin-page">
      <header className="masthead">
        <a className="wordmark" href="/">
          a little hello
        </a>
        <span className="stamp">BISCUIT’S NOTEBOOK ♡</span>
      </header>
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">THE NEXT CHAPTER</span>
            <h1>
              Her little <em>answers.</em>
            </h1>
            <p>All the lovely details, saved in one place.</p>
          </div>
          <div className="admin-controls">
            <button
              className="secondary"
              disabled={loading || clearing}
              onClick={() => {
                setLoading(true);
                setError('');
                setNotice('');
                setRevision((value) => value + 1);
              }}
            >
              {loading ? 'Checking…' : 'Refresh entries'}
            </button>
            <button
              className="secondary admin-clear"
              disabled={loading || clearing || entries.length === 0}
              onClick={() => void clearEntries()}
            >
              {clearing ? 'Clearing…' : 'Clear all entries'}
            </button>
          </div>
        </div>
        <p className="admin-count" role="status">
          {loading
            ? 'Biscuit is checking his notebook…'
            : `${entries.length} saved ${entries.length === 1 ? 'entry' : 'entries'} · Latest updates first`}
        </p>
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && entries.length === 0 && (
          <section className="admin-empty">
            <span aria-hidden="true">♡</span>
            <h2>A little anticipation.</h2>
            <p>Her saved plan or final no will appear here.</p>
          </section>
        )}
        <div className="admin-entries" aria-busy={loading}>
          {entries.map(({ plan, updatedAt, outcome }, index) => (
            <article className="admin-entry" key={`${updatedAt}-${index}`}>
              <div className="admin-entry-heading">
                <h2>
                  {outcome === 'declined'
                    ? 'She said no, thank you'
                    : 'She said yes to going out'}{' '}
                  <span aria-hidden="true">♡</span>
                </h2>
                <p>
                  Last saved{' '}
                  <time dateTime={updatedAt}>
                    {formatDate(updatedAt, true)}
                  </time>
                </p>
              </div>
              {plan ? (
                <dl>
                  <div className="admin-wide">
                    <dt>On the menu</dt>
                    <dd>
                      {plan.foods.length
                        ? plan.foods.map((food) => (
                            <span className="admin-food" key={food}>
                              {food}
                            </span>
                          ))
                        : 'Surprise me'}
                    </dd>
                  </div>
                  <div>
                    <dt>A day that feels right</dt>
                    <dd>
                      {plan.day
                        ? formatDate(plan.day)
                        : 'Let’s choose together'}
                    </dd>
                  </div>
                  <div>
                    <dt>And the time?</dt>
                    <dd>{plan.time || 'Flexible'}</dd>
                  </div>
                  <div className="admin-wide">
                    <dt>Her favorite little spot</dt>
                    <dd>{plan.place.trim() || 'Let’s choose together'}</dd>
                  </div>
                  <div className="admin-wide admin-itinerary">
                    <dt>Her perfect little itinerary</dt>
                    <dd>
                      {plan.itinerary.trim() ||
                        'Surprise me — we’ll figure out the details together.'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p>
                  She chose “Still no, thank you.” No outing plan was submitted.
                </p>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
