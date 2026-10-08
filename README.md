# A little hello

A date invitation delivered by Biscuit, a golden puppy. Built with React, TypeScript, and Vite.

## Run locally

Use Node.js 22 (22.14 or newer) and npm. From this directory:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Commands

| Command                | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Development server with hot reload                          |
| `npm run build`        | Check TypeScript and create the production build in `dist/` |
| `npm run preview`      | Serve the production build at http://127.0.0.1:4173         |
| `npm start`            | Serve the production app and JSON API on port 3000          |
| `npm test`             | Test persistence, validation, and visitor isolation         |
| `npm run typecheck`    | Check application and Vite configuration types              |
| `npm run lint`         | Run ESLint, including React Hooks checks                    |
| `npm run format`       | Format source and configuration with Prettier               |
| `npm run format:check` | Check formatting without changing files                     |

Use `npm ci` for reproducible installs from `package-lock.json`.

## Project structure

```text
src/
  main.tsx                   React entry point
  App.tsx                    Page layout and invitation state
  components/
    Mascot.tsx               Animated pet, mood, and interaction state
    mascot.css               Tail, face, breathing, and play animations
    PetIcon.tsx               Pet, treat, and play control icons
    InvitationCard.tsx       Dialogue, answers, progress, and focus handling
    Celebration.tsx          Acceptance animation
  content/invitation.ts       Editable dialogue and endings
  hooks/useReducedMotion.ts  Respects the visitor's motion preference
  styles.css                 Responsive page styling
public/
  mascot/                    Biscuit artwork and generation notes
  story/                     Existing story assets, retained for future use
artifacts/                   Design references and preview screenshots
```

Edit `src/content/invitation.ts` to personalize the invitation. Biscuit uses four aligned assets in `public/mascot/`: `biscuit-body.png`, `biscuit-tail.png`, `biscuit-happy.png`, and `biscuit-wink.png`. The original `biscuit.png` is retained as a reference. Generation prompts are saved in `animation-notes.json`. Files in `public/` are served from the site root; the app and its API are deployed together at the site root.

## Virtual pet

Biscuit breathes, blinks, and wags his tail while idle. Petting him gives happy eyes and floating hearts; treats bring a snack reaction; playing adds a bouncing ball and hops. His expression, tail speed, and caption also follow the invitation. Declining keeps him friendly. Mouse movement gives him a small lean; all three interactions also work by touch and keyboard.

Reactions last 4.2 seconds and can be replayed. A new action replaces the previous reaction. Motion can be paused explicitly, pauses when the page is hidden, and respects the operating system's reduced-motion setting. Static expressions and written feedback still work with motion disabled.

Before the date question, Biscuit offers a white rose with a personal message. The flower appears only during this dedicated gift scene; it disappears on the date question and both ending screens. The gift is declared in `src/content/invitation.ts`; its artwork is `public/mascot/white-rose.png` and its generation prompts are in `white-rose-notes.json`.

On the final question, moving the cursor within 85 pixels of “No, thank you” gives Biscuit a briefly sad expression and a slower tail wag. It activates when that button is closer than the yes button, also supports keyboard focus, and clears when the cursor moves away or an answer is selected. The button remains clickable. The expression uses `public/mascot/biscuit-sad.png` and respects reduced-motion preferences.

Clicking that first decline opens one short puppy appeal: Biscuit moves from his spot into the invitation card with teary eyes and makes a cute pitch. The original mascot is hidden while he is in the card. “Okay, dosa it is” accepts; “Still no, thank you” goes straight to the friendly decline ending without another appeal. Both choices work immediately, the rose stays absent, and replay resets the story. The movement respects the pet's pause setting and reduced motion, with an in-place entrance if the original dog is offscreen on a phone. `PuppyAppeal.tsx` owns this scene; the artwork and prompt are in `public/mascot/biscuit-teary.png` and `teary-expression-notes.json`.

## Date-planning form

Both yes buttons open a date-planning form beside a happy Biscuit. She can choose dosa, street food, and coffee; suggest a day and time; name a favorite spot; and write her own itinerary. All fields are optional. Past dates are rejected by the date field.

"Save my little plan" writes her answers through the Node API (local JSON during development; private Vercel Blob storage when deployed), then shows a reply she can copy. Returning to the form in the same browser prefills the saved answers; saving edits updates that response. Unsaved edits are not persisted. A private visitor cookie remembers the browser for up to one year. Clearing cookies or using another browser starts a separate response.

The JSON file is created automatically, excluded from Git, and blocked from public serving. `data/responses.example.json` shows its empty structure. Each saved entry contains the plan and its last update time. `GET /api/response` loads only the current visitor's response; `PUT /api/response` validates and saves it. The server serializes writes and replaces the file atomically. Loading and saving failures show retry messages without claiming success.

`src/components/DatePlanForm.tsx`, `src/lib/datePlanApi.ts`, and `server/response-api.mjs` contain this flow. Development and preview include the same API.

## View saved entries

Open `/admin-44444` to view saved answers, newest updates first. A final "Still no, thank you" is saved automatically as a declined response with its timestamp; the first No only opens the puppy appeal. Declined responses replace any previous plan for that browser. Saving a plan later replaces the No. Existing saved plans remain compatible. The declined ending shows save status and a retry button if storage is unavailable. The page displays food choices, day, time, place, itinerary, and last saved time. Use **Refresh entries** to check for changes. **Clear all entries** asks for confirmation, then permanently empties the saved responses and removes their prefill on the next form load. It reads the same response store through `GET /api/admin-44444/entries` and does not expose visitor cookie identifiers. There is no login: anyone with this URL can view or clear the entries. The invitation does not link to it.

## Deploy to Vercel

1. Push this project to your Git repository and import it into Vercel. Use the **Vite** preset; the included configuration builds with `npm run build` and serves `dist`.
2. In the project's **Storage** tab, create a **Blob** store with **Private** access and connect it to this project. Include Production and Preview if you use preview deployments. Vercel supplies the storage credentials automatically; you do not need to type keys into an env file.
3. **Redeploy** after connecting storage so the functions receive the connection settings.
4. Open the deployed invitation, save a test plan, refresh and open the form again to verify prefill. Open `/admin-44444` to view it. Use **Clear all entries** to remove your test response.

The two files under `api/` run as Vercel Node functions. `vercel.json` also makes the admin URL work on direct visits and refreshes. The app uses private Blob reads without caching and conditional writes with retry to preserve responses across concurrent function instances. A missing storage connection produces a save/load error, never a temporary filesystem fallback.

Production responses live in `biscuit/production/responses.json`. Preview and development use separate paths, so clearing preview entries does not clear production data. All preview deployments connected to the same store share the preview document. Existing local responses are not uploaded automatically. The browser cookie belongs to each site's domain, so use one consistent production URL for the invitation and prefill.

The Blob document is private, but the admin page still has no login: anyone who knows its URL can view or clear entries.

Setup reference: [Vercel Blob SDK and project connection](https://vercel.com/docs/vercel-blob/using-blob-sdk).

## Git and deployment exclusions

`.gitignore` excludes real responses, environment files, Vercel metadata, dependencies, builds, caches, credentials, and new preview artifacts. `.env.example` and the lockfile stay included. Already-tracked design screenshots remain in Git; `.vercelignore` excludes all artifacts and local data from deployment uploads.

## Standalone production server

```sh
npm run build
npm start
```

The Node server serves `dist/` and the response API at http://127.0.0.1:3000. Deploy with a persistent, writable disk and a single Node process writing the JSON file. Static-only hosting cannot save these responses. Keep `data/responses.json` when updating the app.

Optional environment variables:

- `PORT`: server port (default `3000`).
- `HOST`: listening address (default `127.0.0.1`; use `0.0.0.0` if required by the host).
- `RESPONSES_FILE`: an alternative private JSON file path, outside `public/` and `dist/`.
- `COOKIE_SECURE=true`: enable secure cookies when serving over HTTPS behind a reverse proxy. Preserve the original Host header when proxying.

The invitation starts again after a refresh; saved form answers load when she accepts and opens the form. No email or chat message is sent automatically. Google Fonts provides the typefaces, with local font fallbacks if unavailable.
