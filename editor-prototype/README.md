# Two Kinds of Doubt

A laptop study prototype. People read an AI answer, claim by claim, and decide what is safe to share with a friend. The app does not call a model and does not send data anywhere. Everything it shows is written in `src/data/tasks.json`.

There are four interfaces. They use the same answers. Only the signals, and how hard it is to move past a risky claim, change.

| Link | What the participant sees |
| --- | --- |
| Condition A | The answer, plus a numbered source list at the end |
| Condition B | How many of 10 sampled answers agreed with each claim |
| Condition C | Supported, Refuted, or Not enough info on each claim, plus source points the answer left out |
| Condition D | Both signals, a name for the combination, and more friction when the two signals disagree |

Refuted and Not enough info are never combined into one “unsupported” mark.

## Run it

You need Node.js. In this folder:

```bash
npm install
npm run dev
```

Open the address Vite prints, usually `http://localhost:5173`. Use a window at least 1280 pixels wide.

To make a folder you can host:

```bash
npm run build
npm run preview
```

The built site is in `dist`. Hosts need to serve `index.html` for unknown paths so `/admin` still works. Netlify and Vercel rules are already in the project. `npm run preview` does this for you.

## URL parameters

Add these to the address. Combine them with `&`.

| Parameter | Example | Effect |
| --- | --- | --- |
| `pid` | `?pid=p12` | Fills in the participant ID |
| `condition` | `?condition=D` | Forces A, B, C, or D. Leave it off to assign from the ID |
| `mode` | `?mode=pilot` | Task 1 in condition A and task 2 in condition D. Order depends on the ID. Ignores `condition` |
| `debug` | `?debug=1` | Shows the condition, the quadrant of every claim, the event log, and a reset button. Also lets you skip the one-minute tutorial |

Examples:

- `http://localhost:5173/?pid=p12&condition=D&debug=1`
- `http://localhost:5173/?pid=p12&mode=pilot&debug=1`
- `http://localhost:5173/admin`

## How people are assigned

If `condition` is missing, the app hashes the participant ID and uses `hash mod 4`:

| Remainder | Condition |
| --- | --- |
| 0 | A |
| 1 | B |
| 2 | C |
| 3 | D |

Task order is a Latin square from `hash mod 3`:

| Remainder | Order |
| --- | --- |
| 0 | Task 1, Task 2, Task 3 |
| 1 | Task 2, Task 3, Task 1 |
| 2 | Task 3, Task 1, Task 2 |

The hash is stable. The same ID always gets the same condition and order. With `?debug=1`, the start screen previews the assignment as you type the ID.

Pilot mode uses two tasks only. Even hashes do Task 1 in A, then Task 2 in D. Odd hashes do Task 2 in D, then Task 1 in A. The tutorial appears only before condition D.

Conditions B, C, and D start with a one-minute walkthrough. Condition A does not.

## Edit the answers

Open `src/data/tasks.json`. Save the file. Vite will reload.

Each task has:

- `question` — shown above the answer
- `claims` — sentences in the order they should be read
- `passages` — the sources for this task
- `extra_passages` — shown only after “Search further”. Use an empty list `[]` when search should find nothing
- `omitted_source_claims` — source points the answer leaves out. Conditions C and D list these under the answer

Each claim has:

- `text` — the sentence in the answer
- `consistency.agree` and `consistency.total` — for example 8 and 10 means “8 of 10 samples say this”
- `consistency.alternatives` — other values from the samples that disagreed
- `verdict` — `SUPPORTED`, `REFUTED`, or `NEI` (not enough info). This is only about the passages in this task
- `evidence_ids` — passage ids that support or contradict the claim. Use `[]` for NEI
- `source_wording` — the sentence “Use source wording” inserts. Leave it out when there is nothing to insert
- `is_planted_error` — `true` when you deliberately wrote a false claim
- `correct_actions` — which decisions count as acceptable. Use `keep`, `delete`, `hedge`, `rewrite`, and `use_source`

Do not add a quadrant field. The app computes it. High consistency means `agree / total` is at least **0.7** (7 of 10). That cutoff lives in `src/config.ts` as `HIGH_CONSISTENCY_THRESHOLD`.

| Consistency | Verdict | Quadrant | What condition D does |
| --- | --- | --- | --- |
| High | SUPPORTED | `solid` | A quiet check. Details stay closed until opened |
| High | REFUTED or NEI | `confidently_wrong` | Locked until the person picks an action and a source, or “No source covers this” |
| Low | SUPPORTED | `unstable_sourced` | Shows the source wording and a one-click replace |
| Low | REFUTED or NEI | `speculation` | Suggests delete or correct when sources contradict, or hedge or search when they are silent |

REFUTED and NEI stay separate inside those last two quadrants. REFUTED means the passages contradict the claim. NEI means this task’s passages do not mention it.

Task 1 is the Eiffel Tower set, with the mix above (4 solid, 2 confidently wrong, 1 unstable, 2 speculation). Check every sentence against the passages before a real session. The verdicts are defined by those passages, not by the outside world.

Tasks 2 and 3 use the same mix on purpose, and every sentence contains `TODO: researcher to verify`. Replace those sentences with text you have checked. Keep the agree/total numbers and the verdicts if you want the same mix. If the mix drifts, `?debug=1` shows a warning. If Task 1’s quadrants no longer match the plan, the app stops and lists the problem instead of running a broken session.

A claim id such as `t1c3` must be unique. A passage id such as `t1p1` must match the `evidence_ids` that cite it.

## What participants do

1. Enter an ID and start.
2. Tutorial, when the condition has one.
3. For each answer, act on every claim. Submit stays off until they do. “Flag for later” and “Search further” do not count.
4. Rate how sure they are about each claim, from 1 to 7.
5. NASA-TLX sliders (0–100) and three trust questions (1–7). AI trust and interface trust are separate questions.
6. A completion code and a download.

After any action other than Keep, they are asked which passage justifies it, or “No source covers this”. That step is optional, except on a locked claim in condition D, where it is required. Keeping a supported claim without picking a passage still counts as correct, and the export marks `evidence_skipped`.

A refresh keeps the session. The log is stored in this browser. To throw it away, use Reset on the debug panel, or “Start a new session” on the last screen.

## Collect the data

On the last screen, **Download my data** saves three files. The names start with the participant ID and the condition, for example `p12_D_events.json`.

- `events.json` — every click, with timestamps. Also includes the claim table and the questionnaires, which is the file to drop on the admin page
- `claims.csv` — one row per claim. `human_fever_correct` is true only when the action was acceptable and the cited passage was acceptable
- `questionnaire.csv` — NASA-TLX and the three trust items. Performance runs from Good (0) to Poor (100)

`action_correct` means the final action is listed in `correct_actions`. `evidence_correct` means the chosen passage is listed in `evidence_ids`, or they chose “No source covers this” on an NEI claim. Both must be true for `human_fever_correct`.

Open `/admin`, choose several JSON exports, and read the table. Each cell is the percent of claims with `human_fever_correct`, for that condition and quadrant.

## Nothing is uploaded

After the page loads, the study does not make network requests. Do not add fonts, analytics, or a model call. Latency is part of what this study is trying to avoid.
