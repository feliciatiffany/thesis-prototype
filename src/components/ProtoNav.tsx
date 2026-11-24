import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

const PROTOTYPES = [
  { to: "/", label: "Chat study", end: true },
  { to: "/canvas", label: "Canvas", end: false },
  { to: "/map", label: "Source map", end: false },
  { to: "/trail", label: "Paper trail", end: false },
] as const;

const HEIGHT = 40;

/**
 * Bar along the top for switching between prototypes. Hidden on a participant
 * link to the chat study (one with ?pid= and no ?debug=1), so participants
 * never see the other prototypes.
 */
export function ProtoNav() {
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const participant = params.has("pid") && params.get("debug") !== "1";
  const onStudy = !PROTOTYPES.some((p) => p.to !== "/" && pathname.startsWith(p.to));
  const hidden = pathname === "/admin" || (participant && onStudy);

  useEffect(() => {
    const root = document.documentElement;
    if (hidden) {
      root.style.removeProperty("--proto-nav-h");
      root.classList.remove("has-proto-nav");
    } else {
      root.style.setProperty("--proto-nav-h", `${HEIGHT}px`);
      root.classList.add("has-proto-nav");
    }
  }, [hidden]);

  if (hidden) return null;
  return (
    <nav className="proto-nav" aria-label="Prototypes">
      <span className="proto-nav-label">Prototypes</span>
      {PROTOTYPES.map((p) => (
        <NavLink key={p.to} to={p.to} end={p.end} className={({ isActive }) => (isActive ? "is-active" : "")}>
          {p.label}
        </NavLink>
      ))}
    </nav>
  );
}
