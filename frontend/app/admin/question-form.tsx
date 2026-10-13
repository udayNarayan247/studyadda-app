import { View, Text, Pressable, ScrollView, StyleSheet, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { api } from "@/src/api";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function QuestionForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLang();

  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [text, setText] = useState("");
  const [textHi, setTextHi] = useState("");
  const [opts, setOpts] = useState({ A: "", B: "", C: "", D: "" });
  const [optsHi, setOptsHi] = useState({ A: "", B: "", C: "", D: "" });
  const [correct, setCorrect] = useState("A");
  const [solution, setSolution] = useState("");
  const [solutionHi, setSolutionHi] = useState("");
  const [verified, setVerified] = useState(false);
  const [year, setYear] = useState("");
  const [source, setSource] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: subjects } = useQuery<any[]>({ queryKey: ["subjects"], queryFn: () => api("/catalog/subjects") });
  const { data: chapters } = useQuery<any[]>({ queryKey: ["chapters", subjectId], queryFn: () => api(`/catalog/chapters?subject_id=${subjectId}`), enabled: !!subjectId });

  const create = useMutation({
    mutationFn: () => api("/admin/questions", {
      method: "POST",
      body: JSON.stringify({
        subject_id: subjectId,
        chapter_id: chapterId,
        text, text_hi: textHi || text,
        options: ["A","B","C","D"].map((k) => ({ key: k, text: (opts as any)[k], text_hi: (optsHi as any)[k] || (opts as any)[k] })),
        correct,
        solution, solution_hi: solutionHi || solution,
        difficulty: "medium",
        verified,
        year: year ? Number(year) : null,
        source,
        published: true,
      }),
    }),
    onSuccess: () => { setMsg(t("Saved!", "सहेज लिया!")); setText(""); setTextHi(""); setOpts({A:"",B:"",C:"",D:""}); setOptsHi({A:"",B:"",C:"",D:""}); setSolution(""); setSolutionHi(""); },
    onError: (e: any) => setMsg(e?.message || "Error"),
  });

  const canSave = !!(subjectId && chapterId && text && opts.A && opts.B && opts.C && opts.D);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="qform-back">
          <Icon name="arrow-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("Add Question", "प्रश्न जोड़ें")}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        <Label>{t("Subject", "विषय")}</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow}>
          {(subjects || []).map((s) => (
            <Pressable key={s.subject_id} testID={`qf-subject-${s.subject_id}`} onPress={() => { setSubjectId(s.subject_id); setChapterId(""); }}
              style={[styles.chip, subjectId === s.subject_id && styles.chipActive]}>
              <Text style={[styles.chipText, subjectId === s.subject_id && styles.chipTextActive]}>{s.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!!subjectId && (
          <>
            <Label>{t("Chapter", "अध्याय")}</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow}>
              {(chapters || []).map((c) => (
                <Pressable key={c.chapter_id} onPress={() => setChapterId(c.chapter_id)} style={[styles.chip, chapterId === c.chapter_id && styles.chipActive]}>
                  <Text style={[styles.chipText, chapterId === c.chapter_id && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        <Label>{t("Question (English)", "प्रश्न (अंग्रेज़ी)")}</Label>
        <TextInput testID="qf-text-en" style={styles.input} value={text} onChangeText={setText} multiline />
        <Label>{t("Question (Hindi)", "प्रश्न (हिंदी)")}</Label>
        <TextInput testID="qf-text-hi" style={styles.input} value={textHi} onChangeText={setTextHi} multiline />
        {["A","B","C","D"].map((k) => (
          <View key={k}>
            <Label>{t(`Option ${k}`, `विकल्प ${k}`)}</Label>
            <TextInput testID={`qf-opt-${k}`} style={styles.input} value={(opts as any)[k]} onChangeText={(v) => setOpts({ ...opts, [k]: v })} />
            <TextInput testID={`qf-opt-${k}-hi`} style={styles.input} value={(optsHi as any)[k]} onChangeText={(v) => setOptsHi({ ...optsHi, [k]: v })} placeholder={t("Hindi", "हिंदी")} placeholderTextColor={colors.muted} />
          </View>
        ))}
        <Label>{t("Correct Option", "सही विकल्प")}</Label>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {["A","B","C","D"].map((k) => (
            <Pressable key={k} testID={`qf-correct-${k}`} onPress={() => setCorrect(k)} style={[styles.correctChip, correct === k && styles.correctChipActive]}>
              <Text style={[styles.chipText, correct === k && styles.chipTextActive]}>{k}</Text>
            </Pressable>
          ))}
        </View>
        <Label>{t("Solution (English)", "समाधान (अंग्रेज़ी)")}</Label>
        <TextInput testID="qf-sol-en" style={styles.input} value={solution} onChangeText={setSolution} multiline />
        <Label>{t("Solution (Hindi)", "समाधान (हिंदी)")}</Label>
        <TextInput style={styles.input} value={solutionHi} onChangeText={setSolutionHi} multiline />
        <Label>{t("Year", "वर्ष")}</Label>
        <TextInput style={styles.input} value={year} onChangeText={setYear} keyboardType="numeric" />
        <Label>{t("Source", "स्रोत")}</Label>
        <TextInput style={styles.input} value={source} onChangeText={setSource} placeholder="e.g. IBPS PO 2023 Shift 1" placeholderTextColor={colors.muted} />
        <Pressable testID="qf-verified" onPress={() => setVerified(!verified)} style={styles.verifyRow}>
          <View style={[styles.check, verified && styles.checkActive]}>{verified && <Icon name="checkmark" size={14} color="#fff" />}</View>
          <Text style={{ color: colors.onSurface }}>{t("Mark as Verified PYQ", "सत्यापित PYQ के रूप में चिह्नित करें")}</Text>
        </Pressable>

        {msg && <Text style={{ color: colors.success, marginTop: spacing.md }}>{msg}</Text>}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="qf-save" disabled={!canSave} onPress={() => create.mutate()} style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}>
          <Text style={styles.saveText}>{t("Save Question", "प्रश्न सहेजें")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Label({ children }: any) { return <Text style={styles.label}>{children}</Text>; }

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  label: { fontSize: 12, color: colors.muted, fontWeight: "700", marginTop: spacing.md, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, color: colors.onSurface, minHeight: 44 },
  chipRow: { height: 56, flexGrow: 0 },
  chipRowContent: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: colors.onBrandPrimary },
  correctChip: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  correctChipActive: { backgroundColor: colors.success },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkActive: { backgroundColor: colors.success, borderColor: colors.success },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radii.md, alignItems: "center" },
  saveText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
