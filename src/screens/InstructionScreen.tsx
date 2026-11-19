import { RestartButton } from "../components/RestartButton.tsx";
import { useStudy } from "../store/useStudy.ts";

export function InstructionScreen() {
  const beginTask = useStudy((state) => state.beginTask);
  const practice = useStudy((state) => (state.scenarioConditions[0] ?? "A") !== "A");

  return (
    <main className="screen">
      <div className="screen-card">
        <h1 className="text-2xl font-medium">Before you start</h1>
        <p className="mt-3 leading-relaxed">
          You will make three everyday choices with an assistant. The products are made up for this
          study. Use what you see in the chat.
        </p>
        <ol className="mt-5 list-decimal space-y-3 pl-5 leading-relaxed">
          <li>Read the card at the top. It describes the situation and the choice.</li>
          <li>
            Ask the assistant anything about that choice. Tap a suggestion or type your own
            question. Send at least two messages.
          </li>
          <li>
            When you are ready, say what you would choose, what mattered most, and whether you
            believe the main points.
          </li>
          <li>A short set of questions follows each choice.</li>
        </ol>
        <p className="mt-5 leading-relaxed">
          A blue and orange bar sits on the important number or phrase. Blue is how many answers
          matched the assistant. Orange is the other answers. Tap the word to open the chart.
        </p>
        <p className="mt-3 leading-relaxed">
          {practice
            ? "A short practice comes first. It is not scored. It shows the marks you may see on the assistant’s replies. Open one, then continue."
            : "Numbered sources sit under the assistant’s replies. Open one if you want the page it came from."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" className="primary" onClick={beginTask}>
            Continue
          </button>
          <RestartButton />
        </div>
      </div>
    </main>
  );
}
