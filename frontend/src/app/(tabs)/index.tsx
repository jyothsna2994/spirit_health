import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguagePicker } from "../../components/health/ui";
import { api, ApiError, filePart } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { getSession } from "../../lib/session";

type Language = "en" | "te" | "hi";

export default function HomeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState<any>(null);

  const [selectedLanguage, setSelectedLanguage] =
    useState<Language>("en");

  const [user, setUser] = useState<any>(null);

  const [processingStage, setProcessingStage] =
    useState("");

  /* =====================================================
     LOAD LOGGED-IN USER
  ===================================================== */
  useEffect(() => {
    getSession().then((session) => {
      if (session) {
        setUser(session.user);
      } else {
        router.replace("/auth");
      }
    });
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

      formData.append(
        "document",
        await filePart(
          fileUri,
          fileName,
          fileType
        )
      );

      /*
        The backend identifies the user from
        the login token, not from the form.
      */

      setProcessingStage(
        "Gemini AI is reading your document..."
      );

      const data: any =
        await api.upload(
          "/api/upload",
          formData
        );

      setResult(data);

      setProcessingStage("");

      if (data.duplicate) {
        Alert.alert(
          t("home.duplicate")
        );
      }

    } catch (error: any) {
      console.error(
        "Upload error:",
        error
      );

      setProcessingStage("");

      /*
        Gemini failed / quota exhausted:
        the server still returns any text
        it could read from a photo.
      */

      if (
        error instanceof ApiError &&
        error.body?.mode ===
          "ocr-only"
      ) {
        setResult(error.body);
      }

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
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingTop: 20 + insets.top },
        ]}
        showsVerticalScrollIndicator={
          false
        }
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.logoCircle
            }
          >
            <Text
              style={
                styles.logo
              }
            >
              ❤
            </Text>
          </View>

          <View
            style={
              styles.headerText
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Spirit Health
              Copilot
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              {t("home.subtitle")}
            </Text>
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
                {t("home.hello")}{" "}
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

        <View style={{ marginBottom: 10 }}>
          <LanguagePicker />
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
            {t("home.addRecord")}
          </Text>

          <Text
            style={
              styles.uploadDescription
            }
          >
            {t("home.addRecordDesc")}
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
                {t("home.upload")}
              </Text>

              <Text
                style={
                  styles.actionSubtitle
                }
              >
                {t("home.pdfImage")}
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
                {t("home.takePhoto")}
              </Text>

              <Text
                style={
                  styles.actionSubtitle
                }
              >
                {t("home.useCamera")}
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
                  t("home.processing")}
              </Text>

              <Text
                style={
                  styles.loadingSubtext
                }
              >
                {t("home.pipeline")}
              </Text>
            </View>
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
            {result.mode === "mock" && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  {t("home.sampleBanner")}
                </Text>
              </View>
            )}

            {result.recordId && (
              <TouchableOpacity
                style={styles.openRecordButton}
                onPress={() =>
                  router.push({
                    pathname:
                      "/record/[id]",
                    params: {
                      id: result.recordId,
                    },
                  })
                }
                accessibilityRole="button"
              >
                <Text
                  style={
                    styles.openRecordText
                  }
                >
                  {t("home.openRecord")} ›
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.openTimelineButton}
              onPress={() =>
                router.navigate(
                  "/timeline"
                )
              }
              accessibilityRole="button"
            >
              <Text
                style={
                  styles.openTimelineText
                }
              >
                🕒 {t("home.openTimeline")}
              </Text>
            </TouchableOpacity>

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
    container: {
      flex: 1,
      backgroundColor:
        "#F5F8FC",
    },

    openRecordButton: {
      backgroundColor: "#1769AA",
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      marginBottom: 10,
    },

    openRecordText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 16,
    },

    openTimelineButton: {
      backgroundColor: "#EAF4FF",
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      marginBottom: 18,
    },

    openTimelineText: {
      color: "#1769AA",
      fontWeight: "800",
      fontSize: 15,
    },

    scrollContainer: {
      padding: 20,
      paddingBottom: 70,
    },

    header: {
      flexDirection:
        "row",
      alignItems:
        "center",
      marginBottom: 18,
    },

    logoCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        "#1769AA",
      justifyContent:
        "center",
      alignItems:
        "center",
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