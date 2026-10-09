import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import { getSession, clearSession } from "../lib/session";
import { API_URL } from "../constants/api";

type Language = "en" | "te" | "hi";

export default function HomeScreen() {
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<any>(null);

  const [selectedLanguage, setSelectedLanguage] =
    useState<Language>("en");

  const [user, setUser] = useState<any>(null);
const [token, setToken] = useState<string | null>(null);
const [showAccountMenu, setShowAccountMenu] = useState(false);
const [processingStage, setProcessingStage] = useState("");

const [history, setHistory] = useState<any[]>([]);
const [historyLoading, setHistoryLoading] = useState(false);
const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<any>(null);
const [historyError, setHistoryError] = useState("");

/* =====================================================
   LOAD HISTORY
===================================================== */
const loadHistory = async (authToken: string) => {
  try {
    setHistoryLoading(true);
    setHistoryError("");

    const response = await fetch(`${API_URL}/api/records`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not load health history.");
    }

    setHistory(data.records || []);
  } catch (error: any) {
    console.error("History loading error:", error);

    setHistoryError(
      error?.message || "Could not load your previous health records."
    );
  } finally {
    setHistoryLoading(false);
  }
};
/* =====================================================
   OPEN PREVIOUS HEALTH RECORD
===================================================== */
const openHistoryRecord = async (recordId: string) => {
  if (!token) {
    Alert.alert(
      "Session Expired",
      "Please login again."
    );
    router.replace("/auth");
    return;
  }

  try {
    setHistoryLoading(true);

    const response = await fetch(
      `${API_URL}/api/records/${recordId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Could not open this medical record."
      );
    }

    console.log("Opened history record:", data.record);

    setSelectedHistoryRecord(data.record);

    // Put the saved record into the existing result area
    setResult({
  success: true,
  mode: data.record.mode,
  recordId: data.record.id,
  data: {
    documentType: data.record.documentType,
    patientName: data.record.patientName,

    medicines: data.record.medicines || [],
    tests: data.record.tests || [],
    diagnoses: data.record.diagnoses || [],
    abnormalFindings: data.record.abnormalFindings || [],

    healthSummary:
      data.record.summaries?.en ||
      data.record.healthSummary ||
      "",

    teluguSummary:
      data.record.summaries?.te ||
      data.record.teluguSummary ||
      "",

    hindiSummary:
      data.record.summaries?.hi ||
      data.record.hindiSummary ||
      "",

    timelineEvent:
      data.record.timelineEvent || null,
  },
});

  } catch (error: any) {
    console.error("Open history error:", error);

    Alert.alert(
      "Could Not Open Record",
      error?.message ||
        "Unable to open this medical record."
    );
  } finally {
    setHistoryLoading(false);
  }
};



/* =====================================================
   LOAD LOGGED-IN USER
===================================================== */
const loadUser = async () => {
  const session = await getSession();

  if (!session) {
    router.replace("/auth");
    return;
  }

  setUser(session.user);
  setToken(session.token);

  loadHistory(session.token);
};

/* =====================================================
   LOAD USER WHEN DASHBOARD OPENS
===================================================== */
useEffect(() => {
  loadUser();
}, []);
  /* =====================================================
     UPLOAD FILE TO BACKEND
  ===================================================== */

  const uploadMedicalFile = async (
    fileUri: string,
    fileName: string,
    fileType: string
  ) => {
    try {
      setLoading(true);
      setResult(null);

      setProcessingStage(
        "Preparing your medical document..."
      );

      const formData = new FormData();

      if (Platform.OS === "web") {
        const response =
          await fetch(fileUri);

        const blob =
          await response.blob();

        formData.append(
          "document",
          new File(
            [blob],
            fileName,
            {
              type:
                fileType ||
                "image/jpeg",
            }
          )
        );
      } else {
        formData.append(
          "document",
          {
            uri: fileUri,
            name: fileName,
            type:
              fileType ||
              "image/jpeg",
          } as any
        );
      }

      /*
        Send logged-in user ID
        to backend.
      */

      if (user?.id) {
        formData.append(
          "userId",
          user.id
        );
      }

      setProcessingStage(
        "Reading document with OCR..."
      );

      const uploadResponse =
        await fetch(
          `${API_URL}/api/upload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
             },
            body: formData,
          }
        );

      const data =
        await uploadResponse.json();

      /*
        OCR succeeded but Gemini
        failed/quota exhausted.
      */

      if (
        data.mode ===
        "ocr-only"
      ) {
        setResult(data);

        setProcessingStage(
          ""
        );

        Alert.alert(
          "OCR Completed",
          "The document was successfully read, but Gemini AI analysis is currently unavailable."
        );

        return;
      }

      if (
        !uploadResponse.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Medical document processing failed."
        );
      }

      setProcessingStage(
        "Gemini AI is understanding your health record..."
      );

      setResult(data);

      setProcessingStage("");

    } catch (error: any) {
      console.error(
        "Upload error:",
        error
      );

      setProcessingStage("");

      Alert.alert(
        "Processing Error",
        error?.message ||
          "Something went wrong while processing the document."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     PICK DOCUMENT
  ===================================================== */

  const pickDocument =
    async () => {
      try {
        const pickerResult =
          await DocumentPicker.getDocumentAsync(
            {
              type: [
                "application/pdf",
                "image/jpeg",
                "image/png",
              ],

              copyToCacheDirectory:
                true,
            }
          );

        if (
          pickerResult.canceled
        ) {
          return;
        }

        const file =
          pickerResult.assets[0];

        await uploadMedicalFile(
          file.uri,
          file.name,
          file.mimeType ||
            "application/octet-stream"
        );
      } catch (error: any) {
        console.error(
          "Document picker error:",
          error
        );

        Alert.alert(
          "Document Error",
          error?.message ||
            "Could not select the document."
        );
      }
    };

  /* =====================================================
     TAKE PHOTO
  ===================================================== */

  const takePhoto =
    async () => {
      try {
        /*
          Request camera permission.
        */

        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (
          !permission.granted
        ) {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take a photo of your medical document."
          );

          return;
        }

        /*
          Open camera.
        */

        const photo =
          await ImagePicker.launchCameraAsync(
            {
              mediaTypes:
                ["images"],

              allowsEditing:
                true,

              quality: 0.9,
            }
          );

        if (
          photo.canceled
        ) {
          return;
        }

        const captured =
          photo.assets[0];

        await uploadMedicalFile(
          captured.uri,
          `medical_report_${Date.now()}.jpg`,
          "image/jpeg"
        );
      } catch (error: any) {
        console.error(
          "Camera error:",
          error
        );

        Alert.alert(
          "Camera Error",
          error?.message ||
            "Could not open the camera."
        );
      }
    };

  /* =====================================================
     LANGUAGE
  ===================================================== */

  const getSpeechText =
    () => {
      if (
        !result?.data
      ) {
        return "";
      }

      if (
        selectedLanguage ===
        "te"
      ) {
        return (
          result.data
            .teluguSummary ||
          "తెలుగు వివరణ అందుబాటులో లేదు."
        );
      }

      if (
        selectedLanguage ===
        "hi"
      ) {
        return (
          result.data
            .hindiSummary ||
          "हिंदी में विवरण अभी उपलब्ध नहीं है।"
        );
      }

      return (
        result.data
          .healthSummary ||
        "Health summary is not available."
      );
    };

  const getSpeechLanguage =
    () => {
      if (
        selectedLanguage ===
        "te"
      ) {
        return "te-IN";
      }

      if (
        selectedLanguage ===
        "hi"
      ) {
        return "hi-IN";
      }

      return "en-IN";
    };

  const getLanguageLabel =
    () => {
      if (
        selectedLanguage ===
        "te"
      ) {
        return "తెలుగు";
      }

      if (
        selectedLanguage ===
        "hi"
      ) {
        return "हिन्दी";
      }

      return "English";
    };

  /* =====================================================
     VOICE
  ===================================================== */

  const speakSummary =
    async () => {
      const text =
        getSpeechText();

      if (!text) {
        Alert.alert(
          "No Summary",
          "There is no AI summary available to read."
        );

        return;
      }

      try {
        await Speech.stop();

        Speech.speak(text, {
          language:
            getSpeechLanguage(),

          rate: 0.85,

          pitch: 1.0,
        });
      } catch (error) {
        console.error(
          "Speech error:",
          error
        );

        Alert.alert(
          "Voice Error",
          "Voice playback is not available."
        );
      }
    };

  const stopSpeech =
    async () => {
      await Speech.stop();
    };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <View
      style={
        styles.container
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContainer
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* =================================================
    HEADER
================================================= */}

<View style={styles.header}>

  {/* LEFT - LOGO */}

  <View style={styles.brandContainer}>
    <Image
      source={require("../../assets/images/spirit-health.png")}
      style={styles.smallSpiritLogo}
      resizeMode="contain"
    />

    <View style={styles.headerText}>
      <Text style={styles.title}>
        Spirit Health
      </Text>

      <Text style={styles.subtitle}>
        Your health, understood simply
      </Text>
    </View>
  </View>

  {/* RIGHT - ACCOUNT */}

  <View style={styles.accountContainer}>

    <TouchableOpacity
      style={styles.accountButton}
      onPress={() =>
        setShowAccountMenu(!showAccountMenu)
      }
    >
      <Text style={styles.accountIcon}>
        👤
      </Text>

      <Text style={styles.accountButtonText}>
        Account
      </Text>

      <Text style={styles.accountArrow}>
        {showAccountMenu ? "▲" : "▼"}
      </Text>
    </TouchableOpacity>

    {showAccountMenu && (
      <View style={styles.accountMenu}>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            setShowAccountMenu(false);
            Alert.alert(
              "Family Members",
              "Family member accounts will be available here."
            );
          }}
        >
          <Text style={styles.menuIcon}>
            👨‍👩‍👧
          </Text>

          <Text style={styles.menuText}>
            Family Members
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            setShowAccountMenu(false);
            router.replace("/auth");
          }}
        >
          <Text style={styles.menuIcon}>
            🔄
          </Text>

          <Text style={styles.menuText}>
            Switch Account
          </Text>
        </TouchableOpacity>

       <TouchableOpacity
  style={styles.menuItem}
  onPress={async () => {
    try {
      console.log("LOGOUT BUTTON CLICKED");

      await clearSession();

      setUser(null);
      setToken(null);
      setShowAccountMenu(false);

      console.log("LOGOUT: session cleared");

      router.replace("/auth");
    } catch (error) {
      console.error("LOGOUT ERROR:", error);

      Alert.alert(
        "Logout Failed",
        "Could not logout. Please try again."
      );
    }
  }}
>
  <Text style={styles.menuIcon}>
    🚪
  </Text>

  <Text style={styles.menuText}>
    Logout
  </Text>
</TouchableOpacity>

      </View>
    )}

  </View>

</View>

        {/* =================================================
            USER
        ================================================= */}

        {user && (
          <View
            style={
              styles.userCard
            }
          >
            <View>
              <Text
                style={
                  styles.userGreeting
                }
              >
                Hello,{" "}
                {user.fullName} 👋
              </Text>

              <Text
                style={
                  styles.userEmail
                }
              >
                {user.email}
              </Text>
            </View>

            <Text
              style={
                styles.userIcon
              }
            >
              🩺
            </Text>
          </View>
        )}
        {/* =================================================
    DOCTOR GREETING
================================================= */}

<View style={styles.doctorGreetingCard}>

  <View style={styles.doctorGreetingContent}>

    <Text style={styles.doctorGreetingTitle}>
      How are you feeling today? 👋
    </Text>

    <Text style={styles.doctorGreetingText}>
      Let's understand your health together.
    </Text>

  </View>

  <Text style={styles.doctorEmoji}>
    👨‍⚕️
  </Text>

</View>

        {/* =================================================
            UPLOAD SECTION
        ================================================= */}

        <View
          style={
            styles.uploadCard
          }
        >
          <View
            style={
              styles.documentIconCircle
            }
          >
            <Text
              style={
                styles.documentIcon
              }
            >
              📄
            </Text>
          </View>
  

          <Text
            style={
              styles.uploadTitle
            }
          >
            Add Medical Record
          </Text>

          <Text
            style={
              styles.uploadDescription
            }
          >
            Upload an existing medical
            document or take a photo
            of it.
          </Text>

          {/* TWO BUTTONS */}

          <View
            style={
              styles.actionRow
            }
          >

            {/* UPLOAD */}

            <TouchableOpacity
              style={
                styles.actionButton
              }
              onPress={
                  pickDocument
              }
              disabled={
                loading
              }
            >
              <View
                style={
                  styles.actionIconCircle
                }
              >
                <Text
                  style={
                    styles.actionIcon
                  }
                >
                  📄
                </Text>
              </View>

              <Text
                style={
                  styles.actionTitle
                }
              >
                Upload
              </Text>

              <Text
                style={
                  styles.actionSubtitle
                }
              >
                PDF / Image
              </Text>
            </TouchableOpacity>

            {/* CAMERA */}

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.cameraButton,
              ]}
              onPress={
                takePhoto
              }
              disabled={
                loading
              }
            >
              <View
                style={[
                  styles.actionIconCircle,
                  styles.cameraIconCircle,
                ]}
              >
                <Text
                  style={
                    styles.actionIcon
                  }
                >
                  📷
                </Text>
              </View>

              <Text
                style={
                  styles.actionTitle
                }
              >
                Take Photo
              </Text>

              <Text
                style={
                  styles.actionSubtitle
                }
              >
                Use Camera
              </Text>
            </TouchableOpacity>

          </View>

          {/* PROCESSING */}

          {loading && (
            <View
              style={
                styles.loadingContainer
              }
            >
              <ActivityIndicator
                size="large"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                {processingStage ||
                  "Processing..."}
              </Text>

              <Text
                style={
                  styles.loadingSubtext
                }
              >
                OCR → Gemini AI →
                Health Summary
              </Text>
            </View>
          )}
        </View>
        {/* PREVIOUS HEALTH RECORDS */}
<View style={styles.historyCard}>
  <View style={styles.historyHeader}>
    <View>
      <Text style={styles.historyTitle}>Previous Health Records</Text>
      <Text style={styles.historySubtitle}>
        Your saved medical records
      </Text>
    </View>

    {historyLoading && (
      <Text style={styles.historyLoadingText}>Loading...</Text>
    )}
  </View>

  {historyError ? (
    <Text style={styles.historyErrorText}>
      {historyError}
    </Text>
  ) : history.length === 0 && !historyLoading ? (
    <View style={styles.emptyHistoryBox}>
      <Text style={styles.emptyHistoryIcon}>📋</Text>
      <Text style={styles.emptyHistoryTitle}>
        No previous records
      </Text>
      <Text style={styles.emptyHistoryText}>
        Upload your first medical record to see it here.
      </Text>
    </View>
  ) : (
    history.map((record) => (
      <View key={record.id} style={styles.historyItem}>
        <View style={styles.historyItemInfo}>
          <Text style={styles.historyRecordTitle}>
            {record.documentType || "Medical Record"}
          </Text>

          <Text style={styles.historyRecordDate}>
            {record.createdAt
              ? new Date(record.createdAt).toLocaleDateString()
              : "Date unavailable"}
          </Text>

          {record.patientName ? (
            <Text style={styles.historyPatientName}>
              Patient: {record.patientName}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.openHistoryButton}
          onPress={() => openHistoryRecord(record.id)}
        >
          <Text style={styles.openHistoryButtonText}>
            Open
          </Text>
        </TouchableOpacity>
      </View>
    ))
  )}
</View>
        

        {/* =================================================
            OCR ONLY RESULT
        ================================================= */}

        {result?.mode ===
          "ocr-only" && (
          <View
            style={
              styles.ocrCard
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              📄 Document Read
            </Text>

            <View
              style={
                styles.warningBox
              }
            >
              <Text
                style={
                  styles.warningText
                }
              >
                ⚠️ OCR completed,
                but Gemini AI
                analysis is currently
                unavailable.
              </Text>
            </View>

            <Text
              style={
                styles.ocrHint
              }
            >
              This is the actual text
              detected from your
              uploaded document.
            </Text>

            <View
              style={
                styles.ocrTextBox
              }
            >
              <Text
                style={
                  styles.ocrText
                }
              >
                {result.extractedText ||
                  "No readable text found."}
              </Text>
            </View>
          </View>
        )}

        {/* =================================================
            GEMINI RESULT
        ================================================= */}

        {result?.data && (
          <>
            {/* MEDICAL RECORD */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                📋 Medical Record
              </Text>

              <View
                style={
                  styles.infoRow
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  Document
                </Text>

                <Text
                  style={
                    styles.value
                  }
                >
                  {result.data
                    .documentType ||
                    "Medical Document"}
                </Text>
              </View>

              <View
                style={
                  styles.infoRow
                }
              >
                <Text
                  style={
                    styles.label
                  }
                >
                  Patient
                </Text>

                <Text
                  style={
                    styles.value
                  }
                >
                  {result.data
                    .patientName ||
                    "Not detected"}
                </Text>
              </View>
            </View>

            {/* =================================================
                LANGUAGE
            ================================================= */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                🌐 Choose Language
              </Text>

              <View
                style={
                  styles.languageRow
                }
              >
                <TouchableOpacity
                  style={[
                    styles.languageButton,

                    selectedLanguage ===
                      "en" &&
                      styles.selectedLanguage,
                  ]}
                  onPress={() =>
                    setSelectedLanguage(
                      "en"
                    )
                  }
                >
                  <Text
                    style={
                      styles.languageEmoji
                    }
                  >
                    🇬🇧
                  </Text>

                  <Text
                    style={[
                      styles.languageText,

                      selectedLanguage ===
                        "en" &&
                        styles.selectedLanguageText,
                    ]}
                  >
                    English
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.languageButton,

                    selectedLanguage ===
                      "te" &&
                      styles.selectedLanguage,
                  ]}
                  onPress={() =>
                    setSelectedLanguage(
                      "te"
                    )
                  }
                >
                  <Text
                    style={
                      styles.languageEmoji
                    }
                  >
                    🇮🇳
                  </Text>

                  <Text
                    style={[
                      styles.languageText,

                      selectedLanguage ===
                        "te" &&
                        styles.selectedLanguageText,
                    ]}
                  >
                    తెలుగు
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.languageButton,

                    selectedLanguage ===
                      "hi" &&
                      styles.selectedLanguage,
                  ]}
                  onPress={() =>
                    setSelectedLanguage(
                      "hi"
                    )
                  }
                >
                  <Text
                    style={
                      styles.languageEmoji
                    }
                  >
                    🇮🇳
                  </Text>

                  <Text
                    style={[
                      styles.languageText,

                      selectedLanguage ===
                        "hi" &&
                        styles.selectedLanguageText,
                    ]}
                  >
                    हिन्दी
                  </Text>
                </TouchableOpacity>
              </View>

              {/* VOICE */}

              <TouchableOpacity
                style={
                  styles.voiceButton
                }
                onPress={
                  speakSummary
                }
              >
                <Text
                  style={
                    styles.voiceIcon
                  }
                >
                  🔊
                </Text>

                <View
                  style={
                    styles.voiceTextContainer
                  }
                >
                  <Text
                    style={
                      styles.voiceTitle
                    }
                  >
                    Listen in{" "}
                    {getLanguageLabel()}
                  </Text>

                  <Text
                    style={
                      styles.voiceSubtitle
                    }
                  >
                    AI explanation
                    • Voice guidance
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.stopButton
                }
                onPress={
                  stopSpeech
                }
              >
                <Text
                  style={
                    styles.stopButtonText
                  }
                >
                  ⏹ Stop Voice
                </Text>
              </TouchableOpacity>
            </View>

            {/* =================================================
                HEALTH SUMMARY
            ================================================= */}

            <View
              style={
                styles.card
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                🩺 AI Health Summary
              </Text>

              <View
                style={
                  styles.summaryBox
                }
              >
                <Text
                  style={
                    styles.summaryText
                  }
                >
                  {getSpeechText()}
                </Text>
              </View>
            </View>

            {/* =================================================
                MEDICINES
            ================================================= */}

            {result.data
              .medicines
              ?.length >
              0 && (
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  💊 Medicines
                </Text>

                {result.data.medicines.map(
                  (
                    medicine: any,
                    index: number
                  ) => (
                    <View
                      style={
                        styles.itemCard
                      }
                      key={
                        index
                      }
                    >
                      <Text
                        style={
                          styles.itemTitle
                        }
                      >
                        {medicine.name ||
                          "Medicine"}
                      </Text>

                      <Text
                        style={
                          styles.itemText
                        }
                      >
                        Dosage:{" "}
                        {medicine.dosage ||
                          "Not specified"}
                      </Text>

                      <Text
                        style={
                          styles.itemText
                        }
                      >
                        Frequency:{" "}
                        {medicine.frequency ||
                          "Not specified"}
                      </Text>

                      {medicine.duration && (
                        <Text
                          style={
                            styles.itemText
                          }
                        >
                          Duration:{" "}
                          {
                            medicine.duration
                          }
                        </Text>
                      )}
                    </View>
                  )
                )}
              </View>
            )}

            {/* =================================================
                TEST RESULTS
            ================================================= */}

            {result.data.tests
              ?.length >
              0 && (
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  🧪 Test Results
                </Text>

                {result.data.tests.map(
                  (
                    test: any,
                    index: number
                  ) => (
                    <View
                      style={
                        styles.testCard
                      }
                      key={
                        index
                      }
                    >
                      <View
                        style={
                          styles.testHeader
                        }
                      >
                        <Text
                          style={
                            styles.itemTitle
                          }
                        >
                          {test.name ||
                            "Test"}
                        </Text>

                        <Text
                          style={[
                            styles.status,

                            test.status
                              ?.toLowerCase()
                              .includes(
                                "normal"
                              )
                              ? styles.normalStatus
                              : styles.abnormalStatus,
                          ]}
                        >
                          {test.status ||
                            "Not specified"}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.testValue
                        }
                      >
                        {test.value ||
                          "--"}{" "}
                        {test.unit ||
                          ""}
                      </Text>

                      {test.referenceRange && (
                        <Text
                          style={
                            styles.referenceText
                          }
                        >
                          Reference:{" "}
                          {
                            test.referenceRange
                          }
                        </Text>
                      )}
                    </View>
                  )
                )}
              </View>
            )}

            {/* =================================================
                ABNORMAL FINDINGS
            ================================================= */}

            {result.data
              .abnormalFindings
              ?.length >
              0 && (
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  ⚠️ Findings to
                  Discuss
                </Text>

                {result.data.abnormalFindings.map(
                  (
                    finding: any,
                    index: number
                  ) => (
                    <View
                      style={
                        styles.findingCard
                      }
                      key={
                        index
                      }
                    >
                      <Text
                        style={
                          styles.findingTitle
                        }
                      >
                        {
                          finding.finding
                        }
                      </Text>

                      <Text
                        style={
                          styles.findingText
                        }
                      >
                        {
                          finding.explanation
                        }
                      </Text>
                    </View>
                  )
                )}
              </View>
            )}

            {/* =================================================
                TIMELINE
            ================================================= */}

            {result.data
              .timelineEvent && (
              <View
                style={
                  styles.card
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  🕒 Health Timeline
                </Text>

                <View
                  style={
                    styles.timelineCard
                  }
                >
                  <Text
                    style={
                      styles.timelineDate
                    }
                  >
                    {result.data
                      .timelineEvent
                      .date ||
                      "Date not detected"}
                  </Text>

                  <Text
                    style={
                      styles.timelineEvent
                    }
                  >
                    {result.data
                      .timelineEvent
                      .event ||
                      "Medical record analyzed"}
                  </Text>
                </View>
              </View>
            )}

            {/* =================================================
                SAFETY
            ================================================= */}

            <View
              style={
                styles.safetyCard
              }
            >
              <Text
                style={
                  styles.safetyTitle
                }
              >
                🛡️ Important
              </Text>

              <Text
                style={
                  styles.safetyText
                }
              >
                Spirit Health helps
                you understand
                medical records. It
                does not replace a
                doctor. Please discuss
                abnormal results and
                treatment decisions
                with a qualified
                healthcare
                professional.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles =
  StyleSheet.create({
    brandContainer: {
  flexDirection: "row",
  alignItems: "center",
  flex: 1,
},

smallSpiritLogo: {
  width: 48,
  height: 48,
  marginRight: 9,
},

accountContainer: {
  position: "relative",
  zIndex: 20,
},

accountButton: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#D7E0EA",
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 9,
},

accountIcon: {
  fontSize: 18,
  marginRight: 4,
},

accountButtonText: {
  fontSize: 12,
  fontWeight: "700",
  color: "#17324D",
},

accountArrow: {
  fontSize: 9,
  marginLeft: 5,
  color: "#657789",
},

accountMenu: {
  position: "absolute",
  right: 0,
  top: 48,
  width: 190,
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  paddingVertical: 7,
  shadowOpacity: 0.15,
  shadowRadius: 10,
  elevation: 6,
  zIndex: 50,
},

menuItem: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 14,
  paddingVertical: 12,
},

menuIcon: {
  fontSize: 18,
  width: 30,
},

menuText: {
  fontSize: 13,
  fontWeight: "700",
  color: "#17324D",
},

doctorGreetingCard: {
  backgroundColor: "#EAF6F1",
  borderRadius: 18,
  padding: 16,
  marginBottom: 18,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

doctorGreetingContent: {
  flex: 1,
  paddingRight: 10,
},

doctorGreetingTitle: {
  fontSize: 16,
  fontWeight: "800",
  color: "#17324D",
},

doctorGreetingText: {
  fontSize: 12,
  color: "#657789",
  marginTop: 5,
},

doctorEmoji: {
  fontSize: 42,
},
    container: {
      flex: 1,
      backgroundColor:
        "#F5F8FC",
    },

    scrollContainer: {
      padding: 20,
      paddingBottom: 70,
    },

    header: {
      flexDirection:"row",
      alignItems:"center",
      marginBottom: 18,
      zIndex: 20,
    },

    logoCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:"#1769AA",
      justifyContent:"center",
      alignItems: "center",
      marginRight: 12,
    },

    logo: {
      color: "#FFFFFF",
      fontSize: 27,
    },

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 24,
      fontWeight:
        "800",
      color: "#17324D",
    },

    subtitle: {
      fontSize: 13,
      color: "#657789",
      marginTop: 3,
    },

    userCard: {
      backgroundColor:
        "#EAF4FF",
      borderRadius: 15,
      padding: 15,
      marginBottom: 18,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    userGreeting: {
      fontSize: 16,
      fontWeight:
        "800",
      color: "#17324D",
    },

    userEmail: {
      fontSize: 12,
      color: "#657789",
      marginTop: 3,
    },

    userIcon: {
      fontSize: 30,
    },

    uploadCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 22,
      padding: 24,
      alignItems:
        "center",
      marginBottom: 18,
      shadowOpacity:
        0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    /* =====================================================
   PREVIOUS HEALTH RECORDS
===================================================== */

historyCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
},

historyHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
},

historyTitle: {
  fontSize: 18,
  fontWeight: "800",
  color: "#17324D",
},

historySubtitle: {
  fontSize: 12,
  color: "#718096",
  marginTop: 4,
},

historyLoadingText: {
  fontSize: 11,
  color: "#1769AA",
  fontWeight: "700",
},

historyErrorText: {
  fontSize: 13,
  color: "#B42318",
  backgroundColor: "#FFF1F0",
  padding: 12,
  borderRadius: 10,
  lineHeight: 19,
},

emptyHistoryBox: {
  backgroundColor: "#F7F9FC",
  borderRadius: 14,
  padding: 20,
  alignItems: "center",
},

emptyHistoryIcon: {
  fontSize: 30,
  marginBottom: 8,
},

emptyHistoryTitle: {
  fontSize: 14,
  fontWeight: "800",
  color: "#17324D",
},

emptyHistoryText: {
  fontSize: 12,
  color: "#718096",
  textAlign: "center",
  marginTop: 5,
  lineHeight: 18,
},

historyItem: {
  backgroundColor: "#F8FAFC",
  borderRadius: 14,
  padding: 14,
  marginTop: 10,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

historyItemInfo: {
  flex: 1,
  paddingRight: 10,
},

historyRecordTitle: {
  fontSize: 14,
  fontWeight: "800",
  color: "#17324D",
},

historyRecordDate: {
  fontSize: 11,
  color: "#718096",
  marginTop: 4,
},

historyPatientName: {
  fontSize: 11,
  color: "#526779",
  marginTop: 3,
},

openHistoryButton: {
  backgroundColor: "#1769AA",
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 9,
},

openHistoryButtonText: {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "800",
},

    documentIconCircle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor:
        "#EAF4FF",
      justifyContent:
        "center",
      alignItems:
        "center",
      marginBottom: 12,
    },

    documentIcon: {
      fontSize: 38,
    },

    uploadTitle: {
      fontSize: 21,
      fontWeight:
        "800",
      color: "#17324D",
    },

    uploadDescription: {
      fontSize: 13,
      color: "#718096",
      textAlign:
        "center",
      lineHeight: 19,
      marginTop: 7,
      marginBottom: 20,
    },

    actionRow: {
      flexDirection:
        "row",
      width: "100%",
      gap: 12,
    },

    actionButton: {
      flex: 1,
      borderWidth: 1.5,
      borderColor:
        "#1769AA",
      backgroundColor:
        "#F5FAFF",
      borderRadius: 16,
      paddingVertical: 17,
      alignItems:
        "center",
    },

    cameraButton: {
      borderColor:
        "#17324D",
      backgroundColor:
        "#F7F9FC",
    },

    actionIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        "#DDEFFF",
      justifyContent:
        "center",
      alignItems:
        "center",
      marginBottom: 8,
    },

    cameraIconCircle: {
      backgroundColor:
        "#E6EBF1",
    },

    actionIcon: {
      fontSize: 25,
    },

    actionTitle: {
      fontSize: 15,
      fontWeight:
        "800",
      color: "#17324D",
    },

    actionSubtitle: {
      fontSize: 11,
      color: "#718096",
      marginTop: 3,
    },

    loadingContainer: {
      alignItems:
        "center",
      marginTop: 22,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 15,
      fontWeight:
        "700",
      color: "#17324D",
      textAlign:
        "center",
    },

    loadingSubtext: {
      marginTop: 5,
      fontSize: 12,
      color: "#718096",
    },

    card: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      padding: 20,
      marginBottom: 16,
      shadowOpacity:
        0.06,
      shadowRadius: 8,
      elevation: 2,
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight:
        "800",
      color: "#17324D",
      marginBottom: 15,
    },

    infoRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor:
        "#EDF1F5",
    },

    label: {
      fontSize: 14,
      color: "#718096",
    },

    value: {
      fontSize: 14,
      fontWeight:
        "700",
      color: "#263B50",
      maxWidth: "60%",
      textAlign:
        "right",
    },

    languageRow: {
      flexDirection:
        "row",
      gap: 8,
      marginBottom: 18,
    },

    languageButton: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        "#D7E0EA",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems:
        "center",
      backgroundColor:
        "#FAFCFE",
    },

    selectedLanguage: {
      backgroundColor:
        "#1769AA",
      borderColor:
        "#1769AA",
    },

    languageEmoji: {
      fontSize: 20,
      marginBottom: 4,
    },

    languageText: {
      fontSize: 12,
      fontWeight:
        "700",
      color: "#44576A",
    },

    selectedLanguageText: {
      color: "#FFFFFF",
    },

    voiceButton: {
      flexDirection:
        "row",
      alignItems:
        "center",
      backgroundColor:
        "#17324D",
      borderRadius: 15,
      padding: 17,
    },

    voiceIcon: {
      fontSize: 30,
      marginRight: 13,
    },

    voiceTextContainer: {
      flex: 1,
    },

    voiceTitle: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight:
        "800",
    },

    voiceSubtitle: {
      color: "#D5E3EF",
      fontSize: 11,
      marginTop: 3,
    },

    stopButton: {
      alignSelf:
        "center",
      marginTop: 10,
      padding: 8,
    },

    stopButtonText: {
      color: "#1769AA",
      fontSize: 13,
      fontWeight:
        "700",
    },

    summaryBox: {
      backgroundColor:
        "#F0F7FF",
      borderRadius: 14,
      padding: 16,
    },

    summaryText: {
      fontSize: 16,
      lineHeight: 26,
      color: "#263B50",
    },

    itemCard: {
      backgroundColor:
        "#F8FAFC",
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },

    itemTitle: {
      fontSize: 15,
      fontWeight:
        "800",
      color: "#17324D",
      marginBottom: 5,
    },

    itemText: {
      fontSize: 13,
      color: "#5D7083",
      marginTop: 3,
    },

    testCard: {
      backgroundColor:
        "#F8FAFC",
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },

    testHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
    },

    testValue: {
      fontSize: 22,
      fontWeight:
        "800",
      color: "#17324D",
      marginTop: 8,
    },

    referenceText: {
      fontSize: 12,
      color: "#718096",
      marginTop: 4,
    },

    status: {
      fontSize: 11,
      fontWeight:
        "800",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      overflow:
        "hidden",
    },

    normalStatus: {
      backgroundColor:
        "#E7F7ED",
      color: "#1B7A42",
    },

    abnormalStatus: {
      backgroundColor:
        "#FFF0E6",
      color: "#B45309",
    },

    findingCard: {
      backgroundColor:
        "#FFF8F0",
      borderLeftWidth: 4,
      borderLeftColor:
        "#E58A2B",
      padding: 14,
      borderRadius: 10,
      marginBottom: 10,
    },

    findingTitle: {
      fontSize: 14,
      fontWeight:
        "800",
      color: "#7A4300",
    },

    findingText: {
      fontSize: 13,
      color: "#654B2E",
      lineHeight: 20,
      marginTop: 6,
    },

    timelineCard: {
      borderLeftWidth: 4,
      borderLeftColor:
        "#1769AA",
      paddingLeft: 14,
    },

    timelineDate: {
      fontSize: 13,
      fontWeight:
        "800",
      color: "#1769AA",
    },

    timelineEvent: {
      fontSize: 14,
      color: "#40566B",
      marginTop: 5,
    },

    safetyCard: {
      backgroundColor:
        "#EEF5F9",
      borderRadius: 16,
      padding: 18,
      marginBottom: 20,
    },

    safetyTitle: {
      fontSize: 16,
      fontWeight:
        "800",
      color: "#17324D",
      marginBottom: 7,
    },

    safetyText: {
      fontSize: 13,
      color: "#526779",
      lineHeight: 20,
    },

    /* OCR */

    ocrCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor:
        "#F0C36E",
    },

    warningBox: {
      backgroundColor:
        "#FFF6E5",
      padding: 13,
      borderRadius: 10,
    },

    warningText: {
      color: "#8A5A00",
      fontSize: 13,
      lineHeight: 20,
      fontWeight:
        "700",
    },

    ocrHint: {
      fontSize: 12,
      color: "#657789",
      marginTop: 10,
      lineHeight: 18,
    },

    ocrTextBox: {
      backgroundColor:
        "#F7F9FC",
      borderRadius: 12,
      padding: 14,
      marginTop: 15,
      maxHeight: 350,
    },

    ocrText: {
      fontSize: 13,
      color: "#263B50",
      lineHeight: 20,
    },
  });