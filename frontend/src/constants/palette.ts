/* Colours already used by the Home and Auth screens, plus the status colours for lab flags. */
export const palette = {
  bg: "#F5F8FC",
  card: "#FFFFFF",
  primary: "#1769AA",
  primarySoft: "#EAF4FF",
  text: "#17324D",
  muted: "#657789",
  border: "#E1E8F0",

  good: "#1B7F4B",
  goodSoft: "#E6F4EA",
  high: "#C62828",
  highSoft: "#FDECEA",
  low: "#B45309",
  lowSoft: "#FEF3C7",
  neutral: "#5F6B7A",
  neutralSoft: "#EEF1F5",
  warnSoft: "#FFF8E1",
  warnBorder: "#F2D98A",
} as const;

export const shadow = {
  shadowColor: "#0B2A47",
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;
