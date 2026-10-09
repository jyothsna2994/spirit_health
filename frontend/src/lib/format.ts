import { palette } from "../constants/palette";
import type { Category, Flag } from "./types";

export function formatDate(iso: string | null | undefined, locale = "en-IN", opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(locale, opts ?? { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function monthTitle(iso: string, locale = "en-IN") {
  return formatDate(iso, locale, { month: "long", year: "numeric" });
}

export const CATEGORY_META: Record<Category, { icon: string; color: string }> = {
  prescription: { icon: "💊", color: "#7B61C9" },
  lab_report: { icon: "🧪", color: "#1769AA" },
  discharge_summary: { icon: "🏥", color: "#C2593B" },
  diagnostic_report: { icon: "🩺", color: "#12877F" },
  imaging_report: { icon: "🩻", color: "#5D6B7C" },
  consultation_note: { icon: "👨‍⚕️", color: "#2E8B57" },
  other: { icon: "📋", color: "#657789" },
};

export const categoryMeta = (c: string) => CATEGORY_META[c as Category] ?? CATEGORY_META.other;

export const FLAG_STYLE: Record<Flag, { fg: string; bg: string; arrow: string }> = {
  high: { fg: palette.high, bg: palette.highSoft, arrow: "▲" },
  low: { fg: palette.low, bg: palette.lowSoft, arrow: "▼" },
  abnormal: { fg: palette.high, bg: palette.highSoft, arrow: "●" },
  normal: { fg: palette.good, bg: palette.goodSoft, arrow: "✓" },
  unknown: { fg: palette.neutral, bg: palette.neutralSoft, arrow: "" },
};

export const isAbnormal = (flag: Flag) => flag === "low" || flag === "high" || flag === "abnormal";

/** 9.80 -> "9.8", 250000 -> "250000" (no locale grouping: keeps it identical to the printed report). */
export function numberText(n: number) {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}
