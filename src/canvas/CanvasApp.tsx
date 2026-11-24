import { useEffect, useRef } from "react";
import { BoardView } from "./Board.tsx";
import type { BoardHandle } from "./Board.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { useCanvas } from "./store.ts";
import "./canvas.css";

/** The canvas prototype: folders on the left, one zoomable board on the right. */
export function CanvasApp() {
  const board = useCanvas((s) => s.boards[s.boardId]);
  const boardView = useRef<BoardHandle>(null);

  useEffect(() => {
    const before = document.title;
    document.title = "Doubt";
    return () => {
      document.title = before;
    };
  }, []);

  return (
    <div className="dc">
      <Sidebar onFocus={(id) => boardView.current?.zoomTo(id)} />
      {board ? (
        <BoardView key={board.id} ref={boardView} board={board} />
      ) : (
        <main className="dc-main dc-none">No board is open. Add a board to a folder on the left.</main>
      )}
    </div>
  );
}
