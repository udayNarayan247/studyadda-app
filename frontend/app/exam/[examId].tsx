import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useMemo, useState } from "react";
import { api } from "@/src/api";
import { setGuestTest, getGuestSeen, addGuestSeen } from "@/src/guest-store";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

type Subject = { subject_id: string; name: string; name_hi: string };
type Chapter = { chapter_id: string; subject_id: string; name: string; name_hi: string };

type Mode = "chapter" | "mixed" | "mock" | "custom";

export default function ExamDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const { user, isGuest } = useAuth();
  const { t, pick } = useLang();
  const [mode, setMode] = useState<Mode>("chapter");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => api<Subject[]>("/catalog/subjects"),
  });
  const { data: chapters } = useQuery<Chapter[]>({
    queryKey: ["chapters", subjectId],
    queryFn: () => api<Chapter[]>(`/catalog/chapters${subjectId ? `?subject_id=${subjectId}` : ""}`),
    enabled: !!subjectId,
  });

  const requirement = useMemo(() => {
    if (mode === "chapter") return { min: 1, max: 1 };
    if (mode === "mixed") return { min: 4, max: 4 };
    if (mode === "custom") return { min: 1, max: 10 };
    return { min: 0, max: 0 };
  }, [mode]);

  const canStart =
    mode === "mock" ||
    (selectedChapters.length >= requirement.min && selectedChapters.length <= requirement.max);

  const toggleChapter = (cid: string) => {
    setSelectedChapters((prev) => {
      if (prev.includes(cid)) return prev.filter((c) => c !== cid);
      if (prev.length >= requirement.max) return prev;
      return [...prev, cid];
    });
  };

  const startTest = async () => {
    if (!canStart || starting) return;
    setError(null);
    setStarting(true);
    try {
      const config: any = {
        mode,
        exam_id: mode === "mock" ? examId : undefined,
        chapter_ids: mode === "mock" ? [] : selectedChapters,
        question_count: mode === "mock" ? 25 : mode === "mixed" ? 20 : mode === "custom" ? 15 : 10,
        duration_minutes: mode === "mock" ? 30 : mode === "mixed" ? 20 : mode === "custom" ? 15 : 10,
        marks_per_correct: 1,
        marks_per_wrong: 0.25,
        years: [],
        subject_ids: [],
      };
      if (!user && isGuest) {
        const res = await api<{ questions: any[]; config: any }>("/guest/start", {
          method: "POST",
          body: JSON.stringify({ ...config, exclude_ids: await getGuestSeen() }),
        });
        await addGuestSeen(res.questions.map((q) => q.question_id));
        setGuestTest(res.questions, res.config);
        router.push({ pathname: "/quiz/[sessionId]", params: { sessionId: "guest" } });
      } else {
        const res = await api<{ session_id: string }>("/tests/start", { method: "POST", body: JSON.stringify(config) });
        router.push({ pathname: "/quiz/[sessionId]", params: { sessionId: res.session_id } });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to start");
    } finally {
      setStarting(false);
    }
  };

  const modes: { key: Mode; label: string; labelHi: string; sub: string; subHi: string; icon: string }[] = [
    { key: "chapter", label: "Chapter PYQ", labelHi: "अध्याय PYQ", sub: "Pick 1 chapter", subHi: "1 अध्याय चुनें", icon: "layers" },
    { key: "mixed", label: "Mixed Practice", labelHi: "मिश्रित अभ्यास", sub: "Pick 4 chapters", subHi: "4 अध्याय चुनें", icon: "shuffle" },
    { key: "mock", label: "Full Mock Test", labelHi: "फुल मॉक टेस्ट", sub: "25 Q · 30 min", subHi: "25 प्र · 30 मि", icon: "timer" },
    { key: "custom", label: "Custom Practice", labelHi: "कस्टम अभ्यास", sub: "1-10 chapters", subHi: "1-10 अध्याय", icon: "options" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="exam-back-btn" style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{String(examId).toUpperCase()}</Text>
          <Text style={styles.subtitle}>{t("Choose practice mode", "अभ्यास मोड चुनें")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.modeGrid}>
          {modes.map((m) => (
            <Pressable
              key={m.key}
              testID={`mode-${m.key}`}
              onPress={() => { setMode(m.key); setSelectedChapters([]); }}
              style={[styles.modeCard, mode === m.key && styles.modeCardActive]}
            >
              <Icon name={m.icon as any} size={24} color={mode === m.key ? colors.brandSecondary : colors.brandPrimary} />
              <Text style={[styles.modeTitle, mode === m.key && styles.modeTitleActive]}>{pick(m.label, m.labelHi)}</Text>
              <Text style={[styles.modeSub, mode === m.key && styles.modeSubActive]}>{pick(m.sub, m.subHi)}</Text>
            </Pressable>
          ))}
        </View>

        {mode !== "mock" && (
          <>
            <Text style={styles.section}>{t("Select Subject", "विषय चुनें")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow}>
              {(subjects || []).map((s) => {
                const active = s.subject_id === subjectId;
                return (
                  <Pressable
                    key={s.subject_id}
                    testID={`subject-chip-${s.subject_id}`}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { setSubjectId(s.subject_id); setSelectedChapters([]); }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{pick(s.name, s.name_hi)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {subjectId && (
              <>
                <Text style={styles.section}>
                  {t(`Pick Chapters (${selectedChapters.length}/${requirement.max})`,
                     `अध्याय चुनें (${selectedChapters.length}/${requirement.max})`)}
                </Text>
                <View style={{ gap: spacing.sm }}>
                  {(chapters || []).map((c) => {
                    const sel = selectedChapters.includes(c.chapter_id);
                    return (
                      <Pressable
                        key={c.chapter_id}
                        testID={`chapter-${c.chapter_id}`}
                        onPress={() => toggleChapter(c.chapter_id)}
                        style={[styles.chapRow, sel && styles.chapRowActive]}
                      >
                        <View style={[styles.check, sel && styles.checkActive]}>
                          {sel && <Icon name="checkmark" size={14} color={colors.onBrandSecondary} />}
                        </View>
                        <Text style={[styles.chapText, sel && styles.chapTextActive]}>{pick(c.name, c.name_hi)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        {error && <Text style={styles.err}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="start-practice-btn"
          disabled={!canStart || starting}
          onPress={startTest}
          style={[styles.startBtn, (!canStart || starting) && styles.startBtnDisabled]}
        >
          {starting ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Text style={styles.startText}>{t("Start Practice", "अभ्यास शुरू करें")}</Text>
              <Icon name="arrow-forward" size={18} color={colors.onBrandPrimary} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  modeCard: { flexBasis: "47%", flexGrow: 1, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  modeCardActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandSecondary, borderWidth: 2 },
  modeTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  modeTitleActive: { color: colors.onBrandPrimary },
  modeSub: { fontSize: 11, color: colors.muted },
  modeSubActive: { color: colors.onBrandPrimary, opacity: 0.85 },
  section: { fontSize: 13, color: colors.muted, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  chipRow: { height: 56, flexGrow: 0 },
  chipRowContent: { gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: spacing.md, borderRadius: radii.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: colors.onBrandPrimary },
  chapRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  chapRowActive: { borderColor: colors.brandSecondary, borderWidth: 2 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkActive: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  chapText: { color: colors.onSurface, fontSize: 14, flex: 1 },
  chapTextActive: { fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  startBtn: { backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 16, borderRadius: radii.md },
  startBtnDisabled: { opacity: 0.4 },
  startText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  err: { color: colors.error, marginTop: spacing.md, textAlign: "center" },
});
