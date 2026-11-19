import { Component, useEffect, type ReactNode } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DebugPanel } from "./components/DebugPanel.tsx";
import { ViewportNotice } from "./components/ViewportNotice.tsx";
import { StudyProvider, useStudy } from "./context/StudyContext.tsx";
import { AdminScreen } from "./screens/AdminScreen.tsx";
import { ConfidenceScreen } from "./screens/ConfidenceScreen.tsx";
import { ConflictScreen, ConsentScreen } from "./screens/ConsentScreen.tsx";
import { EndScreen } from "./screens/EndScreen.tsx";
import { QuestionnaireScreen } from "./screens/QuestionnaireScreen.tsx";
import { TaskScreen } from "./screens/TaskScreen.tsx";
import { TutorialScreen } from "./screens/TutorialScreen.tsx";

const TITLES = {
  consent: "Start",
  tutorial: "Tutorial",
  task: "Task",
  confidence: "Confidence",
  questionnaire: "Questions",
  done: "Complete",
} as const;

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-xl px-8 py-16">
          <h1 className="text-2xl font-medium text-stone-950">Something went wrong</h1>
          <p className="mt-3 text-stone-700">
            Your answers are saved in this browser. Reload the page to continue.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function StudyShell() {
  const study = useStudy();

  useEffect(() => {
    document.title = `${TITLES[study.state.phase]} · Two Kinds of Doubt`;
  }, [study.state.phase]);

  if (study.conflict) return <ConflictScreen />;

  switch (study.state.phase) {
    case "tutorial":
      return <TutorialScreen />;
    case "task":
      return <TaskScreen />;
    case "confidence":
      return <ConfidenceScreen key={study.state.taskIndex} />;
    case "questionnaire":
      return <QuestionnaireScreen key={study.state.taskIndex} />;
    case "done":
      return <EndScreen />;
    default:
      return <ConsentScreen />;
  }
}

function StudyApp() {
  return (
    <StudyProvider>
      <ViewportNotice />
      <ErrorBoundary>
        <StudyShell />
      </ErrorBoundary>
      <DebugPanel />
    </StudyProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminScreen />} />
        <Route path="/*" element={<StudyApp />} />
      </Routes>
    </BrowserRouter>
  );
}
