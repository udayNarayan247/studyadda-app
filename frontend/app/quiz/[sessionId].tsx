import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useEffect, useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api";
import { loadTest, submitGuestTest } from "@/src/guest-store";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

type QuestionT = {
  question_id: string;
  text: string; text_hi: string;
  options: { key: string; text: string; text_hi: string }[];
  correct: string;
  solution: string; solution_hi: string;
  source?: string;
};

type SessionData = { session: any; questions: QuestionT[] };

export default function Quiz() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t, pick, lang, toggle } = useLang();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { data, isLoading } = useQuery<SessionData>({
    queryKey: ["test", sessionId],
    queryFn: () => loadTest(String(sessionId)),
    gcTime: 0,
  });

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [startedAt] = useState(() => Date.now());
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (data?.session) {
      setAnswers(data.session.answers || {});
      setMarked(new Set(data.session.marked_for_review || []));
      const dur = (data.session.config?.duration_minutes || 0) * 60;
      setTimeLeft(dur);
    }
  }, [data]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { submit.mutate(); return; }
    const id = setTimeout(() => setTimeLeft((t) => (t == null ? t : t - 1)), 1000);
    return () => clearTimeout(id);
  }, [timeLeft]);

  const submit = useMutation({
    mutationFn: async () => {
      const timeTaken = Math.floor((Date.now() - startedAt) / 1000);
      if (sessionId === "guest") {
        submitGuestTest(answers, Array.from(marked), timeTaken);
        return;
      }
      return api(`/tests/${sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers, marked_for_review: Array.from(marked), time_taken_seconds: timeTaken }),
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace({ pathname: "/result/[sessionId]", params: { sessionId: String(sessionId) } });
    },
  });

  const questions = data?.questions || [];
  const current = questions[idx];
  const total = questions.length;

  const choose = (key: string) => {
    if (!current) return;
    Haptics.selectionAsync().catch(() => {});
    setAnswers((prev) => ({ ...prev, [current.question_id]: key }));
  };

  const toggleMark = () => {
    if (!current) return;
    setMarked((prev) => {
      const n = new Set(prev);
      if (n.has(current.question_id)) n.delete(current.question_id);
      else n.add(current.question_id);
      return n;
    });
  };

  const palette = useMemo(() => questions.map((q, i) => {
    const answered = !!answers[q.question_id];
    const review = marked.has(q.question_id);
    const state = review ? "review" : answered ? "answered" : "unanswered";
    return { i, state };
  }), [questions, answers, marked]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (isLoading || !data) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Slim context bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => setConfirmSubmit(true)} testID="quiz-close-btn" style={styles.iconBtn}>
          <Icon name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.timerWrap}>
          <Icon name="time" size={14} color={timeLeft != null && timeLeft < 60 ? colors.error : colors.brandPrimary} />
          <Text style={[styles.timerText, timeLeft != null && timeLeft < 60 && { color: colors.error }]}>{timeLeft != null ? fmt(timeLeft) : "--:--"}</Text>
        </View>
        <Text style={styles.progress} testID="quiz-progress">{idx + 1}/{total}</Text>
        <Pressable onPress={toggle} style={styles.iconBtn} testID="quiz-lang-toggle">
          <Text style={styles.langBtnText}>{lang === "en" ? "हिं" : "EN"}</Text>
        </Pressable>
        <Pressable onPress={() => setPaletteOpen(true)} style={styles.iconBtn} testID="quiz-palette-btn">
          <Icon name="grid" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.qLabel}>{t(`Question ${idx + 1}`, `प्रश्न ${idx + 1}`)}</Text>
        <Text style={styles.qText} testID="quiz-question-text">{pick(current.text, current.text_hi)}</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {current.options.map((o) => {
            const sel = answers[current.question_id] === o.key;
            return (
              <Pressable
                key={o.key}
                testID={`quiz-option-${o.key}`}
                onPress={() => choose(o.key)}
                style={[styles.option, sel && styles.optionSelected]}
              >
                <View style={[styles.optKey, sel && styles.optKeySelected]}>
                  <Text style={[styles.optKeyText, sel && styles.optKeyTextSelected]}>{o.key}</Text>
                </View>
                <Text style={[styles.optText, sel && styles.optTextSelected]}>{pick(o.text, o.text_hi)}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Pressable testID="quiz-prev-btn" disabled={idx === 0} onPress={() => setIdx((i) => Math.max(0, i - 1))} style={[styles.navBtn, idx === 0 && { opacity: 0.4 }]}>
          <Icon name="chevron-back" size={18} color={colors.onSurface} />
          <Text style={styles.navText}>{t("Prev", "पिछला")}</Text>
        </Pressable>
        <Pressable testID="quiz-mark-btn" onPress={toggleMark} style={[styles.markBtn, marked.has(current.question_id) && styles.markBtnActive]}>
          <Icon name="flag" size={16} color={marked.has(current.question_id) ? colors.onBrandSecondary : colors.onSurface} />
          <Text style={[styles.markText, marked.has(current.question_id) && { color: colors.onBrandSecondary }]}>{t("Mark", "चिह्न")}</Text>
        </Pressable>
        {idx < total - 1 ? (
          <Pressable testID="quiz-next-btn" onPress={() => setIdx((i) => Math.min(total - 1, i + 1))} style={[styles.navBtn, styles.navBtnPrimary]}>
            <Text style={[styles.navText, { color: colors.onBrandPrimary }]}>{t("Next", "अगला")}</Text>
            <Icon name="chevron-forward" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        ) : (
          <Pressable testID="quiz-submit-btn" onPress={() => setConfirmSubmit(true)} style={[styles.navBtn, styles.submitBtn]}>
            <Text style={[styles.navText, { color: colors.onBrandSecondary }]}>{t("Submit", "सबमिट")}</Text>
          </Pressable>
        )}
      </View>

      <Modal visible={paletteOpen} transparent animationType="slide" onRequestClose={() => setPaletteOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPaletteOpen(false)} testID="palette-backdrop" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="palette-sheet">
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t("Question Palette", "प्रश्न पैलेट")}</Text>
          <View style={styles.legend}>
            <LegendDot color={colors.success} label={t("Answered", "उत्तरित")} />
            <LegendDot color={colors.brandSecondary} label={t("Review", "समीक्षा")} />
            <LegendDot color={colors.surfaceTertiary} label={t("Unanswered", "अनुत्तरित")} border />
          </View>
          <ScrollView contentContainerStyle={styles.paletteGrid}>
            {palette.map((p) => {
              const bg = p.state === "answered" ? colors.success : p.state === "review" ? colors.brandSecondary : colors.surfaceTertiary;
              const fg = p.state === "unanswered" ? colors.onSurface : colors.onBrandPrimary;
              return (
                <Pressable
                  key={p.i}
                  testID={`palette-${p.i}`}
                  onPress={() => { setIdx(p.i); setPaletteOpen(false); }}
                  style={[styles.paletteCell, { backgroundColor: bg, borderWidth: p.state === "unanswered" ? 1 : 0, borderColor: colors.borderStrong }]}
                >
                  <Text style={[styles.paletteText, { color: fg }]}>{p.i + 1}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {confirmSubmit && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("Submit Test?", "टेस्ट सबमिट करें?")}</Text>
            <Text style={styles.modalBody}>
              {t(`Answered ${Object.keys(answers).length} of ${total}. You can't edit after submission.`,
                 `${total} में से ${Object.keys(answers).length} उत्तरित। सबमिट के बाद संपादन नहीं कर सकते।`)}
            </Text>
            <View style={styles.modalRow}>
              <Pressable testID="confirm-cancel" style={styles.modalBtn} onPress={() => setConfirmSubmit(false)}>
                <Text style={styles.modalBtnText}>{t("Continue", "जारी रखें")}</Text>
              </Pressable>
              <Pressable testID="confirm-submit" style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => { setConfirmSubmit(false); submit.mutate(); }}>
                <Text style={[styles.modalBtnText, { color: colors.onBrandPrimary }]}>{t("Submit", "सबमिट")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label, border }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: border ? 1 : 0, borderColor: colors.borderStrong }} />
      <Text style={{ color: colors.onSurface, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  langBtnText: { color: colors.onSurface, fontWeight: "700", fontSize: 12 },
  timerWrap: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.brandTertiary, borderRadius: radii.pill },
  timerText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 13 },
  progress: { flex: 1, textAlign: "center", color: colors.onSurface, fontWeight: "700" },
  qLabel: { fontSize: 12, color: colors.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  qText: { fontSize: 17, lineHeight: 28, color: colors.onSurface, marginTop: spacing.xs },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 2, borderColor: colors.border },
  optionSelected: { borderColor: colors.brandSecondary, backgroundColor: colors.brandTertiary },
  optKey: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  optKeySelected: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  optKeyText: { fontWeight: "800", color: colors.onSurface },
  optKeyTextSelected: { color: colors.onBrandSecondary },
  optText: { flex: 1, color: colors.onSurface, fontSize: 15, lineHeight: 22 },
  optTextSelected: { fontWeight: "600" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  navBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  navBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  navText: { fontWeight: "700", color: colors.onSurface },
  markBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  markBtnActive: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  markText: { fontWeight: "700", color: colors.onSurface, fontSize: 13 },
  submitBtn: { backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(11,21,42,0.5)" },
  sheet: { maxHeight: "65%", backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  legend: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.lg, flexWrap: "wrap" },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.xl },
  paletteCell: { width: 46, height: 46, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  paletteText: { fontWeight: "700" },
  modalBackdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  modalBody: { fontSize: 14, color: colors.muted, marginTop: spacing.sm, lineHeight: 22 },
  modalRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  modalBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  modalBtnText: { fontWeight: "700", color: colors.onSurface },
});
