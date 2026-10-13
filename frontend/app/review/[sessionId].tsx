import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { api } from "@/src/api";
import { loadTest } from "@/src/guest-store";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Review() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t, pick } = useLang();
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ session: any; questions: any[] }>({
    queryKey: ["review", sessionId],
    queryFn: () => loadTest(String(sessionId)),
    gcTime: 0,
  });

  const toggleBookmark = useMutation({
    mutationFn: async (qid: string) => {
      if (bookmarked.has(qid)) await api(`/bookmarks/${qid}`, { method: "DELETE" });
      else await api(`/bookmarks/${qid}`, { method: "POST" });
    },
    onSuccess: (_, qid) => {
      setBookmarked((s) => { const n = new Set(s); if (n.has(qid)) n.delete(qid); else n.add(qid); return n; });
    },
  });

  if (isLoading || !data) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;

  const total = data.questions.length;
  const q = data.questions[idx];
  const userAns = data.session.answers?.[q.question_id];
  const correct = q.correct;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="review-back">
          <Icon name="arrow-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t(`Review ${idx + 1}/${total}`, `समीक्षा ${idx + 1}/${total}`)}</Text>
        {user ? (
          <Pressable testID="review-bookmark-btn" onPress={() => toggleBookmark.mutate(q.question_id)} style={styles.backBtn}>
            <Icon name={bookmarked.has(q.question_id) ? "bookmark" : "bookmark-outline"} size={20} color={colors.brandSecondary} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.qText}>{pick(q.text, q.text_hi)}</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {q.options.map((o: any) => {
            const isCorrect = o.key === correct;
            const isUser = o.key === userAns;
            const bg = isCorrect ? "#DCFCE7" : isUser && !isCorrect ? "#FEE2E2" : colors.surfaceSecondary;
            const border = isCorrect ? colors.success : isUser && !isCorrect ? colors.error : colors.border;
            return (
              <View key={o.key} style={[styles.option, { backgroundColor: bg, borderColor: border }]}>
                <View style={[styles.optKey, { backgroundColor: isCorrect ? colors.success : isUser ? colors.error : colors.surface }]}>
                  <Text style={{ color: isCorrect || isUser ? "#fff" : colors.onSurface, fontWeight: "800" }}>{o.key}</Text>
                </View>
                <Text style={styles.optText}>{pick(o.text, o.text_hi)}</Text>
                {isCorrect && <Icon name="checkmark-circle" size={20} color={colors.success} />}
                {isUser && !isCorrect && <Icon name="close-circle" size={20} color={colors.error} />}
              </View>
            );
          })}
        </View>

        <View style={styles.solCard}>
          <Text style={styles.solLabel}>{t("Solution", "समाधान")}</Text>
          <Text style={styles.solText}>{pick(q.solution, q.solution_hi) || t("No detailed solution available.", "विस्तृत समाधान उपलब्ध नहीं है।")}</Text>
          {q.source && <Text style={styles.source}>{t("Source", "स्रोत")}: {q.source}</Text>}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="review-prev" disabled={idx === 0} onPress={() => setIdx(idx - 1)} style={[styles.navBtn, idx === 0 && { opacity: 0.4 }]}>
          <Icon name="chevron-back" size={18} color={colors.onSurface} />
          <Text style={styles.navText}>{t("Prev", "पिछला")}</Text>
        </Pressable>
        <Pressable testID="review-next" disabled={idx === total - 1} onPress={() => setIdx(idx + 1)} style={[styles.navBtn, styles.navBtnPrimary, idx === total - 1 && { opacity: 0.4 }]}>
          <Text style={[styles.navText, { color: colors.onBrandPrimary }]}>{t("Next", "अगला")}</Text>
          <Icon name="chevron-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  qText: { fontSize: 17, lineHeight: 28, color: colors.onSurface, fontWeight: "500" },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 2 },
  optKey: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  optText: { flex: 1, color: colors.onSurface, fontSize: 14, lineHeight: 22 },
  solCard: { backgroundColor: colors.brandTertiary, padding: spacing.lg, borderRadius: radii.md, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.brandSecondary },
  solLabel: { fontSize: 12, fontWeight: "800", color: colors.onBrandTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  solText: { marginTop: spacing.sm, color: colors.onSurface, lineHeight: 22 },
  source: { marginTop: spacing.md, fontSize: 11, color: colors.muted, fontStyle: "italic" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  navBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  navBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  navText: { fontWeight: "700", color: colors.onSurface },
});
