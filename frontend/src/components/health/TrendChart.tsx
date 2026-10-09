import React from "react";
import { Platform, View } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { palette } from "../../constants/palette";
import { FLAG_STYLE, formatDate, numberText } from "../../lib/format";
import type { Trend } from "../../lib/types";

const H = 220;
/* SVG text does not inherit the app font on web (falls back to serif). */
const FONT = Platform.select({ web: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", default: undefined });
const PAD = { top: 18, right: 16, bottom: 34, left: 44 };

/** Line chart of one lab value over time, with the reference range as a green band. */
export function TrendChart({ trend, width, locale }: { trend: Trend; width: number; locale: string }) {
  const pts = trend.points;
  if (!pts.length || width <= 0) return null;

  const values = pts.map((p) => p.value);
  const lo = Math.min(...values, trend.refLow ?? Infinity);
  const hi = Math.max(...values, trend.refHigh ?? -Infinity);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  const yMin = lo - pad;
  const yMax = hi + pad;

  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const t0 = new Date(pts[0].date).getTime();
  const t1 = new Date(pts[pts.length - 1].date).getTime();
  const x = (iso: string) =>
    pts.length === 1 || t1 === t0
      ? PAD.left + plotW / 2
      : PAD.left + ((new Date(iso).getTime() - t0) / (t1 - t0)) * plotW;

  const bandTop = trend.refHigh !== null ? y(trend.refHigh) : PAD.top;
  const bandBottom = trend.refLow !== null ? y(trend.refLow) : PAD.top + plotH;
  const hasBand = trend.refLow !== null || trend.refHigh !== null;

  /* Label the edges of the reference band when there is one - that is what the eye compares against. */
  const ticks = hasBand
    ? [trend.refLow, trend.refHigh].filter((v): v is number => v !== null)
    : [lo, (lo + hi) / 2, hi];

  return (
    <View accessible accessibilityLabel={`${trend.name}: ${values.map(numberText).join(", ")}`}>
      <Svg width={width} height={H}>
        {hasBand && (
          <Rect x={PAD.left} y={bandTop} width={plotW} height={Math.max(0, bandBottom - bandTop)} fill="#BFE3CB" opacity={0.55} />
        )}
        {ticks.map((tv, i) => (
          <React.Fragment key={i}>
            <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(tv)} y2={y(tv)} stroke={palette.border} strokeWidth={1} />
            <SvgText x={PAD.left - 6} y={y(tv) + 4} fontSize={11} fontFamily={FONT} fill={palette.muted} textAnchor="end">
              {numberText(tv)}
            </SvgText>
          </React.Fragment>
        ))}
        {pts.length > 1 && (
          <Polyline
            points={pts.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")}
            fill="none"
            stroke={palette.primary}
            strokeWidth={2.5}
          />
        )}
        {pts.map((p, i) => (
          <React.Fragment key={i}>
            <Circle cx={x(p.date)} cy={y(p.value)} r={6} fill={FLAG_STYLE[p.flag].fg} stroke="#fff" strokeWidth={2} />
            <SvgText x={x(p.date)} y={y(p.value) - 12} fontSize={12} fontWeight="700" fontFamily={FONT} fill={palette.text} textAnchor="middle">
              {numberText(p.value)}
            </SvgText>
            <SvgText x={x(p.date)} y={H - 12} fontSize={11} fontFamily={FONT} fill={palette.muted} textAnchor="middle">
              {formatDate(p.date, locale, { day: "numeric", month: "short" })}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}
