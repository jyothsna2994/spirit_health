import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Chip, Disclaimer, Empty, FlagBadge, LanguagePicker, Loading, PrimaryButton, SectionTitle } from "../../components/health/ui";
import { palette } from "../../constants/palette";
import { api } from "../../lib/api";
import { notify, shareJson } from "../../lib/dialog";
import { formatDate, isAbnormal, numberText } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import { clearSession } from "../../lib/session";
import type { Profile } from "../../lib/types";

export default function ProfileScreen() {
  const { t, lang, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ profile: Profile }>("/api/profile");
      setProfile(res.profile);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const logout = async () => {
    await clearSession();
    router.replace("/auth");
  };

  if (error && !profile) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Empty icon="⚠️" title={t("common.error")} text={error} actionLabel={t("common.retry")} onAction={load} />
      </View>
    );
  }
  if (!profile) return <Loading />;

  const { user, stats } = profile;
  const activeMeds = profile.medicines.filter((m) => m.status === "active");
  const pastMeds = profile.medicines.filter((m) => m.status !== "active");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[styles.screen, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t("profile.title")}</Text>

        {/* ---------- identity + numbers ---------- */}
        <Card>
          <View style={styles.idRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.fullName.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user.fullName}</Text>
              <Text style={styles.sub}>{user.email}</Text>
              <Text style={styles.sub}>
                {[user.age && `${t("profile.age")}: ${user.age}`, user.gender && t(`profile.${user.gender as "male" | "female" | "other"}` as const)].filter(Boolean).join("  ·  ")}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Stat value={stats.records} label={t("profile.records")} />
            <Stat value={stats.abnormalLabs} label={t("profile.outOfRange")} danger={stats.abnormalLabs > 0} />
            <Stat value={activeMeds.length} label={t("profile.currentMeds")} />
          </View>
        </Card>

        {/* ---------- language ---------- */}
        <Card>
          <SectionTitle>🌐 {t("common.language")}</SectionTitle>
          <LanguagePicker />
        </Card>

        <Overview hasRecords={stats.records > 0} />

        {/* ---------- medicines ---------- */}
        <Card>
          <SectionTitle>💊 {t("profile.currentMeds")}</SectionTitle>
          {activeMeds.length === 0 ? (
            <Text style={styles.muted}>{t("profile.noMeds")}</Text>
          ) : (
            activeMeds.map((m, i) => (
              <Pressable
                key={m.name}
                onPress={() => router.push({ pathname: "/record/[id]", params: { id: m.recordId } })}
                style={[styles.item, i > 0 && styles.divider]}
                accessibilityRole="button"
              >
                <Text style={styles.itemTitle}>{m.name}</Text>
                <Text style={styles.itemText}>{[m.dosage, m.frequency].filter(Boolean).join("  ·  ")}</Text>
                <Text style={styles.itemMeta}>
                  {t("profile.since")} {formatDate(m.prescribedOn, locale)}
                  {m.endsOn ? `  ·  ${t("profile.until")} ${formatDate(m.endsOn, locale)}` : ""}
                </Text>
              </Pressable>
            ))
          )}
          {pastMeds.length > 0 && (
            <>
              <Text style={[styles.subhead, { marginTop: 14 }]}>{t("profile.pastMeds")}</Text>
              {pastMeds.map((m) => (
                <Text key={m.name} style={styles.pastMed}>
                  {m.name} · {formatDate(m.prescribedOn, locale)}
                </Text>
              ))}
            </>
          )}
        </Card>

        {/* ---------- conditions ---------- */}
        <Card>
          <SectionTitle>📋 {t("profile.conditions")}</SectionTitle>
          {profile.conditions.length === 0 ? (
            <Text style={styles.muted}>{t("profile.noConditions")}</Text>
          ) : (
            profile.conditions.map((c, i) => (
              <Pressable
                key={c.name}
                onPress={() => router.push({ pathname: "/record/[id]", params: { id: c.recordId } })}
                style={[styles.item, i > 0 && styles.divider]}
                accessibilityRole="button"
              >
                <Text style={styles.itemTitle}>{c.name}</Text>
                <Text style={styles.itemMeta}>
                  {formatDate(c.firstSeen, locale)}
                  {c.mentions > 1 ? `  →  ${formatDate(c.lastSeen, locale)}  (${c.mentions}×)` : ""}
                </Text>
              </Pressable>
            ))
          )}
        </Card>

        {/* ---------- labs ---------- */}
        <Labs profile={profile} locale={locale} />

        <AboutMe profile={profile} onSaved={load} />
        <AbhaCard profile={profile} onChanged={load} />

        <Disclaimer />
        <PrimaryButton label={t("profile.logout")} onPress={logout} secondary />
        <Text style={styles.footer}>Spirit Health Copilot · {lang.toUpperCase()}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ value, label, danger }: { value: number; label: string; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, danger && { color: palette.high }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ---------- AI overview ---------- */

function Overview({ hasRecords }: { hasRecords: boolean }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const [forLang, setForLang] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ overview: string }>("/api/profile/overview", { lang });
      setText(res.overview);
      setForLang(lang);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>✨ {t("profile.overview")}</SectionTitle>
      {!hasRecords ? (
        <Text style={styles.muted}>{t("profile.overviewEmpty")}</Text>
      ) : (
        <>
          {text ? (
            <View style={styles.overviewBox}>
              <Text style={styles.overviewText} selectable>
                {text}
              </Text>
            </View>
          ) : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {busy ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: 12 }} />
          ) : (
            <PrimaryButton label={text && forLang === lang ? t("profile.overviewRefresh") : t("profile.overviewGenerate")} onPress={generate} secondary={!!text} />
          )}
        </>
      )}
    </Card>
  );
}

/* ---------- latest labs ---------- */

function Labs({ profile, locale }: { profile: Profile; locale: string }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const labs = all ? profile.labs : profile.labs.slice(0, 6);

  return (
    <Card>
      <SectionTitle>🧪 {t("profile.labs")}</SectionTitle>
      {profile.labs.length === 0 ? (
        <Text style={styles.muted}>{t("profile.noLabs")}</Text>
      ) : (
        <>
          {labs.map((l, i) => {
            const arrow = l.change === "up" ? "↑" : l.change === "down" ? "↓" : l.change === "same" ? "→" : "";
            return (
              <Pressable
                key={l.key}
                onPress={() => router.push({ pathname: "/trend/[key]", params: { key: l.key } })}
                style={[styles.labRow, i > 0 && styles.divider]}
                accessibilityRole="button"
                accessibilityHint={t("record.viewTrend")}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{l.name}</Text>
                  <Text style={styles.itemMeta}>
                    {formatDate(l.date, locale)}
                    {l.previous ? `  ·  ${t("profile.previous")} ${l.previous.value}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={[styles.labValue, isAbnormal(l.flag) && { color: palette.high }]}>
                    {arrow} {l.numericValue !== null ? numberText(l.numericValue) : l.value} <Text style={styles.unit}>{l.unit}</Text>
                  </Text>
                  <FlagBadge flag={l.flag} />
                </View>
              </Pressable>
            );
          })}
          {profile.labs.length > 6 && (
            <Pressable onPress={() => setAll(!all)} style={{ paddingTop: 12 }} accessibilityRole="button">
              <Text style={styles.link}>{all ? "▲" : `▼  +${profile.labs.length - 6}`}</Text>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------- about me (gender / date of birth feed the FHIR Patient and sex-specific ranges) ---------- */

function AboutMe({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const { t } = useI18n();
  const [gender, setGender] = useState(profile.user.gender);
  const [dob, setDob] = useState(profile.user.dateOfBirth?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch("/api/me", { gender, dateOfBirth: dob.trim() });
      onSaved();
      notify("✓", t("common.save"));
    } catch (e: any) {
      notify(t("common.error"), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle>🙋 {t("profile.about")}</SectionTitle>
      <Text style={styles.subhead}>{t("profile.gender")}</Text>
      <View style={styles.chips}>
        {(["male", "female", "other"] as const).map((g) => (
          <Chip key={g} label={t(`profile.${g}` as const)} selected={gender === g} onPress={() => setGender(gender === g ? "" : g)} />
        ))}
      </View>
      <Text style={styles.subhead}>{t("profile.dob")}</Text>
      <TextInput
        value={dob}
        onChangeText={setDob}
        placeholder="1984-03-02"
        placeholderTextColor={palette.muted}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoCorrect={false}
        style={styles.input}
        accessibilityLabel={t("profile.dob")}
      />
      <PrimaryButton label={t("common.save")} onPress={save} disabled={busy} />
    </Card>
  );
}

/* ---------- ABHA link (mock) + FHIR export ---------- */

function AbhaCard({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const { t } = useI18n();
  const abha = profile.user.abha;
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [txn, setTxn] = useState<{ id: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      notify(t("common.error"), e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = () =>
    run(async () => {
      const looksLikeAddress = value.includes("@");
      const res = await api.post<{ txnId: string; message: string }>("/api/abha/link/initiate", looksLikeAddress ? { abhaAddress: value.trim() } : { abhaNumber: value.trim() });
      setTxn({ id: res.txnId, message: res.message });
    });

  const verify = () =>
    run(async () => {
      await api.post("/api/abha/link/verify", { txnId: txn!.id, otp: otp.trim() });
      setTxn(null);
      setOtp("");
      setValue("");
      onChanged();
    });

  const unlink = () =>
    run(async () => {
      await api.del("/api/abha");
      onChanged();
    });

  const exportAll = () =>
    run(async () => {
      const bundle = await api.get<object>("/api/fhir/bundle");
      await shareJson("spirit-health-records.fhir.json", bundle);
    });

  return (
    <Card>
      <SectionTitle>🪪 {t("abha.title")}</SectionTitle>
      <View style={styles.demoPill}>
        <Text style={styles.demoPillText}>{t("abha.demo")}</Text>
      </View>

      {abha ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.linked}>✓ {t("abha.linked")}</Text>
          {abha.number ? <Text style={styles.abhaValue}>{abha.number}</Text> : null}
          {abha.address ? <Text style={styles.abhaValue}>{abha.address}</Text> : null}
          <PrimaryButton label={t("abha.unlink")} onPress={unlink} danger disabled={busy} />
        </View>
      ) : txn ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.muted}>{txn.message}</Text>
          <TextInput
            value={otp}
            onChangeText={setOtp}
            placeholder={t("abha.otp")}
            placeholderTextColor={palette.muted}
            keyboardType="number-pad"
            maxLength={6}
            style={[styles.input, { marginTop: 10 }]}
            accessibilityLabel={t("abha.otp")}
          />
          <PrimaryButton label={t("abha.verify")} onPress={verify} disabled={busy || otp.length < 4} />
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.muted}>{t("abha.desc")}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={t("abha.input")}
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { marginTop: 10 }]}
            accessibilityLabel={t("abha.input")}
          />
          <PrimaryButton label={t("abha.sendOtp")} onPress={sendOtp} disabled={busy || value.trim().length < 5} />
        </View>
      )}

      <PrimaryButton label={`⬇ ${t("abha.exportAll")}`} onPress={exportAll} secondary disabled={busy || profile.stats.records === 0} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: palette.text, marginTop: 8, marginBottom: 14 },

  idRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: palette.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  name: { fontSize: 19, fontWeight: "800", color: palette.text },
  sub: { fontSize: 13, color: palette.muted, marginTop: 1 },
  statsRow: { flexDirection: "row", marginTop: 16, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 14 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800", color: palette.text },
  statLabel: { fontSize: 11.5, color: palette.muted, marginTop: 2, textAlign: "center" },

  muted: { fontSize: 14, lineHeight: 20, color: palette.muted },
  errorText: { color: palette.high, fontWeight: "700", marginTop: 8 },
  subhead: { fontSize: 12, fontWeight: "800", color: palette.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  link: { color: palette.primary, fontWeight: "800", textAlign: "center", fontSize: 14 },

  item: { paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: palette.border },
  itemTitle: { fontSize: 15, fontWeight: "800", color: palette.text },
  itemText: { fontSize: 13.5, color: palette.text, marginTop: 2 },
  itemMeta: { fontSize: 12, color: palette.muted, marginTop: 2 },
  pastMed: { fontSize: 13, color: palette.muted, paddingVertical: 2 },

  labRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, gap: 10 },
  labValue: { fontSize: 17, fontWeight: "800", color: palette.text },
  unit: { fontSize: 12, fontWeight: "600", color: palette.muted },

  overviewBox: { backgroundColor: palette.primarySoft, borderRadius: 14, padding: 14, marginTop: 4 },
  overviewText: { fontSize: 14.5, lineHeight: 23, color: palette.text },

  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: palette.text, backgroundColor: "#fff" },

  demoPill: { alignSelf: "flex-start", backgroundColor: palette.lowSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  demoPillText: { color: palette.low, fontSize: 12, fontWeight: "800" },
  linked: { color: palette.good, fontWeight: "800", fontSize: 15 },
  abhaValue: { fontSize: 17, fontWeight: "800", color: palette.text, marginTop: 4, letterSpacing: 0.3 },

  footer: { textAlign: "center", color: palette.muted, fontSize: 11, marginTop: 16 },
});
