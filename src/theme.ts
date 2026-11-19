/** Colorblind-safe tokens for the two signals. Shapes still carry the source meaning. */
export const signalTheme = {
  light: {
    agree: "#2F6FDB",
    disagree: "#E8833A",
    absent: "#D9DDE3",
    srcSupport: "#2E8B57",
    srcRefute: "#C8423B",
    srcNone: "#8A8F98",
    risk: "#C8423B",
  },
  dark: {
    agree: "#7AA2F0",
    disagree: "#F0A36A",
    absent: "#4A5160",
    srcSupport: "#5CBA8A",
    srcRefute: "#F07178",
    srcNone: "#A7ADB8",
    risk: "#F07178",
  },
} as const;
