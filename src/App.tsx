import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DebugPanel } from "./components/DebugPanel.tsx";
import { RestartButton } from "./components/RestartButton.tsx";
import { ChatView } from "./components/ChatView.tsx";
import { readStudyParams } from "./lib/assignment.ts";
import { validateStudyContent } from "./lib/validate.ts";
import { AdminScreen } from "./screens/AdminScreen.tsx";
import { ConflictScreen, ConsentScreen } from "./screens/ConsentScreen.tsx";
import { InstructionScreen } from "./screens/InstructionScreen.tsx";
import { EndScreen } from "./screens/EndScreen.tsx";
import { QuestionnaireScreen } from "./screens/QuestionnaireScreen.tsx";
import { useStudy } from "./store/useStudy.ts";

function StudyApp() {
  const problems = validateStudyContent();
  const started = useStudy((state) => state.started);
  const phase = useStudy((state) => state.phase);
  const conflictPid = useStudy((state) => state.conflictPid);
  const debug = readStudyParams().debug;

  let screen = <ConsentScreen />;
  if (problems.length > 0) {
    screen = (
      <main className="mx-auto max-w-[720px] px-4 py-8">
        <h1 className="text-xl font-medium">The study file needs a fix</h1>
        <ul className="mt-3 list-disc pl-5">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
        <div className="mt-6">
          <RestartButton />
        </div>
      </main>
    );
  } else if (conflictPid) {
    screen = <ConflictScreen />;
  } else if (!started || phase === "consent") {
    screen = <ConsentScreen />;
  } else if (phase === "instructions") {
    screen = <InstructionScreen />;
  } else if (phase === "tutorial") {
    screen = <ChatView practice />;
  } else if (phase === "chat" || phase === "decision") {
    screen = <ChatView />;
  } else if (phase === "questionnaire") {
    screen = <QuestionnaireScreen />;
  } else {
    screen = <EndScreen />;
  }

  return (
    <>
      {screen}
      {debug ? <DebugPanel /> : null}
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="*" element={<StudyApp />} />
      </Routes>
    </BrowserRouter>
  );
}
