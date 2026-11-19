import { useState } from "react";
import { AnswerPane } from "../components/AnswerPane.tsx";
import { ClaimInspector } from "../components/ClaimInspector.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { useDerivedSelection, useStudy } from "../context/StudyContext.tsx";

export function TaskScreen() {
  const study = useStudy();
  const claim = useDerivedSelection();
  const [passageId, setPassageId] = useState<string | null>(null);
  const task = study.currentTask;

  if (!task) {
    return (
      <p className="p-8">
        This task is missing from <code>tasks.json</code>.
      </p>
    );
  }

  const runtime = claim ? study.state.claimStates[claim.id] ?? null : null;
  const passage =
    task.passages.find((item) => item.id === passageId) ??
    task.extra_passages.find((item) => item.id === passageId) ??
    null;

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-[#f4f1ec]">
      <a
        href="#answer"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to answer
      </a>
      <TopBar
        pid={study.state.pid}
        taskNumber={study.state.taskIndex + 1}
        taskTotal={study.state.taskOrder.length}
        handled={study.handledCount}
        total={study.claimCount}
        canSubmit={study.canSubmit}
        openEvidence={study.openEvidenceCount}
        onSubmit={study.submitTask}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[3fr_2fr]">
        <div id="answer" className="overflow-y-auto">
          <AnswerPane
            task={task}
            condition={study.currentCondition}
            claimStates={study.state.claimStates}
            selectedClaimId={study.state.selectedClaimId}
            onSelect={(id) => {
              setPassageId(null);
              study.selectClaim(id);
            }}
            onOpenPassage={(id) => {
              setPassageId(id);
              study.openDetail(study.state.selectedClaimId ?? undefined, "source_link");
            }}
          />
        </div>
        <aside className="min-h-0 overflow-hidden border-l border-stone-300 bg-[#fffcf8]" aria-label="Claim inspector">
          <ClaimInspector
            condition={study.currentCondition}
            task={task}
            claim={claim}
            runtime={runtime}
            focusedPassage={passage}
            onCommit={(action, text) => {
              if (!claim) return;
              study.commitAction(claim.id, action, text);
            }}
            onEvidence={(evidenceId) => claim && study.selectEvidence(claim.id, evidenceId)}
            onSkipEvidence={() => claim && study.skipEvidence(claim.id)}
            onSearch={() => claim && study.openSearch(claim.id)}
            onFlag={() => claim && study.flagClaim(claim.id)}
            onDetail={(target) => study.openDetail(claim?.id, target)}
            onAlternatives={() => claim && study.openAlternatives(claim.id)}
            onLegend={study.openLegend}
            onClearPassage={() => setPassageId(null)}
          />
        </aside>
      </div>
    </div>
  );
}
