import { useState } from "react";
import { useCanvas } from "./store.ts";
import type { Frame } from "./types.ts";

const FILE_NAME: Partial<Record<Frame["kind"], string>> = {
  paper: "Paper",
  image: "Image",
  video: "Video",
  link: "Link",
};

function fileName(frame: Frame) {
  const address = frame.src.startsWith("file:") ? "" : frame.src;
  return frame.title || address || FILE_NAME[frame.kind] || "";
}

function Row(props: {
  name: string;
  sign: string;
  level: number;
  active?: boolean;
  renaming: boolean;
  onOpen(): void;
  onRename(name: string | null): void;
  onRemove(): void;
}) {
  if (props.renaming) {
    return (
      <input
        autoFocus
        className="dc-input dc-rename"
        defaultValue={props.name}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => props.onRename(e.target.value.trim() || props.name)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
        }}
      />
    );
  }
  return (
    <div className={`dc-row${props.active ? " is-active" : ""}`} style={{ paddingLeft: 8 + props.level * 14 }}>
      <button className="dc-row-open" onClick={props.onOpen} onDoubleClick={() => props.onRename(null)}>
        <span className="dc-row-sign">{props.sign}</span>
        <span className="dc-row-name">{props.name}</span>
      </button>
      <button className="dc-row-x" aria-label={`Delete ${props.name}`} onClick={props.onRemove}>
        ×
      </button>
    </div>
  );
}

/** Folders on the left. A folder holds boards, and lists the files on the open board. */
export function Sidebar({ onFocus }: { onFocus(frameId: string): void }) {
  const state = useCanvas();
  const [renaming, setRenaming] = useState<string | null>(null);

  const rename = (id: string) => (name: string | null) => {
    if (name === null) return setRenaming(id);
    state.rename(id, name);
    setRenaming(null);
  };

  return (
    <aside className="dc-side">
      <div className="dc-brand">Doubt</div>
      <div className="dc-side-label">Folders</div>

      {state.folders.map((folder) => (
        <div key={folder.id}>
          <Row
            name={folder.name}
            sign={folder.open ? "⌄" : "›"}
            level={0}
            renaming={renaming === folder.id}
            onOpen={() => state.toggleFolder(folder.id)}
            onRename={rename(folder.id)}
            onRemove={() => {
              if (window.confirm(`Delete the folder “${folder.name}” and its boards?`)) state.removeFolder(folder.id);
            }}
          />
          {folder.open ? (
            <>
              {folder.boards.map((boardId) => {
                const board = state.boards[boardId];
                if (!board) return null;
                const open = boardId === state.boardId;
                const files = board.frames.filter((f) => f.kind in FILE_NAME);
                return (
                  <div key={boardId}>
                    <Row
                      name={board.name}
                      sign="•"
                      level={1}
                      active={open}
                      renaming={renaming === boardId}
                      onOpen={() => state.openBoard(boardId)}
                      onRename={rename(boardId)}
                      onRemove={() => {
                        if (window.confirm(`Delete the board “${board.name}”?`)) state.removeBoard(boardId);
                      }}
                    />
                    {open
                      ? files.map((file) => (
                          <button key={file.id} className="dc-file" onClick={() => onFocus(file.id)}>
                            {fileName(file)}
                          </button>
                        ))
                      : null}
                  </div>
                );
              })}
              <button className="dc-new" style={{ paddingLeft: 22 }} onClick={() => setRenaming(state.addBoard(folder.id))}>
                + Board
              </button>
            </>
          ) : null}
        </div>
      ))}

      <button className="dc-new" onClick={() => setRenaming(state.addFolder())}>
        + Folder
      </button>

      <button
        className="dc-new dc-reset"
        onClick={() => {
          if (window.confirm("Put everything back to the starting board? Your changes will be lost.")) state.reset();
        }}
      >
        Reset to the starting board
      </button>
    </aside>
  );
}
