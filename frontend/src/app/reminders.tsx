import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

import {
  createReminder,
  deleteReminder,
  getReminders,
  type Reminder,
  type ReminderLanguage,
  type ReminderType,
} from "../lib/reminders";

import {
  enableChromeSound,
  playTikTik,
  startChromeReminders,
  syncAndroidReminders,
} from "../lib/reminderAlerts";


const BLUE = "#1769AA";
const NAVY = "#17324D";
const MUTED = "#718096";
const BACKGROUND = "#F5F8FC";

const translations = {
  en: {
    title: "Health Reminders",
    subtitle: "Manage medicines and appointments",
    medicine: "Medicine",
    appointment: "Appointment",
    name: "Medicine name or familiar label",
    appointmentName: "Appointment title",
    nameHint: "Example: Morning white tablet",
    appointmentHint: "Example: Doctor follow-up",
    dosage: "Dosage (only if confirmed)",
    dosageHint: "Example: 1 tablet",
    color: "Tablet color (optional)",
    shape: "Tablet shape (optional)",
    notes: "Instructions / identification notes",
    time: "Reminder time (24-hour HH:MM)",
    date: "Appointment date (YYYY-MM-DD)",
    appointmentTime: "Appointment time (24-hour HH:MM)",
    save: "Save Reminder",
    saved: "Saved Reminders",
    empty: "No reminders saved yet.",
    delete: "Delete",
    active: "Active",
    inactive: "Inactive",
    notification: "Notification delivery is not enabled yet.",
    safety: "Confirm medicine identity, dosage and schedule with your prescription or healthcare professional. Tablet appearance alone cannot identify a medicine.",
    confirm: "I verified this dosage",
  },
  te: {
    title: "ఆరోగ్య రిమైండర్లు",
    subtitle: "మందులు మరియు అపాయింట్‌మెంట్లు",
    medicine: "మందు",
    appointment: "అపాయింట్‌మెంట్",
    name: "మందు పేరు లేదా గుర్తుపేరు",
    appointmentName: "అపాయింట్‌మెంట్ పేరు",
    nameHint: "ఉదా: ఉదయం తెల్ల మాత్ర",
    appointmentHint: "ఉదా: డాక్టర్ ఫాలో-అప్",
    dosage: "ధృవీకరించిన మోతాదు మాత్రమే",
    dosageHint: "ఉదా: ఒక మాత్ర",
    color: "మాత్ర రంగు (ఐచ్ఛికం)",
    shape: "మాత్ర ఆకారం (ఐచ్ఛికం)",
    notes: "సూచనలు / గుర్తింపు వివరాలు",
    time: "సమయం (HH:MM)",
    date: "అపాయింట్‌మెంట్ తేదీ (YYYY-MM-DD)",
    appointmentTime: "అపాయింట్‌మెంట్ సమయం (HH:MM)",
    save: "రిమైండర్ సేవ్ చేయండి",
    saved: "సేవ్ చేసిన రిమైండర్లు",
    empty: "ఇంకా రిమైండర్లు లేవు.",
    delete: "తొలగించు",
    active: "యాక్టివ్",
    inactive: "ఆపివేయబడింది",
    notification: "నోటిఫికేషన్లు ఇంకా ప్రారంభించలేదు.",
    safety: "మందు పేరు, మోతాదు, సమయాన్ని ప్రిస్క్రిప్షన్ లేదా వైద్యునితో నిర్ధారించండి. రంగు లేదా ఆకారంతో మాత్రమే మందును గుర్తించలేము.",
    confirm: "ఈ మోతాదును నిర్ధారించాను",
  },
  hi: {
    title: "स्वास्थ्य रिमाइंडर",
    subtitle: "दवाइयाँ और अपॉइंटमेंट",
    medicine: "दवाई",
    appointment: "अपॉइंटमेंट",
    name: "दवाई का नाम या पहचान",
    appointmentName: "अपॉइंटमेंट का नाम",
    nameHint: "उदाहरण: सुबह की सफेद गोली",
    appointmentHint: "उदाहरण: डॉक्टर फॉलो-अप",
    dosage: "केवल पुष्टि की गई खुराक",
    dosageHint: "उदाहरण: एक गोली",
    color: "गोली का रंग (वैकल्पिक)",
    shape: "गोली का आकार (वैकल्पिक)",
    notes: "निर्देश / पहचान विवरण",
    time: "रिमाइंडर समय (HH:MM)",
    date: "अपॉइंटमेंट तारीख (YYYY-MM-DD)",
    appointmentTime: "अपॉइंटमेंट समय (HH:MM)",
    save: "रिमाइंडर सेव करें",
    saved: "सेव किए गए रिमाइंडर",
    empty: "अभी कोई रिमाइंडर नहीं है।",
    delete: "हटाएँ",
    active: "सक्रिय",
    inactive: "निष्क्रिय",
    notification: "नोटिफिकेशन अभी चालू नहीं हैं।",
    safety: "दवाई की पहचान, खुराक और समय डॉक्टर या पर्चे से सत्यापित करें। केवल रंग या आकार से दवाई की पहचान नहीं होती।",
    confirm: "मैंने खुराक की पुष्टि की है",
  },
  ta: {
    title: "உடல்நல நினைவூட்டல்கள்",
    subtitle: "மருந்துகள் மற்றும் சந்திப்புகள்",
    medicine: "மருந்து",
    appointment: "சந்திப்பு",
    name: "மருந்தின் பெயர் அல்லது அடையாளம்",
    appointmentName: "சந்திப்பின் பெயர்",
    nameHint: "உதா: காலை வெள்ளை மாத்திரை",
    appointmentHint: "உதா: மருத்துவர் சந்திப்பு",
    dosage: "உறுதிப்படுத்திய அளவு மட்டும்",
    dosageHint: "உதா: ஒரு மாத்திரை",
    color: "மாத்திரை நிறம் (விருப்பம்)",
    shape: "மாத்திரை வடிவம் (விருப்பம்)",
    notes: "வழிமுறைகள் / அடையாளக் குறிப்புகள்",
    time: "நினைவூட்டல் நேரம் (HH:MM)",
    date: "சந்திப்பு தேதி (YYYY-MM-DD)",
    appointmentTime: "சந்திப்பு நேரம் (HH:MM)",
    save: "நினைவூட்டலை சேமி",
    saved: "சேமித்த நினைவூட்டல்கள்",
    empty: "நினைவூட்டல்கள் இல்லை.",
    delete: "நீக்கு",
    active: "செயலில்",
    inactive: "செயலற்றது",
    notification: "அறிவிப்புகள் இன்னும் செயல்படுத்தப்படவில்லை.",
    safety: "மருந்தின் பெயர், அளவு, நேரத்தை மருத்துவர் அல்லது மருந்துச் சீட்டுடன் உறுதிப்படுத்தவும். நிறம் அல்லது வடிவம் மட்டும் மருந்தை அடையாளம் காட்டாது.",
    confirm: "இந்த அளவை உறுதிப்படுத்தினேன்",
  },
};

const validTime = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const localDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const localTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

export default function RemindersScreen() {
  const params = useLocalSearchParams<{
    familyMemberId?: string;
    familyMemberName?: string;
  }>();

  const familyMemberId =
    typeof params.familyMemberId === "string"
      ? params.familyMemberId
      : "";

  const familyMemberName =
    typeof params.familyMemberName === "string"
      ? params.familyMemberName
      : "";

  const [language, setLanguage] =
    useState<ReminderLanguage>("en");
  const [type, setType] = useState<ReminderType>("medicine");

  const [title, setTitle] = useState("");
  const [dosage, setDosage] = useState("");
  const [dosageConfirmed, setDosageConfirmed] = useState(false);
  const [color, setColor] = useState("");
  const [shape, setShape] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("08:00");
  const [date, setDate] = useState(localDate(new Date()));
  const [appointmentTime, setAppointmentTime] = useState(
    localTime(new Date(Date.now() + 60 * 60 * 1000))
  );

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const t = translations[language];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
     
const items = await getReminders(familyMemberId);

console.log("Reminder load:", {
  familyMemberId: familyMemberId || "main account",
  count: items.length,
});

setReminders(items);

      
if (Platform.OS === "android") {
  try {
    await syncAndroidReminders(items);
  } catch (notificationError) {
    console.warn(
      "Could not schedule Android reminders:",
      notificationError
    );
  }
}

    } catch (err: any) {
      console.error("Reminder loading failed:", err);
      setError(err?.message || "Could not load reminders.");
    } finally {
      setLoading(false);
    }
  }, [familyMemberId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  
useFocusEffect(
  useCallback(() => {
    if (Platform.OS !== "web" || !soundEnabled) return;

    return startChromeReminders(reminders);
  }, [reminders, soundEnabled])
);


  const resetForm = () => {
    setTitle("");
    setDosage("");
    setDosageConfirmed(false);
    setColor("");
    setShape("");
    setNotes("");
    setTime("08:00");
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a reminder name.");
      return;
    }

    if (type === "medicine" && !validTime(time.trim())) {
      Alert.alert("Invalid time", "Use 24-hour HH:MM, e.g. 08:00.");
      return;
    }

    if (type === "medicine" && dosageConfirmed && !dosage.trim()) {
      Alert.alert("Dosage", "Enter the dosage you have confirmed.");
      return;
    }

    let appointmentAt: string | undefined;

    if (type === "appointment") {
      if (!validDate(date.trim()) || !validTime(appointmentTime.trim())) {
        Alert.alert(
          "Invalid date or time",
          "Use YYYY-MM-DD for date and HH:MM for time."
        );
        return;
      }

      const [year, month, day] = date.split("-").map(Number);
      const [hour, minute] = appointmentTime.split(":").map(Number);

      const appointment = new Date(
        year,
        month - 1,
        day,
        hour,
        minute
      );

      if (appointment.getTime() <= Date.now()) {
        Alert.alert(
          "Invalid appointment",
          "Please choose a future date and time."
        );
        return;
      }

      appointmentAt = appointment.toISOString();
    }

    try {
      setSaving(true);

      await createReminder({
        familyMemberId: familyMemberId || undefined,
        type,
        title: title.trim(),
        displayName: title.trim(),
        identification: {
          color: color.trim(),
          shape: shape.trim(),
          notes: notes.trim(),
        },
        dosage: type === "medicine" ? dosage.trim() : "",
        dosageConfirmed:
          type === "medicine" ? dosageConfirmed : false,
        instructions: notes.trim(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Asia/Kolkata",
        times: type === "medicine" ? [time.trim()] : [],
        appointmentAt,
        language,
        notificationEnabled: false,
        active: true,
      });

      resetForm();
      await load();

      Alert.alert(
  "Saved",
  Platform.OS === "web"
    ? "Reminder saved. Keep this page open with Tik Tik sound enabled to hear the alert."
    : "Reminder saved. Notification scheduling has been requested."
);

    } catch (err: any) {
      Alert.alert(
        "Could not save reminder",
        err?.message || "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteReminder(id);
      await load();
    } catch (err: any) {
      Alert.alert(
        "Could not delete reminder",
        err?.message || "Please try again."
      );
    }
  };

  const confirmDelete = (item: Reminder) => {
    if (Platform.OS === "web") {
      // Avoid relying on Alert.alert for browser confirmations.
      void remove(item._id);
      return;
    }

    Alert.alert(
      "Delete Reminder",
      `Delete "${item.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void remove(item._id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>💊 {t.title}</Text>
        <Text style={styles.subtitle}>
          {familyMemberId
            ? `${familyMemberName || "Family Member"} • ${t.subtitle}`
            : t.subtitle}
        </Text>
        
{Platform.OS === "web" && (
  <TouchableOpacity
   
onPress={async () => {
  try {
    await enableChromeSound();
    setSoundEnabled(true);
  } catch (error: any) {
    setSoundEnabled(false);

    if (Platform.OS === "web") {
      window.alert(
        "Tik Tik sound could not play: " +
          (error?.message || "Unknown audio error")
      );
    }
  }
}}

    style={{
      backgroundColor: BLUE,
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
      alignItems: "center",
    }}
  >
    <Text
      style={{
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 14,
      }}
    >
      {soundEnabled
        ? "🔔 Tik Tik Sound Enabled"
        : "🔔 Enable Tik Tik Sound"}
    </Text>
  </TouchableOpacity>
)}


        <View style={styles.card}>
          <Text style={styles.label}>🌐 Language</Text>

          <View style={styles.languageRow}>
            {(
              [
                ["en", "English"],
                ["te", "తెలుగు"],
                ["hi", "हिन्दी"],
                ["ta", "தமிழ்"],
              ] as const
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.languageButton,
                  language === value && styles.selected,
                ]}
                onPress={() => setLanguage(value)}
              >
                <Text
                  style={[
                    styles.languageText,
                    language === value && styles.selectedText,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.typeRow}>
            {(["medicine", "appointment"] as const).map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.typeButton,
                  type === value && styles.selected,
                ]}
                onPress={() => {
                  setType(value);
                  resetForm();
                }}
              >
                <Text
                  style={[
                    styles.typeText,
                    type === value && styles.selectedText,
                  ]}
                >
                  {value === "medicine"
                    ? `💊 ${t.medicine}`
                    : `📅 ${t.appointment}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>
            {type === "medicine" ? t.name : t.appointmentName}
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={
              type === "medicine"
                ? t.nameHint
                : t.appointmentHint
            }
            placeholderTextColor={MUTED}
          />

          {type === "medicine" ? (
            <>
              <Text style={styles.label}>{t.dosage}</Text>
              <TextInput
                style={styles.input}
                value={dosage}
                onChangeText={(value) => {
                  setDosage(value);
                  setDosageConfirmed(false);
                }}
                placeholder={t.dosageHint}
                placeholderTextColor={MUTED}
              />

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() =>
                  setDosageConfirmed((previous) => !previous)
                }
              >
                <Text style={styles.checkIcon}>
                  {dosageConfirmed ? "☑" : "☐"}
                </Text>
                <Text style={styles.checkText}>{t.confirm}</Text>
              </TouchableOpacity>

              <Text style={styles.label}>{t.color}</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="White / Blue / ..."
                placeholderTextColor={MUTED}
              />

              <Text style={styles.label}>{t.shape}</Text>
              <TextInput
                style={styles.input}
                value={shape}
                onChangeText={setShape}
                placeholder="Round / Oval / ..."
                placeholderTextColor={MUTED}
              />

              <Text style={styles.label}>{t.time}</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="08:00"
                placeholderTextColor={MUTED}
                keyboardType="numbers-and-punctuation"
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>{t.date}</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholder="2026-10-30"
                placeholderTextColor={MUTED}
              />

              <Text style={styles.label}>{t.appointmentTime}</Text>
              <TextInput
                style={styles.input}
                value={appointmentTime}
                onChangeText={setAppointmentTime}
                placeholder="10:30"
                placeholderTextColor={MUTED}
              />
            </>
          )}

          <Text style={styles.label}>{t.notes}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Optional"
            placeholderTextColor={MUTED}
          />

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>✓ {t.save}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.notice}>
  🔔 {Platform.OS === "web"
    ? "Enable Tik Tik sound and keep this page open for browser alerts."
    : "Allow notifications in your phone settings for reminder alerts."}
</Text>
          <Text style={styles.safety}>🛡️ {t.safety}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📋 {t.saved}</Text>

          {loading && <ActivityIndicator color={BLUE} />}

          {!!error && <Text style={styles.error}>{error}</Text>}

          {!loading && !error && reminders.length === 0 && (
            <Text style={styles.empty}>{t.empty}</Text>
          )}

          {reminders.map((item) => (
            <View key={item._id} style={styles.reminderItem}>
              <Text style={styles.itemTitle}>
                {item.type === "medicine" ? "💊" : "📅"}{" "}
                {item.displayName || item.title}
              </Text>

              <Text style={styles.itemText}>
                {item.type === "medicine"
                  ? item.times.join(", ")
                  : item.appointmentAt
                  ? new Date(item.appointmentAt).toLocaleString()
                  : "Date unavailable"}
              </Text>

              {item.type === "medicine" && !!item.dosage && (
                <Text style={styles.itemText}>
                  {item.dosageConfirmed
                    ? `Dosage: ${item.dosage}`
                    : `Unconfirmed dosage: ${item.dosage}`}
                </Text>
              )}

              <Text style={styles.itemText}>
                {item.active ? t.active : t.inactive}
              </Text>

              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  content: { padding: 20, paddingTop: 35, paddingBottom: 70 },
  back: { marginBottom: 16, alignSelf: "flex-start" },
  backText: { color: BLUE, fontSize: 14, fontWeight: "700" },
  heading: { color: NAVY, fontSize: 24, fontWeight: "800" },
  subtitle: {
    color: MUTED,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 13,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D7E0EA",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: NAVY,
    fontSize: 14,
  },
  multiline: { minHeight: 75, textAlignVertical: "top" },
  languageRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  languageButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    backgroundColor: "#FAFCFE",
  },
  languageText: { color: "#44576A", fontSize: 12, fontWeight: "700" },
  selected: { backgroundColor: BLUE, borderColor: BLUE },
  selectedText: { color: "#FFFFFF" },
  typeRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  typeButton: {
    flex: 1,
    alignItems: "center",
    padding: 13,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    borderRadius: 12,
    backgroundColor: "#FAFCFE",
  },
  typeText: { color: NAVY, fontWeight: "700", fontSize: 13 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  checkIcon: { color: BLUE, fontSize: 23, marginRight: 8 },
  checkText: { color: NAVY, fontSize: 12, flex: 1 },
  saveButton: {
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  notice: { color: MUTED, fontSize: 12, marginTop: 15 },
  safety: {
    color: "#526779",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 12,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  empty: { color: MUTED, fontSize: 13 },
  error: { color: "#B42318", fontSize: 13 },
  reminderItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  itemText: { color: "#5D7083", fontSize: 12, marginTop: 4 },
  deleteButton: { alignSelf: "flex-end", marginTop: 12 },
  deleteText: { color: "#B42318", fontSize: 13, fontWeight: "700" },
});
