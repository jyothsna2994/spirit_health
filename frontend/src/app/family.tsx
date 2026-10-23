
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";

import { getSession } from "../lib/session";
import { API_URL } from "../constants/api";

type FamilyMember = {
  _id: string;
  fullName: string;
  relationship: string;
  age: number | null;
  gender: string;
};

const notify = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function FamilyScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingMemberId, setUploadingMemberId] = useState<string | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [memberRecords, setMemberRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const loadMembers = async (authToken: string) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/family`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not load family members."
        );
      }

      setMembers(data.members || []);
    } catch (err: any) {
      console.error("Family loading error:", err);
      setError(err.message || "Unable to load family members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const session = await getSession();

        if (!session?.token) {
          router.replace("/auth");
          return;
        }

        setToken(session.token);
        await loadMembers(session.token);
      } catch (err) {
        console.error("Family session error:", err);
        setError("Unable to load your account.");
        setLoading(false);
      }
    };

    initialize();
  }, []);

  const resetForm = () => {
    setFullName("");
    setRelationship("");
    setAge("");
    setGender("");
    setEditingId(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (member: FamilyMember) => {
    setEditingId(member._id);
    setFullName(member.fullName);
    setRelationship(member.relationship);
    setAge(
      member.age === null || member.age === undefined
        ? ""
        : String(member.age)
    );
    setGender(member.gender || "");
    setShowForm(true);
  };

  const saveMember = async () => {
    if (saving) return;

    if (!fullName.trim() || !relationship.trim()) {
      notify(
        "Required Fields",
        "Please enter a name and relationship."
      );
      return;
    }

    if (fullName.trim().length > 100 ||
        relationship.trim().length > 50) {
      notify("Invalid Details", "Name or relationship is too long.");
      return;
    }

    const ageText = age.trim();
    const parsedAge = ageText === "" ? null : Number(ageText);

    if (
      parsedAge !== null &&
      (!Number.isInteger(parsedAge) ||
        parsedAge < 0 ||
        parsedAge > 120)
    ) {
      notify(
        "Invalid Age",
        "Please enter a whole number between 0 and 120."
      );
      return;
    }

    if (!token) {
      notify("Session Expired", "Please log in again.");
      router.replace("/auth");
      return;
    }

    try {
      setSaving(true);

      const isEditing = Boolean(editingId);

      const url = isEditing
        ? `${API_URL}/api/family/${editingId}`
        : `${API_URL}/api/family`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          relationship: relationship.trim(),
          age: parsedAge,
          gender: gender.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not save family member."
        );
      }

      resetForm();
      await loadMembers(token);

      notify(
        "Success",
        isEditing
          ? "Family member updated successfully."
          : "Family member added successfully."
      );
    } catch (err: any) {
      console.error("Family save error:", err);

      notify(
        "Save Failed",
        err.message || "Could not save family member."
      );
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (member: FamilyMember) => {
    if (!token) {
      notify("Session Expired", "Please log in again.");
      router.replace("/auth");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/family/${member._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Could not delete family member."
        );
      }

      await loadMembers(token);
      notify("Deleted", "Family member removed successfully.");
    } catch (err: any) {
      console.error("Family delete error:", err);

      notify(
        "Delete Failed",
        err.message || "Could not delete family member."
      );
    }
  };

  const deleteMember = (member: FamilyMember) => {
    const message = `Remove ${member.fullName} from your family?`;

    if (Platform.OS === "web") {
      if (window.confirm(message)) {
        void performDelete(member);
      }
      return;
    }

    Alert.alert("Delete Family Member", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void performDelete(member),
      },
    ]);
  };
 const uploadMemberReports = async (member: FamilyMember) => {
  if (!token || uploadingMemberId) return;

  try {
    const selection = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (selection.canceled || !selection.assets?.length) return;

    const files = selection.assets;

    if (files.length > 5) {
      notify("Too Many Files", "Select a maximum of 5 files.");
      return;
    }

    if (
      files.length > 1 &&
      files.some((file) => file.mimeType === "application/pdf")
    ) {
      notify(
        "Invalid Selection",
        "Upload PDFs individually. Multiple files must be JPG or PNG images."
      );
      return;
    }

    const totalSize = files.reduce(
      (sum, file) => sum + (file.size || 0),
      0
    );

    if (totalSize > 25 * 1024 * 1024) {
      notify("Files Too Large", "Combined files must be 25 MB or less.");
      return;
    }

    setUploadingMemberId(member._id);

    const formData = new FormData();
    formData.append("familyMemberId", member._id);

    for (const file of files) {
      const mimeType = file.mimeType || "image/jpeg";

      if (Platform.OS === "web") {
        const response = await fetch(file.uri);
        const blob = await response.blob();

        formData.append(
          "document",
          new File([blob], file.name, { type: mimeType })
        );
      } else {
        formData.append("document", {
          uri: file.uri,
          name: file.name,
          type: mimeType,
        } as any);
      }
    }

    const response = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Report upload failed.");
    }

    notify(
      "Success",
      data.duplicate
        ? "This report is already saved for this family member."
        : `Medical report saved for ${member.fullName}.`
    );
  } catch (error: any) {
    console.error("Family report upload error:", error);
    notify("Upload Failed", error.message || "Could not upload report.");
  } finally {
    setUploadingMemberId(null);
  }
};

const viewMemberReports = async (member: FamilyMember) => {
  if (!token) return;

  if (viewingMemberId === member._id) {
    setViewingMemberId(null);
    return;
  }

  try {
    setRecordsLoading(true);
    setViewingMemberId(member._id);
    setMemberRecords([]);

    const response = await fetch(
      `${API_URL}/api/records?familyMemberId=${encodeURIComponent(member._id)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Could not load reports.");
    }

    setMemberRecords(data.records || []);
  } catch (error: any) {
    notify("Error", error.message || "Could not load reports.");
  } finally {
    setRecordsLoading(false);
  }
};
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.backText}>← Back to Dashboard</Text>
        </TouchableOpacity>

        <View style={styles.headerCard}>
          <Text style={styles.title}>👨‍👩‍👧 Family Members</Text>
          <Text style={styles.subtitle}>
            Manage your family's profiles in one place.
          </Text>
        </View>

        {!showForm && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openAddForm}
          >
            <Text style={styles.primaryButtonText}>
              + Add Family Member
            </Text>
          </TouchableOpacity>
        )}

        {showForm && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {editingId ? "Edit Family Member" : "Add Family Member"}
            </Text>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter full name"
              placeholderTextColor="#8291A0"
              value={fullName}
              onChangeText={setFullName}
              maxLength={100}
            />

            <Text style={styles.label}>Relationship *</Text>
            <TextInput
              style={styles.input}
              placeholder="Mother, Father, Spouse, Child..."
              placeholderTextColor="#8291A0"
              value={relationship}
              onChangeText={setRelationship}
              maxLength={50}
            />

            <Text style={styles.label}>Age (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter age"
              placeholderTextColor="#8291A0"
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
            />

            <Text style={styles.label}>Gender (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter gender"
              placeholderTextColor="#8291A0"
              value={gender}
              onChangeText={setGender}
              maxLength={50}
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                saving && styles.disabledButton,
              ]}
              onPress={saveMember}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {editingId ? "Save Changes" : "Save Family Member"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={resetForm}
              disabled={saving}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Your Family ({members.length})
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1769AA" />
          ) : error ? (
            <View>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={() => token && loadMembers(token)}
              >
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : members.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>👨‍👩‍👧</Text>
              <Text style={styles.emptyTitle}>
                No family members added
              </Text>
              <Text style={styles.emptyText}>
                Add your first family member to get started.
              </Text>
            </View>
          ) : (
            members.map((member) => (
              <View key={member._id} style={styles.memberCard}>
                <View style={styles.memberHeader}>
                  <Text style={styles.memberIcon}>👤</Text>

                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.fullName}
                    </Text>

                    <Text style={styles.memberDetail}>
                      {member.relationship}
                    </Text>

                    {member.age !== null &&
                      member.age !== undefined && (
                        <Text style={styles.memberDetail}>
                          Age: {member.age}
                        </Text>
                      )}

                    {Boolean(member.gender) && (
                      <Text style={styles.memberDetail}>
                        Gender: {member.gender}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                  style={styles.editButton}
                  onPress={() =>
  router.push({
    pathname: "/",
    params: {
      familyMemberId: member._id,
      familyMemberName: member.fullName,
    },
  })
}
                  disabled={uploadingMemberId !== null}
                  >
                    <Text style={styles.editText}>
                      {uploadingMemberId === member._id ? "Uploading...": "📄 Upload Reports"}
                      </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                      style={styles.editButton}
                      onPress={() =>
  router.push({
    pathname: "/",
    params: {
      familyMemberId: member._id,
      familyMemberName: member.fullName,
    },
  })
}
 >
                        <Text style={styles.editText}>
                          📁 View Reports
                          </Text>
                          </TouchableOpacity>                     
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openEditForm(member)}
                  >
                    <Text style={styles.editText}>✏️ Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteMember(member)}
                  >
                    <Text style={styles.deleteText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
                {viewingMemberId === member._id && (
  <View style={{ marginTop: 15 }}>
    <Text style={styles.sectionTitle}>
      {member.fullName}'s Medical Reports
    </Text>

    {recordsLoading ? (
      <ActivityIndicator color="#1769AA" />
    ) : memberRecords.length === 0 ? (
      <Text style={styles.memberDetail}>
        No medical reports uploaded yet.
      </Text>
    ) : (
      memberRecords.map((record) => (
        <View
          key={record.id || record._id}
          style={{
            padding: 12,
            marginBottom: 8,
            backgroundColor: "#FFFFFF",
            borderRadius: 10,
          }}
        >
          <Text style={styles.memberName}>
            {record.documentType || "Medical Report"}
          </Text>

          <Text style={styles.memberDetail}>
            {record.createdAt
              ? new Date(record.createdAt).toLocaleDateString()
              : "Date unavailable"}
          </Text>

          <Text style={styles.memberDetail}>
            {record.summaries?.en ||
              record.healthSummary ||
              "Summary not available"}
          </Text>
        </View>
      ))
    )}
  </View>
)}
              </View>

            ))
          )}
        </View>

        <Text style={styles.footerText}>
          Family profiles are accessible only through your
          authenticated account.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F8FC",
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 70,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  backButton: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  backText: {
    color: "#1769AA",
    fontSize: 14,
    fontWeight: "700",
  },
  headerCard: {
    backgroundColor: "#EAF4FF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
  },
  title: {
    color: "#17324D",
    fontSize: 23,
    fontWeight: "800",
  },
  subtitle: {
    color: "#657789",
    fontSize: 13,
    marginTop: 7,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    color: "#17324D",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
  },
  label: {
    color: "#17324D",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7E0EA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 14,
    color: "#17324D",
    backgroundColor: "#FAFCFE",
  },
  primaryButton: {
    backgroundColor: "#1769AA",
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    alignItems: "center",
    padding: 10,
  },
  cancelText: {
    color: "#657789",
    fontWeight: "700",
  },
  memberCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
  },
  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberIcon: {
    fontSize: 30,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: "#17324D",
    fontSize: 16,
    fontWeight: "800",
  },
  memberDetail: {
    color: "#657789",
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 15,
  },
  editButton: {
    backgroundColor: "#EAF4FF",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  editText: {
    color: "#1769AA",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: "#FFF1F0",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteText: {
    color: "#B42318",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyBox: {
    alignItems: "center",
    backgroundColor: "#F7F9FC",
    borderRadius: 14,
    padding: 25,
  },
  emptyIcon: {
    fontSize: 35,
    marginBottom: 10,
  },
  emptyTitle: {
    color: "#17324D",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyText: {
    color: "#718096",
    fontSize: 12,
    textAlign: "center",
    marginTop: 7,
  },
  errorText: {
    color: "#B42318",
    marginBottom: 10,
  },
  retryText: {
    color: "#1769AA",
    fontWeight: "700",
  },
  footerText: {
    color: "#718096",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
