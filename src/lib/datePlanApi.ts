export interface DatePlan {
  foods: string[];
  day: string;
  time: string;
  place: string;
  itinerary: string;
}

export interface SavedDatePlan {
  plan: DatePlan;
  updatedAt: string;
}

async function request(init?: RequestInit): Promise<SavedDatePlan | null> {
  const response = await fetch('/api/response', {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
  });
  if (!response.ok) throw new Error('Unable to open Biscuit’s notebook.');
  const body = (await response.json()) as { response: SavedDatePlan | null };
  return body.response;
}

export function loadDatePlan(signal: AbortSignal) {
  return request({ signal });
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
