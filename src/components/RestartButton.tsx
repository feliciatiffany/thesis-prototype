import { useStudy } from "../store/useStudy.ts";

export function RestartButton({ className = "restart" }: { className?: string }) {
  const started = useStudy((state) => state.started);
  const reset = useStudy((state) => state.reset);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (
          started &&
          !window.confirm("Restart from the beginning? This clears the current session.")
        ) {
          return;
        }
        reset();
      }}
    >
      Restart
    </button>
  );
}
