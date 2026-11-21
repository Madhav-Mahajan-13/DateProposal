import { useEffect, useMemo, useState } from 'react';
import type { Visit } from '../lib/trackVisit';
import './admin.css';
import './visits.css';

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));

const resolution = (v: Visit) =>
  v.screen.width && v.screen.height
    ? `${v.screen.width}×${v.screen.height}`
    : 'Unknown';

function countBy(visits: Visit[], key: (v: Visit) => string) {
  const counts = new Map<string, number>();
  for (const visit of visits)
    counts.set(key(visit), (counts.get(key(visit)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: [string, number][];
  total: number;
}) {
  return (
    <section className="visits-card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="visits-muted">No data yet.</p>
      ) : (
        <ul className="visits-bars">
          {rows.slice(0, 6).map(([label, count]) => (
            <li key={label}>
              <div className="visits-bar-label">
                <span>{label}</span>
                <span>
                  {count} · {Math.round((count / total) * 100)}%
                </span>
              </div>
              <div className="visits-bar-track">
                <div
                  className="visits-bar-fill"
                  style={{ width: `${(count / rows[0][1]) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState('');
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    document.title = 'Visitor log';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin-44444/visits', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load visits');
        const data: { visits: Visit[] } = await response.json();
        if (!controller.signal.aborted) setVisits(data.visits);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load the visitor log. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  async function clearVisits() {
    if (!window.confirm('Delete the whole visitor log? This cannot be undone.'))
      return;
    setClearing(true);
    try {
      const response = await fetch('/api/admin-44444/visits', {
        method: 'DELETE',
        headers: { 'X-Confirm-Clear': 'all-visits' },
      });
      if (!response.ok) throw new Error();
      setVisits([]);
    } catch {
      setError('Could not clear the log. Please try again.');
    } finally {
      setClearing(false);
    }
  }

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      uniqueIps: new Set(visits.map((v) => v.ip)).size,
      today: visits.filter(
        (v) => new Date(v.visitedAt).toDateString() === today,
      ).length,
      last: visits[0]?.visitedAt,
      devices: countBy(visits, (v) => v.deviceType),
      os: countBy(visits, (v) => v.os),
      pages: countBy(visits, (v) => v.page),
      screens: countBy(visits, resolution),
    };
  }, [visits]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((v) =>
      [
        v.ip,
        v.page,
        v.os,
        v.browser,
        v.deviceType,
        resolution(v),
        v.city,
        v.country,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [visits, filter]);

  return (
    <div className="page admin-page visits-page">
      <header className="masthead">
        <a className="wordmark" href="/admin-44444">
          ← saved plans
        </a>
        <span className="stamp">VISITOR LOG</span>
      </header>
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">WHO STOPPED BY</span>
            <h1>
              Visitor <em>log.</em>
            </h1>
            <p>Every page load, newest first.</p>
          </div>
          <div className="admin-controls">
            <button
              className="secondary"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setError('');
                setRevision((r) => r + 1);
              }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              className="secondary admin-clear"
              disabled={loading || clearing || visits.length === 0}
              onClick={() => void clearVisits()}
            >
              {clearing ? 'Clearing…' : 'Clear log'}
            </button>
          </div>
        </div>

        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}

        <div className="visits-kpis" aria-busy={loading}>
          <div className="visits-card">
            <span>Total visits</span>
            <strong>{visits.length}</strong>
          </div>
          <div className="visits-card">
            <span>Unique IPs</span>
            <strong>{stats.uniqueIps}</strong>
          </div>
          <div className="visits-card">
            <span>Today</span>
            <strong>{stats.today}</strong>
          </div>
          <div className="visits-card">
            <span>Last visit</span>
            <strong className="visits-kpi-small">
              {stats.last ? formatTime(stats.last) : '—'}
            </strong>
          </div>
        </div>

        <div className="visits-grid">
          <Breakdown
            title="Device type"
            rows={stats.devices}
            total={visits.length}
          />
          <Breakdown
            title="Operating system"
            rows={stats.os}
            total={visits.length}
          />
          <Breakdown
            title="Pages visited"
            rows={stats.pages}
            total={visits.length}
          />
          <Breakdown
            title="Screen resolution"
            rows={stats.screens}
            total={visits.length}
          />
        </div>

        <section className="visits-card visits-table-card">
          <div className="visits-table-head">
            <h2>All visits</h2>
            <input
              type="search"
              placeholder="Filter by IP, page, OS…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter visits"
            />
          </div>
          <div className="visits-table-scroll">
            <table className="visits-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Public IP</th>
                  <th>Page</th>
                  <th>Device</th>
                  <th>OS</th>
                  <th>Browser</th>
                  <th>Screen</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((v) => (
                  <tr key={v.id} title={v.userAgent}>
                    <td>
                      <time dateTime={v.visitedAt}>
                        {formatTime(v.visitedAt)}
                      </time>
                    </td>
                    <td className="visits-mono">{v.ip || '—'}</td>
                    <td className="visits-mono">{v.page}</td>
                    <td>
                      <span
                        className={`visits-chip visits-chip--${v.deviceType}`}
                      >
                        {v.deviceType}
                      </span>
                    </td>
                    <td>{v.os}</td>
                    <td>{v.browser}</td>
                    <td className="visits-mono">
                      {resolution(v)}
                      {v.screen.pixelRatio && v.screen.pixelRatio !== 1
                        ? ` @${v.screen.pixelRatio}x`
                        : ''}
                    </td>
                    <td>
                      {[v.city, v.country].filter(Boolean).join(', ') ||
                        v.timezone ||
                        '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && shown.length === 0 && (
              <p className="visits-muted visits-empty">
                {visits.length
                  ? 'No visits match that filter.'
                  : 'No visits logged yet.'}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
