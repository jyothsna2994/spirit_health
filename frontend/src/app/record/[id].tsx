import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RangeBar } from "../../components/health/RangeBar";
import { Card, Disclaimer, Empty, FlagBadge, LanguagePicker, Loading, PrimaryButton, SectionTitle } from "../../components/health/ui";
import { palette } from "../../constants/palette";
import { api } from "../../lib/api";
import { confirmAction, notify, shareJson } from "../../lib/dialog";
import { categoryMeta, formatDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { HealthRecord } from "../../lib/types";

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, speech, locale } = useI18n();
  const insets = useSafeAreaInsets();

  const [record, setRecord] = useState<HealthRecord | null>(null);
  const [error, setError] = useState("");
  const [summaryFailure, setSummaryFailure] = useState<{ lang: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  useEffect(() => {
    let alive = true;
    api
      .get<{ record: HealthRecord }>(`/api/records/${id}`)
      .then((r) => alive && setRecord(r.record))
      .catch((e) => alive && setError(e.message || "Record not found"));
    return () => {
      alive = false;
      Speech.stop();
    };
  }, [id]);

  /*
    Summaries are cached per language on the server: the first view in a new language writes it,
    later views are instant. "Busy" is derived (summary missing and no failure yet), not stored.
  */
  const missingSummary = !!record && !record.summaries[lang];
  const summaryBusy = missingSummary && summaryFailure?.lang !== lang;
  const summaryError = summaryFailure?.lang === lang ? summaryFailure.message : "";

  useEffect(() => {
    /* A language switch interrupts any reading in progress (onStopped resets the button). */
    Speech.stop();
    if (!record || record.summaries[lang]) return;

    let alive = true;
    api
      .post<{ summary: string }>(`/api/records/${record.id}/summary`, { lang })
      .then((res) => {
        if (!alive) return;
        setSummaryFailure(null);
        setRecord((cur) =>
          cur ? { ...cur, summaries: { ...cur.summaries, [lang]: res.summary }, summaryStatus: "ready" } : cur
        );
      })
      .catch((e) => alive && setSummaryFailure({ lang, message: e.message || "Something went wrong" }));
    return () => {
      alive = false;
    };
    // `record` is deliberately not a dependency: only the record id and the language trigger a (re)fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, record?.id, attempt]);

  const toggleSpeech = async (text: string) => {
    if (speaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const prefix = speech.slice(0, 2);
      if (voices.length && !voices.some((v) => v.language.toLowerCase().startsWith(prefix))) {
        notify(t("record.noSpeech"));
        return;
      }
    } catch {
      /* voice list unavailable on this platform - just try to speak */
    }
    setSpeaking(true);
    Speech.speak(text, {
      language: speech,
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const remove = () =>
    confirmAction(t("record.deleteAsk"), t("record.deleteDesc"), t("common.delete"), t("common.cancel"), async () => {
      try {
        await api.del(`/api/records/${id}`);
        goBack();
      } catch (e: any) {
        notify(t("common.error"), e.message);
      }
    });

  const exportFhir = async () => {
    try {
      const bundle = await api.get<object>(`/api/records/${id}/fhir`);
      await shareJson(`spirit-health-${id}.fhir.json`, bundle);
    } catch (e: any) {
      notify(t("common.error"), e.message);
    }
  };

  if (error) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <BackBar onBack={goBack} />
        <Empty icon="🔎" title={t("record.notFound")} text={error} />
      </View>
    );
  }
  if (!record) return <Loading />;

  const meta = categoryMeta(record.category);
  const summary = record.summaries[lang];
  const who = [record.provider?.doctor && `${t("record.doctor")}: ${record.provider.doctor}`, record.provider?.hospital && `${t("record.hospital")}: ${record.provider.hospital}`].filter(Boolean);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <BackBar onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------- header ---------- */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>{meta.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{record.title}</Text>
            <Text style={styles.meta}>
              {formatDate(record.documentDate, locale)}
              {record.dateFromDocument === false ? ` (${t("timeline.uploadDate")})` : ""}
            </Text>
            {who.map((w) => (
              <Text key={String(w)} style={styles.meta}>
                {w}
              </Text>
            ))}
          </View>
        </View>

        {record.mode === "mock" && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoText}>{t("home.sampleBanner")}</Text>
          </View>
        )}

        <View style={styles.tagRow}>
          {record.handwritten && <Text style={styles.tag}>✍️ {t("record.handwritten")}</Text>}
          {(record.languagesDetected ?? []).map((l) => (
            <Text key={l} style={styles.tag}>
              🌐 {l.toUpperCase()}
            </Text>
          ))}
        </View>

        {/* ---------- summary ---------- */}
        <Card>
          <SectionTitle>🩺 {t("record.summary")}</SectionTitle>
          <LanguagePicker />
          {summary ? (
            <>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryText} selectable>
                  {summary}
                </Text>
              </View>
              <Pressable onPress={() => toggleSpeech(summary)} style={[styles.voiceButton, speaking && { backgroundColor: palette.highSoft }]} accessibilityRole="button">
                <Text style={[styles.voiceText, speaking && { color: palette.high }]}>
                  {speaking ? `⏹ ${t("record.stop")}` : `🔊 ${t("record.readAloud")}`}
                </Text>
              </Pressable>
            </>
          ) : summaryBusy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={palette.primary} />
              <Text style={styles.busyText}>{t("record.translating")}</Text>
            </View>
          ) : (
            <View>
              {summaryError ? <Text style={styles.errorText}>{summaryError}</Text> : null}
              <PrimaryButton
                label={t("record.generate")}
                onPress={() => {
                  setSummaryFailure(null);
                  setAttempt((n) => n + 1);
                }}
              />
            </View>
          )}
        </Card>

        {/* ---------- abnormal ---------- */}
        {record.abnormalFindings.length > 0 && (
          <Card style={{ borderWidth: 1, borderColor: "#F5C6C2" }}>
            <SectionTitle>⚠️ {t("record.abnormal")}</SectionTitle>
            {record.abnormalFindings.map((f, i) => (
              <View key={i} style={[styles.finding, i > 0 && styles.divider]}>
                <Text style={styles.findingTitle}>{f.finding}</Text>
                <Text style={styles.findingText}>{f.explanation}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* ---------- tests ---------- */}
        {record.tests.length > 0 && (
          <Card>
            <SectionTitle>🧪 {t("record.tests")}</SectionTitle>
            {record.tests.map((x, i) => {
              const canTrend = !!x.canonicalName && x.numericValue !== null;
              return (
                <Pressable
                  key={i}
                  disabled={!canTrend}
                  onPress={() => router.push({ pathname: "/trend/[key]", params: { key: x.canonicalName! } })}
                  style={[styles.testRow, i > 0 && styles.divider]}
                  accessibilityRole={canTrend ? "button" : undefined}
                  accessibilityHint={canTrend ? t("record.viewTrend") : undefined}
                >
                  <View style={styles.testTop}>
                    <Text style={styles.testName}>{x.name}</Text>
                    <FlagBadge flag={x.flag} />
                  </View>
                  <Text style={styles.testValue}>
                    {x.value} <Text style={styles.testUnit}>{x.unit}</Text>
                  </Text>
                  {x.referenceRange ? (
                    <Text style={styles.reference}>
                      {t("record.reference")}: {x.referenceRange}
                    </Text>
                  ) : null}
                  <RangeBar value={x.numericValue} low={x.refLow} high={x.refHigh} flag={x.flag} />
                  {canTrend && <Text style={styles.trendHint}>📈 {t("record.viewTrend")}</Text>}
                </Pressable>
              );
            })}
          </Card>
        )}

        {/* ---------- medicines ---------- */}
        {record.medicines.length > 0 && (
          <Card>
            <SectionTitle>💊 {t("record.medicines")}</SectionTitle>
            {record.medicines.map((m, i) => (
              <View key={i} style={[styles.med, i > 0 && styles.divider]}>
                <Text style={styles.medName}>{m.name}</Text>
                <Text style={styles.medDetail}>{[m.dosage, m.frequency, m.duration].filter(Boolean).join("  ·  ")}</Text>
                {m.instructions ? <Text style={styles.medNote}>{m.instructions}</Text> : null}
              </View>
            ))}
          </Card>
        )}

        {/* ---------- diagnoses / advice / follow-up ---------- */}
        {record.diagnoses.length > 0 && (
          <Card>
            <SectionTitle>📋 {t("record.diagnoses")}</SectionTitle>
            {record.diagnoses.map((d, i) => (
              <Text key={i} style={styles.bullet}>
                • {d}
              </Text>
            ))}
          </Card>
        )}
        {record.advice.length > 0 && (
          <Card>
            <SectionTitle>💡 {t("record.advice")}</SectionTitle>
            {record.advice.map((a, i) => (
              <Text key={i} style={styles.bullet}>
                • {a}
              </Text>
            ))}
          </Card>
        )}
        {record.followUp ? (
          <Card>
            <SectionTitle>📅 {t("record.followUp")}</SectionTitle>
            <Text style={styles.bullet}>{record.followUp}</Text>
          </Card>
        ) : null}

        {record.extractionNotes ? (
          <Card style={{ backgroundColor: palette.warnSoft }}>
            <SectionTitle>🔍 {t("record.aiNotes")}</SectionTitle>
            <Text style={styles.findingText}>{record.extractionNotes}</Text>
          </Card>
        ) : null}

        <Disclaimer />

        <View style={styles.actions}>
          <PrimaryButton label={`⬇ ${t("record.exportFhir")}`} onPress={exportFhir} secondary />
          <PrimaryButton label={`🗑 ${t("common.delete")}`} onPress={remove} danger />
        </View>
      </ScrollView>
    </View>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={t("common.back")}>
      <Text style={styles.backText}>‹ {t("common.back")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 16, paddingBottom: 48 },
  back: { paddingHorizontal: 16, paddingVertical: 8, alignSelf: "flex-start" },
  backText: { fontSize: 17, fontWeight: "700", color: palette.primary },

  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  headerIcon: { fontSize: 36 },
  title: { fontSize: 22, fontWeight: "800", color: palette.text },
  meta: { fontSize: 13, color: palette.muted, marginTop: 2 },
  demoBanner: { backgroundColor: palette.lowSoft, padding: 10, borderRadius: 12, marginBottom: 10 },
  demoText: { color: palette.low, fontWeight: "700", fontSize: 12.5 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tag: { fontSize: 12, fontWeight: "700", color: palette.primary, backgroundColor: palette.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },

  summaryBox: { backgroundColor: palette.primarySoft, borderRadius: 14, padding: 14, marginTop: 4 },
  summaryText: { fontSize: 15, lineHeight: 24, color: palette.text },
  voiceButton: { marginTop: 12, backgroundColor: palette.primarySoft, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  voiceText: { fontWeight: "800", color: palette.primary, fontSize: 15 },
  busy: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  busyText: { color: palette.muted, fontSize: 14 },
  errorText: { color: palette.high, fontWeight: "700", marginTop: 8 },

  finding: { paddingVertical: 8 },
  divider: { borderTopWidth: 1, borderTopColor: palette.border },
  findingTitle: { fontSize: 14.5, fontWeight: "800", color: palette.high },
  findingText: { fontSize: 13.5, lineHeight: 20, color: palette.text, marginTop: 4 },

  testRow: { paddingVertical: 12 },
  testTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  testName: { fontSize: 15, fontWeight: "700", color: palette.text, flex: 1 },
  testValue: { fontSize: 22, fontWeight: "800", color: palette.text, marginTop: 4 },
  testUnit: { fontSize: 13, fontWeight: "600", color: palette.muted },
  reference: { fontSize: 12.5, color: palette.muted, marginTop: 2 },
  trendHint: { fontSize: 12, color: palette.primary, fontWeight: "700", marginTop: 8 },

  med: { paddingVertical: 10 },
  medName: { fontSize: 16, fontWeight: "800", color: palette.text },
  medDetail: { fontSize: 13.5, color: palette.text, marginTop: 3 },
  medNote: { fontSize: 12.5, color: palette.muted, marginTop: 3 },
  bullet: { fontSize: 14.5, lineHeight: 22, color: palette.text, marginBottom: 2 },

  actions: { marginTop: 8, gap: 0 },
});
