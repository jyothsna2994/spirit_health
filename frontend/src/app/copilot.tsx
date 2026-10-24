import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getSession } from "../lib/session";
import { API_URL } from "../constants/api";

import {
  startVoiceInput,
  stopVoiceOutput,
  speakVoice,
  voiceSupported,
} from "../lib/copilotVoice";


type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: {
    recordId: string;
    title: string;
    date: string;
  }[];
};

export default function CopilotScreen() {
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

  const [token, setToken] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [question, setQuestion] = useState("");
  const [selectedVoiceLanguage, setSelectedVoiceLanguage] =
  useState<"en" | "te" | "hi" | "ta">("en");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text:
  "Hello! 👋 I'm Spirit Mitra, your personal health companion. " +
  "I can help you understand your saved medical reports, medicines, " +
  "test results and follow-up instructions. What would you like to know?", 
      
    },
  ]);

  const scrollRef = useRef<ScrollView>(null);
  
const [listening, setListening] = useState(false);
const [speaking, setSpeaking] = useState(false);
const [voiceReplyEnabled, setVoiceReplyEnabled] =
  useState(false);

const recognitionRef = useRef<{
  stop: () => void;
} | null>(null);

const voiceReplyRef = useRef(false);

const startListening = () => {
  if (Platform.OS !== "web") return;

  if (!voiceSupported()) {
    window.alert("Voice input is unavailable in this browser.");
    return;
  }

  stopVoiceOutput();
  setSpeaking(false);

  if (listening) {
    recognitionRef.current?.stop();
    return;
  }
  const voiceLanguage =
  selectedVoiceLanguage === "te" ? "te-IN" :
  selectedVoiceLanguage === "hi" ? "hi-IN" :
  selectedVoiceLanguage === "ta" ? "ta-IN" :
  "en-IN";  

  const recognition = startVoiceInput(
    (text) => {
      setQuestion(text);
    },
    () => {
      setListening(false);
      recognitionRef.current = null;
    },
    (message) => {
      setListening(false);
      window.alert(message);
    }
  );

  if (recognition) {
    recognitionRef.current = recognition;
    setListening(true);
  }
};

useEffect(() => {
  return () => {
    recognitionRef.current?.stop();
    stopVoiceOutput();
  };
}, []);


  useEffect(() => {
    let active = true;

    async function loadSession() {
      const session = await getSession();

      if (!active) return;

      if (!session?.token) {
        router.replace("/auth");
        return;
      }

      setToken(session.token);
await loadChatHistory(session.token);

if (active) {
  setLoadingSession(false);
}
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

const loadChatHistory = async (authToken: string) => {
  try {
    const url =
      `${API_URL}/api/copilot/history?familyMemberId=` +
      encodeURIComponent(familyMemberId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.status === 401) {
      router.replace("/auth");
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Could not load chat history."
      );
    }

    if (Array.isArray(data.messages) && data.messages.length) {
      setMessages(data.messages);
    }
    
if (Platform.OS === "web" && voiceReplyRef.current) {
  const answerText = String(
    data.answer || "No answer available."
  );

  setSpeaking(true);

  const started = speakVoice(answerText, () => {
    setSpeaking(false);
  });

  if (!started) {
    setSpeaking(false);
  }
}

  } catch (error) {
    console.error("Chat history load error:", error);
  } finally {
    setLoadingHistory(false);
  }
};
  const sendQuestion = async (suggested?: string) => {
    const message = (suggested || question).trim();

    if (!message || sending || !token || loadingHistory) return;

    if (message.length > 500) {
      setMessages((previous) => [
        ...previous,
        {
          id: `message-${Date.now()}-${Math.random()}`,
          role: "assistant",
          text: "Please keep your question under 500 characters.",
        },
      ]);
      return;
    }

    setQuestion("");

    setMessages((previous) => [
      ...previous,
      {
        id: `user-${Date.now()}-${Math.random()}`,
role: "user",
text: message,
        
      },
    ]);

    setSending(true);

    try {
      const response = await fetch(
        `${API_URL}/api/copilot/chat`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            familyMemberId: familyMemberId || undefined,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        router.replace("/auth");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to get a response."
        );
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}-${Math.random()}`,
          role: "assistant",
          text: data.answer || "No answer available.",
          sources: Array.isArray(data.sources)
            ? data.sources
            : [],
        },
      ]);
    } catch (error: any) {
      setMessages((previous) => [
        ...previous,
        {
          id: `error-${Date.now()}-${Math.random()}`,
          role: "assistant",
          text:
            error?.message ||
            "Could not connect to the Health Copilot.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = [
    "What was my latest HbA1c?",
    "Which medicines are in my records?",
    "What are my test results?",
    "What is my next follow-up?",
  ];
  
const wellnessSuggestions = [
  "Give me general wellness guidance based on my saved health records. Separate record facts from general advice.",
  "Suggest healthy sleep habits and a simple daily sleep routine.",
  "Give me general nutrition and hydration guidance for everyday wellness.",
  "Suggest safe everyday physical activity and movement habits.",
  "Share practical stress management and relaxation techniques.",
];


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
            <Text style={styles.title}>💙 Spirit Mitra</Text>
          <Text style={styles.subtitle}>
            {familyMemberId
              ? `${familyMemberName || "Family Member"}'s Records`
              : "My Health Records"}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.bubble,
              message.role === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.role === "user" && styles.userText,
              ]}
            >
              {message.text}
            </Text>

            {message.role === "assistant" &&
              !!message.sources?.length && (
                <View style={styles.sources}>
                  <Text style={styles.sourceHeading}>
                    📄 Sources
                  </Text>

                  {message.sources
                    .filter(
                      (source, index, array) =>
                        array.findIndex(
                          (item) =>
                            item.recordId === source.recordId
                        ) === index
                    )
                    .map((source) => (
                      <Text
                        key={source.recordId}
                        style={styles.sourceText}
                      >
                        {source.title} • {source.date}
                      </Text>
                    ))}
                </View>
              )}
          </View>
        ))}

        {!loadingHistory && messages.length === 1 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionHeading}>
              Try asking:
            </Text>

            {suggestions.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.suggestionButton}
                disabled={loadingSession || sending}
                onPress={() => void sendQuestion(item)}
              >
                <Text style={styles.suggestionText}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
{!loadingHistory && (
  <View style={styles.suggestions}>
    <Text style={styles.suggestionHeading}>
      💙 Wellness Guidance
    </Text>

    {wellnessSuggestions.map((item, index) => (
      <TouchableOpacity
        key={`wellness-${index}`}
        style={styles.suggestionButton}
        disabled={loadingSession || sending || !token}
        onPress={() => void sendQuestion(item)}
      >
        <Text style={styles.suggestionText}>
          {[
            "🌙 Sleep Guidance",
            "🥗 Nutrition & Hydration",
            "🚶 Physical Activity",
            "🧘 Stress Management",
            "💙 Personalized Wellness",
          ][index]}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
)}


        {sending && (
          <View style={styles.loading}>
            <ActivityIndicator color="#1769AA" />
            <Text style={styles.loadingText}>
              Checking your medical records...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        
{Platform.OS === "web" && (
  <>
    <TouchableOpacity
      onPress={startListening}
      disabled={loadingSession || sending}
      style={[
        styles.sendButton,
        (loadingSession || sending) &&
          styles.disabledButton,
      ]}
      accessibilityLabel={
        listening ? "Stop microphone" : "Start microphone"
      }
    >
      <Text style={styles.sendText}>
        {listening ? "⏹" : "🎤"}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      
onPress={() => {
  if (speaking) {
    stopVoiceOutput();
    setSpeaking(false);
    return;
  }

  const enabled = !voiceReplyRef.current;

  voiceReplyRef.current = enabled;
  setVoiceReplyEnabled(enabled);

  if (enabled) {
    const latestAnswer = [...messages]
      .reverse()
      .find((item) => item.role === "assistant");

    if (latestAnswer?.text) {
      setSpeaking(true);

      const started = speakVoice(
        latestAnswer.text,
        () => setSpeaking(false)
      );

      if (!started) {
        setSpeaking(false);
        window.alert(
          "Text-to-speech is unavailable in this browser."
        );
      }
    }
  } else {
    stopVoiceOutput();
    setSpeaking(false);
  }
}}

      style={[
        styles.sendButton,
        !voiceReplyEnabled && styles.disabledButton,
      ]}
      accessibilityLabel={
        speaking
          ? "Stop speaking"
          : "Toggle automatic voice replies"
      }
    >
      <Text style={styles.sendText}>
        {speaking
          ? "⏹"
          : voiceReplyEnabled
          ? "🔊"
          : "🔈"}
      </Text>
    </TouchableOpacity>
  </>
)}

        <TextInput
          style={styles.input}
          placeholder="Ask about your health records..."
          placeholderTextColor="#8291A0"
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={500}
          editable={!loadingSession && !sending}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!question.trim() || sending || !token) &&
              styles.disabledButton,
          ]}
          disabled={!question.trim() || sending || !token}
          onPress={() => void sendQuestion()}
        >
          <Text style={styles.sendText}>➤</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        Based on saved records. Not a medical diagnosis.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8FC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 16,
  },
  back: {
    color: "#1769AA",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#17324D",
  },
  subtitle: {
    fontSize: 12,
    color: "#718096",
    marginTop: 3,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 25,
  },
  bubble: {
    padding: 15,
    borderRadius: 16,
    marginBottom: 12,
    maxWidth: "90%",
  },
  assistantBubble: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E3EBF3",
  },
  userBubble: {
    backgroundColor: "#1769AA",
    alignSelf: "flex-end",
  },
  messageText: {
    color: "#263B50",
    fontSize: 14,
    lineHeight: 22,
  },
  userText: {
    color: "#FFFFFF",
  },
  sources: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    marginTop: 12,
    paddingTop: 10,
  },
  sourceHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1769AA",
  },
  sourceText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 5,
  },
  suggestions: {
    marginTop: 12,
    gap: 9,
  },
  suggestionHeading: {
    color: "#17324D",
    fontWeight: "700",
    marginBottom: 4,
  },
  suggestionButton: {
    backgroundColor: "#EAF4FF",
    borderRadius: 12,
    padding: 13,
  },
  suggestionText: {
    color: "#1769AA",
    fontSize: 13,
    fontWeight: "600",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  loadingText: {
    color: "#718096",
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#F5F8FC",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    maxHeight: 110,
    color: "#17324D",
  },
  sendButton: {
    backgroundColor: "#1769AA",
    width: 45,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  sendText: {
    color: "#FFFFFF",
    fontSize: 23,
  },
  disclaimer: {
    textAlign: "center",
    fontSize: 10,
    color: "#718096",
    backgroundColor: "#FFFFFF",
    paddingBottom: 9,
  },
});
