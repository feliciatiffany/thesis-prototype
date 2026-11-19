import type { ReactNode } from "react";

export function Frame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f1ec] px-8 py-12">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-sm font-medium text-stone-600">Two Kinds of Doubt</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-stone-950">{title}</h1>
        <div className="mt-6 space-y-6 text-stone-800">{children}</div>
      </div>
    </div>
  );
}
