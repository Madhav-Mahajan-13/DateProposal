export interface SavedNote {
  message: string;
  updatedAt: string;
}

export async function saveNote(message: string): Promise<SavedNote> {
  const response = await fetch('/api/note', {
    method: 'PUT',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error('Your note could not be sent.');
  const body = (await response.json()) as { note: SavedNote };
  return body.note;
}
