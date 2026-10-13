import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { api, BACKEND_URL, getApiToken } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

type Subject = { subject_id: string; name: string };
type Chapter = { chapter_id: string; subject_id: string; name: string };
type Question = { question_id: string; text: string; subject_id: string; chapter_id: string; verified: boolean };

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLang();
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => api("/admin/stats"), enabled: isAdmin });
  const { data: subjects } = useQuery<Subject[]>({ queryKey: ["subjects"], queryFn: () => api("/catalog/subjects") });
  const { data: chapters } = useQuery<Chapter[]>({ queryKey: ["chapters", subjectId], queryFn: () => api(`/catalog/chapters?subject_id=${subjectId}`), enabled: !!subjectId });
  const { data: questions } = useQuery<Question[]>({
    queryKey: ["admin-questions", subjectId, chapterId],
    queryFn: () => {
      const parts: string[] = ["include_unpublished=true"];
      if (subjectId) parts.push(`subject_id=${subjectId}`);
      if (chapterId) parts.push(`chapter_id=${chapterId}`);
      return api(`/questions?${parts.join("&")}`);
    },
    enabled: isAdmin,
  });

  const del = useMutation({
    mutationFn: (qid: string) => api(`/admin/questions/${qid}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-questions"] }),
  });

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Icon name="lock-closed" size={48} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: spacing.md }}>{t("Admin access only", "केवल व्यवस्थापक पहुँच")}</Text>
      </View>
    );
  }

  const uploadCsv = async () => {
    try {
      const DocumentPicker = await import("expo-document-picker");
      // @ts-ignore
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/vnd.ms-excel", "text/comma-separated-values"], copyToCacheDirectory: true });
      // @ts-ignore
      if (res.canceled) return;
      // @ts-ignore
      const asset = res.assets?.[0] || res;
      const form = new FormData();
      // @ts-ignore
      form.append("file", { uri: asset.uri, name: asset.name || "upload.csv", type: "text/csv" });
      setUploadStatus(t("Uploading…", "अपलोड हो रहा है…"));
      const token = getApiToken();
      const r = await fetch(`${BACKEND_URL}/api/admin/questions/bulk-csv`, {
        method: "POST",
        body: form as any,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await r.json();
      setUploadStatus(t(`Inserted ${json.inserted}, Errors ${json.errors?.length || 0}`, `डाले ${json.inserted}, त्रुटियाँ ${json.errors?.length || 0}`));
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
    } catch (e: any) {
      setUploadStatus(e?.message || "Upload failed");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="admin-back">
          <Icon name="arrow-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("Admin Dashboard", "व्यवस्थापक डैशबोर्ड")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.statGrid}>
          <StatCard label={t("Users", "उपयोगकर्ता")} value={(stats as any)?.users ?? 0} />
          <StatCard label={t("Questions", "प्रश्न")} value={(stats as any)?.questions ?? 0} />
          <StatCard label={t("Verified", "सत्यापित")} value={(stats as any)?.verified_questions ?? 0} />
          <StatCard label={t("Tests Taken", "दिए गए टेस्ट")} value={(stats as any)?.tests_taken ?? 0} />
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <Pressable testID="admin-upload-csv" style={styles.actionBtn} onPress={uploadCsv}>
            <Icon name="cloud-upload" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.actionText}>{t("Upload CSV", "CSV अपलोड")}</Text>
          </Pressable>
          <Pressable testID="admin-add-question" style={[styles.actionBtn, { backgroundColor: colors.brandSecondary }]}
            onPress={() => router.push("/admin/question-form")}
          >
            <Icon name="add" size={18} color={colors.onBrandSecondary} />
            <Text style={[styles.actionText, { color: colors.onBrandSecondary }]}>{t("Add Question", "प्रश्न जोड़ें")}</Text>
          </Pressable>
        </View>
        {uploadStatus && <Text style={{ color: colors.muted, marginTop: spacing.sm }}>{uploadStatus}</Text>}

        <Text style={styles.section}>{t("Filter Questions", "प्रश्न फ़िल्टर")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow}>
          <Pressable style={[styles.chip, !subjectId && styles.chipActive]} onPress={() => { setSubjectId(null); setChapterId(null); }}>
            <Text style={[styles.chipText, !subjectId && styles.chipTextActive]}>{t("All", "सभी")}</Text>
          </Pressable>
          {(subjects || []).map((s) => (
            <Pressable key={s.subject_id} style={[styles.chip, subjectId === s.subject_id && styles.chipActive]} onPress={() => { setSubjectId(s.subject_id); setChapterId(null); }}>
              <Text style={[styles.chipText, subjectId === s.subject_id && styles.chipTextActive]}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.section}>{t(`Questions (${(questions || []).length})`, `प्रश्न (${(questions || []).length})`)}</Text>
        <View style={{ gap: spacing.sm }}>
          {(questions || []).slice(0, 50).map((q) => (
            <View key={q.question_id} style={styles.qCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.qText} numberOfLines={2}>{q.text}</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
                  <Text style={styles.qTag}>{q.subject_id}</Text>
                  <Text style={styles.qTag}>{q.chapter_id}</Text>
                  <Text style={[styles.qTag, { color: q.verified ? colors.success : colors.warning }]}>{q.verified ? "✓" : "unverified"}</Text>
                </View>
              </View>
              <Pressable testID={`admin-del-${q.question_id}`} onPress={() => del.mutate(q.question_id)} style={styles.delBtn}>
                <Icon name="trash" size={16} color={colors.error} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { flexBasis: "47%", flexGrow: 1, padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radii.md },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.brandSecondary },
  statLabel: { fontSize: 11, color: colors.onBrandPrimary, opacity: 0.85, marginTop: 2 },
  actionBtn: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radii.md },
  actionText: { color: colors.onBrandPrimary, fontWeight: "700" },
  section: { fontSize: 13, color: colors.muted, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  chipRow: { height: 56, flexGrow: 0 },
  chipRowContent: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  qCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  qText: { color: colors.onSurface, fontSize: 13, lineHeight: 20 },
  qTag: { fontSize: 10, color: colors.muted, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  delBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
});
