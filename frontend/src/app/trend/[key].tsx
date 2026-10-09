import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrendChart } from "../../components/health/TrendChart";
import { Card, Disclaimer, Empty, FlagBadge, Loading, SectionTitle } from "../../components/health/ui";
import { palette } from "../../constants/palette";
import { api } from "../../lib/api";
import { formatDate, numberText } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Trend } from "../../lib/types";

export default function TrendScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [trend, setTrend] = useState<Trend | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ trend: Trend }>(`/api/trends/${encodeURIComponent(key)}`)
      .then((r) => setTrend(r.trend))
      .catch((e) => setError(e.message));
  }, [key]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const latest = trend?.points[trend.points.length - 1];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={goBack} style={styles.back} accessibilityRole="button" accessibilityLabel={t("common.back")}>
        <Text style={styles.backText}>‹ {t("common.back")}</Text>
      </Pressable>

      {error ? (
        <Empty icon="📉" title={t("common.error")} text={error} />
      ) : !trend ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>{t("trend.title")}</Text>
          <Text style={styles.title}>{trend.name}</Text>

          {latest && (
            <View style={styles.latestRow}>
              <Text style={styles.latestValue}>
                {numberText(latest.value)} <Text style={styles.unit}>{trend.unit}</Text>
              </Text>
              <FlagBadge flag={latest.flag} />
            </View>
          )}
          {trend.referenceRange ? (
            <Text style={styles.range}>
              {t("trend.range")}: {trend.referenceRange}
            </Text>
          ) : null}

          <Card style={{ marginTop: 14, paddingHorizontal: 8 }}>
            <TrendChart trend={trend} width={width - 32 - 16} locale={locale} />
          </Card>
          {trend.points.length < 2 && <Text style={styles.hint}>{t("trend.onePoint")}</Text>}

          <Card>
            <SectionTitle>{t("record.tests")}</SectionTitle>
            {[...trend.points].reverse().map((p, i) => (
              <Pressable
                key={`${p.recordId}-${i}`}
                onPress={() => router.push({ pathname: "/record/[id]", params: { id: p.recordId } })}
                style={[styles.row, i > 0 && styles.divider]}
                accessibilityRole="button"
              >
                <Text style={styles.rowDate}>{formatDate(p.date, locale)}</Text>
                <Text style={styles.rowValue}>
                  {numberText(p.value)} {trend.unit}
                </Text>
                <FlagBadge flag={p.flag} />
              </Pressable>
            ))}
          </Card>
          <Disclaimer />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 16, paddingBottom: 48 },
  back: { paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" },
  backText: { fontSize: 17, fontWeight: "700", color: palette.primary },
  kicker: { fontSize: 12, fontWeight: "800", color: palette.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 24, fontWeight: "800", color: palette.text, marginTop: 2 },
  latestRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  latestValue: { fontSize: 32, fontWeight: "800", color: palette.text },
  unit: { fontSize: 15, fontWeight: "600", color: palette.muted },
  range: { fontSize: 13, color: palette.muted, marginTop: 4 },
  hint: { fontSize: 13, color: palette.muted, textAlign: "center", marginBottom: 14, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, gap: 8 },
  divider: { borderTopWidth: 1, borderTopColor: palette.border },
  rowDate: { flex: 1.2, fontSize: 14, color: palette.text },
  rowValue: { flex: 1.2, fontSize: 15, fontWeight: "800", color: palette.text },
});
