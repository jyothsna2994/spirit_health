import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { palette, shadow } from "../../constants/palette";
import { FLAG_STYLE } from "../../lib/format";
import { LANGS, useI18n } from "../../lib/i18n";
import type { Flag } from "../../lib/types";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Colour AND text/arrow, so the status is not conveyed by colour alone. */
export function FlagBadge({ flag }: { flag: Flag }) {
  const { t } = useI18n();
  const s = FLAG_STYLE[flag] ?? FLAG_STYLE.unknown;
  if (flag === "unknown") return null;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>
        {s.arrow} {t(`flag.${flag}` as const)}
      </Text>
    </View>
  );
}

export function LanguagePicker() {
  const { lang, setLang } = useI18n();
  return (
    <View style={styles.langRow}>
      {LANGS.map((l) => (
        <Chip key={l.code} label={l.native} selected={lang === l.code} onPress={() => setLang(l.code)} />
      ))}
    </View>
  );
}

export function Disclaimer() {
  const { t } = useI18n();
  return (
    <View style={styles.disclaimer}>
      <Text style={styles.disclaimerTitle}>🛡️ {t("common.important")}</Text>
      <Text style={styles.disclaimerText}>{t("common.disclaimer")}</Text>
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={palette.primary} />
      <Text style={styles.centerText}>{text ?? t("common.loading")}</Text>
    </View>
  );
}

export function Empty({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.centerText}>{text}</Text> : null}
      {actionLabel ? (
        <Pressable onPress={onAction} style={styles.primaryButton} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[
        styles.primaryButton,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.primaryButtonText, secondary && { color: palette.primary }, danger && { color: palette.high }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.card, borderRadius: 20, padding: 16, marginBottom: 14, ...shadow },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: palette.text, flexShrink: 1 },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: palette.text },
  chipTextSelected: { color: "#fff" },
  langRow: { flexDirection: "row", flexWrap: "wrap" },

  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "800" },

  disclaimer: { backgroundColor: palette.warnSoft, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: palette.warnBorder, marginTop: 4 },
  disclaimerTitle: { fontSize: 14, fontWeight: "800", color: palette.text, marginBottom: 4 },
  disclaimerText: { fontSize: 12.5, lineHeight: 18, color: palette.muted },

  center: { alignItems: "center", justifyContent: "center", padding: 32 },
  centerText: { marginTop: 10, color: palette.muted, textAlign: "center", fontSize: 14, lineHeight: 20 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { marginTop: 8, fontSize: 18, fontWeight: "800", color: palette.text },

  primaryButton: { marginTop: 14, backgroundColor: palette.primary, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 14, alignItems: "center" },
  secondaryButton: { backgroundColor: palette.primarySoft },
  dangerButton: { backgroundColor: palette.highSoft },
  primaryButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
