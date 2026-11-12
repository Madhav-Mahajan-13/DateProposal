// Biscuit's letter to Khushi. Edit the words here; the page reads from this file.
export type KhushiMood =
  'hello' | 'wistful' | 'gentle' | 'listening' | 'rose' | 'wink' | 'warm';

export interface KhushiStep {
  id: string;
  chapter: string;
  title: string;
  lead: string;
  aside: string;
  button: string;
  footnote: string;
  mood: KhushiMood;
  bubble: string; // Biscuit's little handwritten line beside him
  checkIn?: true;
  bouquet?: true;
}

export const herName = 'Khushi';

export const khushiStory: KhushiStep[] = [
  {
    id: 'hello',
    chapter: '01 / A FAMILIAR TAIL',
    title: `Hi ${herName}. It’s me, Biscuit.`,
    lead: 'Same floppy ears, same waggy tail — just a slightly more serious delivery today.',
    aside: 'I’ll keep it short. Mostly.\nPinky paw promise.',
    button: 'Hi, Biscuit',
    footnote: 'sniff sniff… is that lilac?',
    mood: 'hello',
    bubble: 'hi khushi!',
  },
  {
    id: 'quiet',
    chapter: '02 / THE QUIET PART',
    title: 'Things have felt a little far lately.',
    lead: 'Not the loud kind of rough. More like a quiet that settled in — and quiet can be harder than a fight.',
    aside:
      'The miles in between haven’t helped.\nNeither have all the highs and lows back to back.',
    button: 'Yeah… it has',
    footnote: 'Dogs notice these things. We just do.',
    mood: 'wistful',
    bubble: 'i noticed…',
  },
  {
    id: 'him',
    chapter: '03 / HIS SIDE OF THINGS',
    title: 'He talks before he thinks.',
    lead: 'Sometimes he shows off, says a little too much, and it lands on you in a way he never meant it to.',
    aside:
      'He knows some of it hurt. That part is on him.\nBut under all that noise? He really, truly likes you.',
    button: 'Go on',
    footnote: 'I’ve told him to work on it. Sternly. With one bark.',
    mood: 'gentle',
    bubble: 'he means well',
  },
  {
    id: 'check-in',
    chapter: '04 / WAIT, I SKIPPED THE IMPORTANT BIT',
    title: 'How are you, really?',
    lead: 'Not “I’m good.” Not “I’m okay.” The real answer.',
    aside:
      'Is anything sitting heavy on your heart, or just feeling off?\nWrite as much or as little as you like — or nothing at all.',
    button: 'Maybe another time',
    footnote: 'Only he will read this. No one else.',
    mood: 'listening',
    bubble: 'all ears',
    checkIn: true,
  },
  {
    id: 'roses',
    chapter: '05 / OOPS',
    title: 'I almost forgot your flowers!',
    lead: 'White roses. Your favourite — he made me double-check twice.',
    aside:
      'I carried them all the way here in my mouth.\nOnly sniffed one. Okay, two.',
    button: 'Aww, Biscuit',
    footnote: 'Yours to keep. No reason needed.',
    mood: 'rose',
    bubble: 'for you ♡',
    bouquet: true,
  },
  {
    id: 'pretty',
    chapter: '06 / FOR THE RECORD',
    title: 'Also… you’re really pretty.',
    lead: 'That’s not a line. It’s a fact Biscuit has personally and independently verified.',
    aside: 'Lilac suits you, by the way.\nSo does smiling. Just saying.',
    button: 'Stop it, Biscuit',
    footnote: 'I will not stop it.',
    mood: 'wink',
    bubble: 'just saying',
  },
  {
    id: 'no-pressure',
    chapter: '07 / NO PRESSURE, PROMISE',
    title: 'Maybe this is just a rough patch.',
    lead: 'Rough patches pass. And you don’t owe anyone an answer today — not him, not me.',
    aside:
      'I only wanted you to know someone is still in your corner,\nrooting for you, whatever you decide.',
    button: 'Give Biscuit a hug',
    footnote: 'Take all the time you need.',
    mood: 'warm',
    bubble: 'no rush',
  },
];

export const khushiEnding = {
  chapter: 'DELIVERY STATUS / HUG RECEIVED',
  title: 'Best hug of my whole life.',
  lead: 'Thank you for reading all the way to the end, Khushi.',
  aside:
    'I’ll be around, tail ready, whenever you want to talk.\nGo drink some water. Eat something nice. Be gentle with yourself. ♡',
  footnote: 'Love, Biscuit. (And him, a little nervously.)',
};
