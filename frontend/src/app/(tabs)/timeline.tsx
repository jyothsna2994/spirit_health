import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, Disclaimer, Empty, Loading } from "../../components/health/ui";
import { palette, shadow } from "../../constants/palette";
import { api } from "../../lib/api";
import { categoryMeta, FLAG_STYLE, formatDate, monthTitle } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { Category, TimelineEvent } from "../../lib/types";

export default function TimelineScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | Category>("all");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ events: TimelineEvent[] }>("/api/timeline");
      setEvents(res.events);
      setError("");
    } catch (e: any) {
      setError(e.message || t("common.error"));
    }
  }, [t]);

  /* Reload every time the tab is shown, so a record uploaded on the first tab appears straight away. */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categories = useMemo(() => {
    const present = new Set((events ?? []).map((e) => e.category));
    return (["prescription", "lab_report", "discharge_summary", "diagnostic_report", "imaging_report", "consultation_note", "other"] as Category[]).filter((c) =>
      present.has(c)
    );
  }, [events]);

  const sections = useMemo(() => {
    const filtered = (events ?? []).filter((e) => filter === "all" || e.category === filter);
    const byMonth = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const key = monthTitle(e.date, locale);
      byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
    }
    return [...byMonth.entries()].map(([title, data]) => ({ title, data }));
  }, [events, filter, locale]);

  if (!events && !error) return <Loading />;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{t("timeline.title")}</Text>
            <Text style={styles.subtitle}>{t("timeline.subtitle")}</Text>
            {error ? (
              <Pressable onPress={load} style={styles.errorBox} accessibilityRole="button">
                <Text style={styles.errorText}>
                  {error} - {t("common.retry")}
                </Text>
              </Pressable>
            ) : null}
            {categories.length > 1 && (
              <View style={styles.filters}>
                <Chip label={t("cat.all")} selected={filter === "all"} onPress={() => setFilter("all")} />
                {categories.map((c) => (
                  <Chip key={c} label={t(`cat.${c}` as const)} selected={filter === c} onPress={() => setFilter(c)} />
                ))}
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => <Text style={styles.month}>{section.title}</Text>}
        renderItem={({ item }) => <EventCard event={item} />}
        ListEmptyComponent={
          !error ? (
            <Empty
              icon="🗂️"
              title={t("timeline.empty")}
              text={t("timeline.emptyDesc")}
              actionLabel={t("tab.upload")}
              onAction={() => router.navigate("/")}
            />
          ) : null
        }
        ListFooterComponent={events && events.length ? <Disclaimer /> : null}
      />
    </View>
  );
}

function EventCard({ event }: { event: TimelineEvent }) {
  const { t, locale } = useI18n();
  const meta = categoryMeta(event.category);
  const who = [event.doctor, event.hospital].filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatDate(event.date, locale)}`}
      onPress={() => router.push({ pathname: "/record/[id]", params: { id: event.id } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.rail, { backgroundColor: meta.color }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.icon}>{meta.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatDate(event.date, locale)}
              {event.dateFromDocument === false ? ` (${t("timeline.uploadDate")})` : ""}
              {who ? `  ·  ${who}` : ""}
            </Text>
          </View>
        </View>

        {event.highlights.map((line, i) => (
          <Text key={i} style={i === 0 ? styles.summary : styles.summarySub} numberOfLines={2}>
            {line}
          </Text>
        ))}

        {event.abnormalTests.length > 0 && (
          <View style={styles.abnormalRow}>
            {event.abnormalTests.map((a) => (
              <Text key={a.name} style={[styles.abnormalTag, { color: FLAG_STYLE[a.flag].fg, backgroundColor: FLAG_STYLE[a.flag].bg }]}>
                {FLAG_STYLE[a.flag].arrow} {a.name}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.countRow}>
          {event.counts.abnormal > 0 && <Text style={[styles.count, { color: palette.high }]}>{t("timeline.abnormal", { n: event.counts.abnormal })}</Text>}
          {event.counts.medicines > 0 && <Text style={styles.count}>{t("timeline.medicines", { n: event.counts.medicines })}</Text>}
          {event.counts.tests > 0 && <Text style={styles.count}>{t("timeline.tests", { n: event.counts.tests })}</Text>}
          {event.handwritten && <Text style={styles.count}>✍️ {t("record.handwritten")}</Text>}
          {event.mock && <Text style={[styles.count, { color: palette.low }]}>DEMO</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: palette.text, marginTop: 8 },
  subtitle: { fontSize: 13, color: palette.muted, marginTop: 2, marginBottom: 14 },
  filters: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  month: { fontSize: 13, fontWeight: "800", color: palette.muted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 10, marginBottom: 8 },
  errorBox: { backgroundColor: palette.highSoft, padding: 12, borderRadius: 12, marginBottom: 12 },
  errorText: { color: palette.high, fontWeight: "700" },

  card: { flexDirection: "row", backgroundColor: palette.card, borderRadius: 18, marginBottom: 12, overflow: "hidden", ...shadow },
  rail: { width: 5 },
  body: { flex: 1, padding: 14 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { fontSize: 26 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: palette.text },
  meta: { fontSize: 12, color: palette.muted, marginTop: 2 },
  summary: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: palette.text, marginTop: 10 },
  summarySub: { fontSize: 13, lineHeight: 18, color: palette.muted, marginTop: 4 },
  abnormalRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  abnormalTag: { fontSize: 12, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
  countRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  count: { fontSize: 12, fontWeight: "700", color: palette.muted },
});
