import raw from "../data/tasks.json";
import type { Claim, Passage, Task, TaskFile } from "../types.ts";

export const taskFile = raw as TaskFile;
export const tasks: Task[] = taskFile.tasks;

export function taskById(id: string): Task | undefined {
  return tasks.find((task) => task.id === id);
}

export function claimById(id: string): { task: Task; claim: Claim } | undefined {
  for (const task of tasks) {
    const claim = task.claims.find((item) => item.id === id);
    if (claim) return { task, claim };
  }
  return undefined;
}

export function passageById(task: Task, id: string): Passage | undefined {
  return (
    task.passages.find((passage) => passage.id === id) ??
    task.extra_passages.find((passage) => passage.id === id)
  );
}
