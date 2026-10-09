import React from "react";
import { StyleSheet, View } from "react-native";

import { palette } from "../../constants/palette";
import { FLAG_STYLE } from "../../lib/format";
import type { Flag } from "../../lib/types";

/**
 * Where a result sits against its reference range: the green band is the lab's normal range,
 * the dot is the patient's value (coloured by flag). Needs a numeric value and at least one bound.
 */
export function RangeBar({
  value,
  low,
  high,
  flag,
}: {
  value: number | null;
  low: number | null;
  high: number | null;
  flag: Flag;
}) {
  if (value === null || (low === null && high === null)) return null;

  let min: number;
  let max: number;
  if (low !== null && high !== null) {
    const span = high - low || Math.abs(high) || 1;
    min = Math.min(low - span * 0.6, value - span * 0.1);
    max = Math.max(high + span * 0.6, value + span * 0.1);
  } else if (high !== null) {
    min = Math.min(0, value);
    max = Math.max(high * 1.5, value * 1.1);
  } else {
    min = Math.min(0, value);
    max = Math.max((low as number) * 2, value * 1.1);
  }

  const pct = (n: number) => `${Math.max(0, Math.min(100, ((n - min) / (max - min)) * 100))}%` as const;
  const zoneLeft = low !== null ? pct(low) : "0%";
  const zoneRight = high !== null ? pct(high) : "100%";
  const zoneWidth = `${Math.max(
    0,
    parseFloat(zoneRight) - parseFloat(zoneLeft)
  )}%` as const;

  return (
    <View style={styles.track} accessible={false}>
      <View style={[styles.zone, { left: zoneLeft, width: zoneWidth }]} />
      <View style={[styles.dot, { left: pct(value), backgroundColor: FLAG_STYLE[flag].fg }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: 5, backgroundColor: palette.neutralSoft, marginTop: 8, justifyContent: "center" },
  zone: { position: "absolute", top: 0, bottom: 0, backgroundColor: "#BFE3CB", borderRadius: 5 },
  dot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
