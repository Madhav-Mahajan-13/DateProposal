// Biscuit's little journey with Khushi. Edit any words here; the page reads
// from this file. Each "beat" is a chapter: a few lines from Biscuit (with
// optional little interactions), then a way for her to reply.

export const herName = 'Khushi';

export type Mood = 'happy' | 'open' | 'sad' | 'teary' | 'wink';
// The sky slowly brightens as the story goes on.
export type Sky = 'night' | 'storm' | 'dusk' | 'dawn' | 'morning';

export interface BiscuitMessage {
  text: string;
  mood?: Mood;
}

// Small things she does to keep the story going.
export interface Gate {
  gate: 'tears' | 'roses';
  prompt: string;
}

export type Item = BiscuitMessage | Gate;

export interface ReplyOption {
  label: string; // what she "says" when she taps it
  followUp?: BiscuitMessage[]; // Biscuit's answer to this specific reply
}

export type Reply =
  | { kind: 'chips'; options: ReplyOption[] }
  | {
      kind: 'note';
      placeholder: string;
      skip: ReplyOption;
      thanks: BiscuitMessage[];
      failed: BiscuitMessage[];
    }
  | {
      kind: 'hug';
      label: string;
      prompt: string;
      followUp: BiscuitMessage[];
    };

export interface Beat {
  sky: Sky;
  messages: Item[];
  reply: Reply;
}

const m = (text: string, mood?: Mood): BiscuitMessage => ({ text, mood });

export const envelope = {
  to: `for ${herName.toLowerCase()} 🤍`,
  from: 'from biscuit (and someone a little shy)',
  open: 'open it',
};

export const beats: Beat[] = [
  {
    sky: 'night',
    messages: [
      m('khushiii 🐾', 'happy'),
      m('it’s me. biscuit.'),
      m(
        'okay so i’ve been holding onto this for a few days and my paws are getting tired',
        'open',
      ),
      m('can i say something? it’s a little long. sorry in advance'),
    ],
    reply: {
      kind: 'chips',
      options: [
        { label: 'of course, biscuit' },
        {
          label: 'hmm… okay',
          followUp: [m('thank you. i’ll be gentle, promise')],
        },
      ],
    },
  },
  {
    sky: 'storm',
    messages: [
      m('things haven’t really been okay between you two lately, na', 'sad'),
      m('not fighting-bad. just… dry'),
      m(
        'and it’s not anyone’s fault. you’re both at home, and you can’t exactly talk with family around',
      ),
      m('so it’s been texts. just texts. for days'),
      m('and texts are nice but…'),
      m('he really misses your voice 🥺', 'teary'),
      m('like, a lot. he won’t say it, so i’m saying it', 'sad'),
      m(
        'and the distance makes it so much harder. one day feels fine and the next day it just doesn’t',
      ),
      m('i noticed. i’m a dog, we notice everything 🥺'),
    ],
    reply: {
      kind: 'chips',
      options: [
        { label: 'yeah… it’s been like that' },
        { label: 'i didn’t think anyone noticed' },
      ],
    },
  },
  {
    sky: 'storm',
    messages: [
      m('and honestly, a lot of it is on him', 'sad'),
      m(
        'he talks too much sometimes. shows off. says things before he even thinks about them',
      ),
      m(
        'and some of that hurt you. i know it did. he knows it too, and it sits with him more than he shows',
        'teary',
      ),
      { gate: 'tears', prompt: 'he’s a bit teary… rub his head gently?' },
      m('but khushi…', 'open'),
      m(
        'he likes you. like, really really likes you. he’s just terrible at saying it the right way',
        'happy',
      ),
    ],
    reply: {
      kind: 'chips',
      options: [
        { label: '…okay' },
        {
          label: 'he could’ve said this himself',
          followUp: [
            m('you’re right. he should have', 'sad'),
            m(
              'he gets nervous and his words come out all wrong. so he asked me to help him start. he’ll say the rest himself, i promise',
            ),
          ],
        },
      ],
    },
  },
  {
    sky: 'dusk',
    messages: [
      m('wait wait wait', 'open'),
      m('i’ve been talking this whole time and i didn’t even ask you'),
      m('how are you?', 'sad'),
      m(
        'and not the “i’m fine” one. the real one. is something bothering you? anything feeling heavy lately?',
      ),
      m(
        'you can tell me anything. only he will read it, no one else. and if you don’t feel like it, that’s okay too 🤍',
      ),
    ],
    reply: {
      kind: 'note',
      placeholder: 'honestly? i’ve been…',
      skip: {
        label: 'not right now',
        followUp: [
          m('that’s okay. really', 'open'),
          m('whenever you feel like it, i’m right here'),
        ],
      },
      thanks: [
        m('thank you for telling me 🤍', 'teary'),
        m(
          'i know that’s not always easy. he’ll read every single word, carefully',
        ),
      ],
      failed: [
        m(
          'oh no, my paw slipped and it didn’t send 🥺 can you try once more?',
          'sad',
        ),
      ],
    },
  },
  {
    sky: 'dawn',
    messages: [
      m('OH NO', 'open'),
      m('i completely forgot the most important part'),
      { gate: 'roses', prompt: 'i dropped them everywhere 🙈 pick them up?' },
      m('white roses. your favourite', 'happy'),
      m(
        'he made me check like five times that i got the right ones. i carried them the whole way. only sniffed one. okay two',
      ),
    ],
    reply: {
      kind: 'chips',
      options: [
        { label: 'aww biscuit 🤍' },
        {
          label: 'he remembered?',
          followUp: [
            m('he remembers everything about you. it’s kind of a lot', 'wink'),
          ],
        },
      ],
    },
  },
  {
    sky: 'dawn',
    messages: [
      m('also… one more thing', 'open'),
      m('you’re really pretty', 'wink'),
      m('like, really. okay that’s it i’m not saying more, i’m shy too 🙈'),
    ],
    reply: {
      kind: 'chips',
      options: [
        {
          label: 'stoppp',
          followUp: [m('no 😌', 'wink')],
        },
        {
          label: '🙈',
          followUp: [m('hehe 😌', 'wink')],
        },
      ],
    },
  },
  {
    sky: 'morning',
    messages: [
      m('okay last thing, then i’ll go nap', 'open'),
      m('maybe this is just a rough patch. every story has one'),
      m(
        'i’m not here to make you decide anything. no pressure. not today, not ever',
      ),
      m(
        'i just didn’t want you to feel like nobody noticed. or like nobody cares',
        'sad',
      ),
      m('someone does. a lot 🤍', 'happy'),
    ],
    reply: {
      kind: 'hug',
      label: 'hug biscuit 🤗',
      prompt: 'press and hold to hug him',
      followUp: [
        m('best hug of my whole life 🐾', 'happy'),
        m(
          'take care of yourself okay? drink water. sleep on time. smile a little, it suits you',
        ),
        m('— biscuit (and him, nervously 🤍)'),
      ],
    },
  },
];

export const ending = {
  restart: 'read it again',
  signoff: 'this little page will always be here for you',
};
