// Tiny synthesized sounds (no audio files). Created after a user gesture.
let context: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem('khushi-muted') === '1';
} catch {
  // Storage can be unavailable; sound simply starts on.
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem('khushi-muted', value ? '1' : '0');
  } catch {
    // Ignore unavailable storage.
  }
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  volume = 0.06,
  type: OscillatorType = 'sine',
  slideTo?: number,
) {
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const at = context.currentTime + start;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (slideTo)
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + duration);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
}

export type SoundKind = 'pop' | 'tick' | 'chime' | 'puff' | 'whoosh' | 'boop';

export function play(kind: SoundKind) {
  if (muted || typeof window === 'undefined') return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    return;
  }
  switch (kind) {
    case 'pop':
      tone(520, 0, 0.12, 0.05, 'sine', 780);
      break;
    case 'tick':
      tone(1200, 0, 0.03, 0.012, 'triangle');
      break;
    case 'boop':
      tone(330, 0, 0.18, 0.06, 'sine', 520);
      break;
    case 'puff':
      tone(260, 0, 0.22, 0.04, 'triangle', 140);
      break;
    case 'whoosh':
      tone(300, 0, 0.6, 0.04, 'sine', 1300);
      break;
    case 'chime':
      tone(784, 0, 0.5, 0.05);
      tone(988, 0.1, 0.5, 0.045);
      tone(1319, 0.2, 0.7, 0.04);
      break;
  }
}
