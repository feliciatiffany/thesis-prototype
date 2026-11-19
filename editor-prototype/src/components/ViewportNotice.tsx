import { useEffect, useState } from "react";

export function ViewportNotice() {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!narrow) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-800 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      Widen this window to at least 1280px. This study is set up for a laptop.
    </div>
  );
}
