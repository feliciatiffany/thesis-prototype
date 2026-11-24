# Two Kinds of Doubt

A scripted chat prototype for an HCI study. It looks like an everyday chatbot. Each reply is written ahead of time. The study changes only the marks around those words, not the words themselves.

The earlier claim-editing prototype is kept in `editor-prototype/`. This folder’s `npm run dev` runs the chat.

## Canvas prototype

A newer prototype is on its own page at `/canvas`, for example `http://localhost:5173/canvas`. It is a zoomable board built from the “prototype- builds” wireframes in the FigJam file. The code is in `src/canvas/`.

- The starting board is one real paper, *Why Language Models Hallucinate* (Kalai et al., 2025). Its text is in `src/canvas/paper.ts`, one entry per section, and Figure 1 is `public/paper/figure-1.png`. `src/canvas/seed.ts` lays it out.
- A paper is a closed box that holds another canvas. Keep zooming into it with the scroll wheel, double-click it, press `i` / Enter, or click Open — same idea as entering a Component in TouchDesigner. Press `u`, click Up, or keep zooming out to go back up. The path at the top of the board shows where you are. Inside, each section of the paper is its own frame.
- Add a paper with **+ Paper**, then **Choose a PDF**. The PDF is read in the browser and split into sections by its numbered headings, up to References. Equations and tables come through rough or not at all.
- Select words in a paper and choose **Ask about these words**, or select any frame and choose **Ask**. Type the question, press **Done**, then **Get answer**. Claude answers from the papers on that board, using each section as a source. Every part of the answer that quotes the paper is underlined and linked to a card with the exact passage and the section it came from. Parts with no underline are not backed by a quote. An answer can also be typed in by hand.
- **+ Doc** adds a frame for your own writing. Bridge it to a paper or any other source with a line.
- Select a frame and drag the round handle on its right edge. Drop it on another frame to draw a line between them, or press **Connect** and click the frame.
- Click a line you drew to open its drop-down: **See connection**, **Summary**, or **See difference**. Claude reads the two ends (a closed paper brings the sections inside it) and answers with the passages it quoted. Results are kept on the line, so it opens instantly next time.
- Drop the handle on empty space (or press **Connect** and click empty space) and a new question appears there, continuing from that frame. Questions joined this way form one thread: each answer gets every earlier question and answer in its thread, so a conversation stays on track however far it spreads across the board. Each question shows what it continues from.
- Boards are saved in this browser under the key `doubt.canvas.v3`. Added images and videos are kept in the browser too. “Reset to the starting board” in the sidebar puts everything back.

### Answers need an API key

Answers come from the dev server (`server/ask.ts`, model `claude-opus-5-5`), so the key never reaches the browser. Put it in a file named `.env.local` in this folder:

```
ANTHROPIC_API_KEY=your-key-here
```

Restart `npm run dev` after adding it. `.env.local` is ignored by git. Without a key, the question frame says so. A static build (`npm run build`) has no server, so it cannot answer.

## Source map prototype

A third page at `/map` shows how your papers relate to each other, so you can see the background of a topic, combine papers, and dig into one paper's related research. A bar along the top of every page switches between the prototypes. It is hidden on participant links (an address with `pid` and without `debug=1`) and on `/admin`. The code is in `src/map/` and `src/components/ProtoNav.tsx`.

- **Papers** (left): add a PDF with **+ Paper (PDF)** or paste a link. For a PDF the reference list is kept; for an arXiv abstract link the full paper is read from arXiv's HTML version, references included, because that is where papers mention each other. Other web pages are read up to their first part, and the page says so.
- **The map** (middle): every paper is analyzed by Claude as soon as it is added (`server/analyze.ts`). Each paper gets a short label and summary, and arrows show how papers relate: replicates, extends, contradicts, cites, reviews. Click a paper to see its relations, each with one sentence on how they connect and a quote from the paper that shows it. The quote is checked against the paper text; one that is not found says so. Drag papers to move them.
- **Find related research** on a paper searches the web (`server/trail.ts`) and lists real, linked papers in the chat. **+ Add to map** reads the page in and the map updates.
- **Ask AI** (right): ask how papers relate or how to combine them. Answers come from the papers' text, with the map's relations as context, and quote the passages they rely on. Click an arrow's label to ask about that link.
- The starting example is the note-taking studies from the wireframe (Mueller 2014, Morehead 2019, Urry 2021, Voyer 2022). Its summaries and links were written by hand and are labelled as an example. Adding the first real paper replaces it.
- Saved in this browser under `doubt.map.v2`. **Start empty** clears it; **Load the example** brings the example back.

Analysis, questions and searches use the same `ANTHROPIC_API_KEY` in `.env.local` as the canvas.

## Paper trail prototype

A fourth page at `/trail`, from the third “prototype- builds” wireframe: a simpler chat study where you write notes and the AI traces every sentence back to your papers.

- **Library** (left): **My notes** is pinned at the top as the main doc, the one you are writing. Below it are your papers. Add PDFs with **+ Add paper (PDF)**; each is read in the browser and split into sections.
- **My notes** (middle): write in **Edit**. **Recheck** sends every sentence and the library to Claude (`server/trail.ts`), which says whether each sentence is supported, contested, or not covered by the papers, with the passage word for word. The words that carry the claim are boxed (green supported, red contested, the chat study's source colours) and joined by a dashed line to the passage. A sentence no paper covers gets a dotted grey underline. Each quote is checked against the paper text; one that is not found says so on its card. Sentences changed since the last recheck are counted in the header.
- **Assistant** (right): click a box, a card or an underlined sentence to pin that branch to the top of the assistant, then ask about it. Answers come from the library with the quoted passages under them. **Recommend papers** searches the web for related papers; only links that came up in the search are shown, and **+ Add to library** reads the page in. Some sites (for example ACM) block this, and the page says so.
- The starting example is the wireframe's note-taking notes (Mueller 2014, Morehead 2019) in `src/trail/content.ts`; its quotes and page numbers are as written in the wireframe. The example papers have no text, so adding a real paper replaces them.
- Saved in this browser under `doubt.trail.v2`. **Reset to the example** puts everything back. Uses the same `ANTHROPIC_API_KEY` as the canvas.

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
