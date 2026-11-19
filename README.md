# Two Kinds of Doubt

A scripted chat prototype for an HCI study. It looks like an everyday chatbot. Each reply is written ahead of time. The study changes only the marks around those words, not the words themselves.

The earlier claim-editing prototype is kept in `editor-prototype/`. This folder’s `npm run dev` runs the chat.

## Run it

You need Node installed. In this folder:

```bash
npm install
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`.

`npm run build` writes a static site into `dist/`. `npm run preview` serves that build.

Nothing in study mode calls a model or any other server after the page loads.

## Give someone a link

Add these to the address. Leave one out and the app fills it in as described.

| Parameter | Example | What it does |
| --- | --- | --- |
| `pid` | `?pid=p12` | Participant id. It is also typed on the consent screen. |
| `condition` | `?condition=D` | `A`, `B`, `C`, or `D`. If you leave it out, the id picks one of the four, and the same id always gets the same one. |
| `mode` | `?mode=pilot` | Scenario 1 with no marks, scenario 2 with both kinds of doubt. Order flips by participant id. |
| `delay` | `?delay=3000` | How long marks wait after a reply finishes. Only `0`, `1200`, or `3000`. Anything else stays at 1200. |
| `debug` | `?debug=1` | A small panel with the condition, the current reply, and a reset button. |

Examples:

- `http://localhost:5173/?pid=p12&condition=D`
- `http://localhost:5173/?pid=p12&mode=pilot&delay=0`
- `http://localhost:5173/admin` reads exported JSON files. It does not start a session.

A refresh keeps the conversation. Reset is in the debug panel, or clear this site’s data in the browser.

After consent, a short instruction page explains the three choices, the two messages required before deciding, and the practice that comes first when the condition uses marks.

## What the four conditions show

The assistant says the same sentences in every condition.

- **A.** Plain text, plus numbered sources under the reply. The same blue and orange bar sits on every key word. Tap the word to open the chart of answers.
- **B.** A dotted underline when the sampled answers did not all match. A small blue and orange bar sits on the key word: blue is how many samples agreed, orange is how many said something else. Tap the word to see each answer.
- **C.** An underline when the sources do not simply support the sentence. A check, a cross, or an empty circle on the key word says whether a source supports it, contradicts it, or does not cover it. The popover says “Sources disagree” or “No source covers this”. Those are different. The blue and orange bar and the answer chart are on the key word here too.
- **D.** Both signals at once. The blue and orange bar sits on every key word, and tapping it opens the chart. “Show all signals” adds source marks to the calm sentences too. A repeated claim that sources do not back gets a note in the sentence itself, without a tap. A repeated flagged sentence later in the chat keeps its mark and a “flagged earlier” link. “Why are you unsure about this?” appears only here.

## Edit the conversation

Open `src/data/scenarios.json`. Scenario `s1` is the e-bike study. Scenarios `s2` and `s3` are draft conversations in the same shape. Read them before a real session and rewrite any copy you do not want participants to see.

A scenario is a short graph.

- `brief` is the card above the chat.
- `claims` are the sentences that can carry a mark. Do not store the quadrant. The app computes it. High agreement means `agree / total` is at least 0.7 (`src/config.ts`).
- `key_span` is the word or number the bar sits on. It has to appear in the claim text.
- `branches` lists each sampled value, including the answer itself. The answer’s `count` must match `consistency.agree`. Other values should match `alternatives`. A branch can set `"source": "support"` when a passage backs that value. Colors live in `src/theme.ts`.
- `passages` are the sources. `extra_passages` show up only after a reply lists them in `source_ids`.
- `nodes` are the assistant’s replies. `segments` are either plain `text` or a `claim` id. Using the same claim id in a later node is what brings the mark back.
- `chips` are the buttons under the composer. Add `"condition": "D"` to a chip that should appear only in condition D.
- `intents` route typed messages. The first keyword that appears wins. If none match, the reply is `fallback_node`.
- `about_claim` marks a reply as being about a planted error, so the export can count those questions.
- `decision.correct_option` is the choice that fits the sources. `rationale_claim_ids` are the reasons that make that choice count as well supported.

`src/data/tutorial.ts` is the unscored practice chat. Conditions B, C, and D see it once before the first scenario that uses marks.

The delay, the “thinking” pause, and the streaming speed are in `src/config.ts`.

## Collect the data

At the end, the participant downloads three files named with their id and condition:

- `events.json` is the raw log, plus the scenario and belief tables.
- `scenarios.csv` is one row per decision.
- `beliefs.csv` is one row per key claim.

`human_fever_correct` is true only when the decision is the source-backed option, at least one selected reason is in `rationale_claim_ids`, and none of the selected reasons is a planted error.

Drop `events.json` files on `/admin` to see those rates by condition, and belief rates by quadrant.

The log is also in this browser under the key `twokinds.chat.v1`.
