export interface Message {
  chapter: string;
  title: string;
  lead: string;
  aside: string;
  footnote: string;
}
export interface StoryStep extends Message {
  button: string;
  gift?: 'white-rose';
}
export type Outcome = 'accepted' | 'declined';

// Personalize Biscuit's message here.
export const story: StoryStep[] = [
  {
    chapter: '01 / THE HELLO',
    title: 'Hey, you.',
    lead: 'Hope your day’s been as lovely as your smile.',
    aside:
      'I’m Biscuit. Professional good boy.\nOccasional letter delivery service.',
    button: 'Hi, Biscuit',
    footnote: 'psst… I have something to tell you.',
  },
  {
    chapter: '02 / A LITTLE CONFESSION',
    title: 'Well, this is awkward.',
    lead: 'I was told to play it cool. Then you showed up.',
    aside:
      'My tail’s wagging. My cover’s blown.\nSomeone thinks you’re pretty wonderful.',
    button: 'Oh? Who sent you?',
    footnote: 'I am terrible at keeping cute secrets.',
  },
  {
    chapter: '03 / THE WINGDOG',
    title: 'Someone a little shy.',
    lead: 'He wanted to ask you something. I offered to lend a paw.',
    aside:
      'He brings the conversation. You bring that smile.\nI’ve been put in charge of a very important snack plan.',
    button: 'Okay, I’m listening',
    footnote: 'I have personally approved this message.',
  },
  {
    chapter: '04 / A LITTLE SOMETHING',
    title: 'For you, lovely.',
    lead: 'A white rose. Because someone remembered your favorite.',
    aside:
      'He picked the flower. I insisted on delivering it myself.\nBetween us? You’re still the prettiest thing here.',
    button: 'Aww, thank you',
    footnote: 'Yours to keep. Just because.',
    gift: 'white-rose',
  },
  {
    chapter: '05 / THE BIG QUESTION',
    title: 'Will you go out with me?',
    lead: 'Crispy dosa, your favorite street food, and a coffee we don’t have to rush.',
    aside:
      'You pick the spot. He brings the company.\nWould you like to pick a day?',
    button: 'I’d love to',
    footnote: 'A real question. Your answer is yours.',
  },
];

export const endings: Record<Outcome, Message> = {
  accepted: {
    chapter: 'DELIVERY STATUS / ONE HAPPY WINGDOG',
    title: 'Oh, tail-wagging news!',
    lead: 'Dosa, coffee, and a very happy wingdog. I had a good feeling about you two.',
    aside:
      'Pick a day and the little things you’d love to do.\nBiscuit will save your plan for him. ♡',
    footnote: 'My work here is done. Payment in treats, please.',
  },
  declined: {
    chapter: 'DELIVERY STATUS / STILL A GOOD DAY',
    title: 'All good, lovely.',
    lead: 'Thanks for hearing a little wingdog out.',
    aside:
      'No pressure, and no convincing.\nHope the rest of your day is a lovely one.',
    footnote: 'A friendly paw-five, either way.',
  },
};
