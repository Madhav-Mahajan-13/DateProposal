export interface DatePlan {
  foods: string[];
  day: string;
  time: string;
  place: string;
  itinerary: string;
}

export interface SavedDatePlan {
  outcome?: 'accepted';
  plan: DatePlan;
  updatedAt: string;
}

export type SavedResponse =
  | SavedDatePlan
  | {
      outcome: 'declined';
      plan: null;
      updatedAt: string;
    };

async function request(init?: RequestInit): Promise<SavedResponse | null> {
  const response = await fetch('/api/response', {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) throw new Error('Unable to open Biscuit’s notebook.');
  const body = (await response.json()) as { response: SavedResponse | null };
  return body.response;
}

export async function loadDatePlan(signal: AbortSignal) {
  const saved = await request({ signal });
  return saved?.outcome === 'declined' ? null : saved;
}
export async function saveDecline() {
  const saved = await request({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'declined' }),
  });
  if (saved?.outcome !== 'declined')
    throw new Error('Your answer could not be saved.');
}
export async function saveDatePlan(plan: DatePlan) {
  const saved = await request({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  if (!saved) throw new Error('Your plan could not be saved.');
  return saved;
}
