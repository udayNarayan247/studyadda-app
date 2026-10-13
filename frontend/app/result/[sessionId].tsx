import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { loadTest } from "@/src/guest-store";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Result() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useLang();

  const { data, isLoading } = useQuery<{ session: any; questions: any[] }>({
    queryKey: ["result", sessionId],
    queryFn: () => loadTest(String(sessionId)),
    gcTime: 0,
  });

  if (isLoading || !data) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;
  }

  const s = data.session;
  const total = (s.question_ids || []).length;
  const correct = s.correct_count ?? 0;
  const wrong = s.wrong_count ?? 0;
  const skipped = s.unattempted ?? total - correct - wrong;
  const accuracy = Math.round(s.accuracy ?? 0);
  const timeTaken = s.time_taken_seconds ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(tabs)")} style={styles.backBtn} testID="result-home-btn">
          <Icon name="home" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("Result", "परिणाम")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>{t("Your Score", "आपका स्कोर")}</Text>
          <Text style={styles.scoreValue} testID="result-score">{s.score ?? 0}</Text>
          <Text style={styles.scoreMax}>/ {total}</Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}><Icon name="speedometer" size={14} color={colors.onBrandSecondary} /><Text style={styles.pillText}>{accuracy}% {t("accuracy", "सटीकता")}</Text></View>
            <View style={styles.pill}><Icon name="time" size={14} color={colors.onBrandSecondary} /><Text style={styles.pillText}>{Math.floor(timeTaken / 60)}m {timeTaken % 60}s</Text></View>
          </View>
        </View>

        <View style={styles.statGrid}>
          <StatBox color={colors.success} value={correct} label={t("Correct", "सही")} />
          <StatBox color={colors.error} value={wrong} label={t("Incorrect", "गलत")} />
          <StatBox color={colors.muted} value={skipped} label={t("Skipped", "छूटे")} />
        </View>

        {s.chapter_stats && (
          <>
            <Text style={styles.section}>{t("Chapter-wise", "अध्यायवार")}</Text>
            {Object.entries(s.chapter_stats).map(([chap, st]: any) => {
              const acc = st.total ? Math.round((st.correct / st.total) * 100) : 0;
              return (
                <View key={chap} style={styles.chapRow}>
                  <Text style={styles.chapName}>{chap}</Text>
                  <View style={styles.chapBar}><View style={[styles.chapFill, { width: `${acc}%` }]} /></View>
                  <Text style={styles.chapPct}>{st.correct}/{st.total}</Text>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="review-btn"
          style={styles.reviewBtn}
          onPress={() => router.push({ pathname: "/review/[sessionId]", params: { sessionId: String(sessionId) } })}
        >
          <Text style={styles.reviewText}>{t("Review Solutions", "समाधान देखें")}</Text>
          <Icon name="arrow-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function StatBox({ color, value, label }: any) {
  return (
    <View style={[styles.statBox, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  scoreCard: { backgroundColor: colors.brandPrimary, padding: spacing.xl, borderRadius: radii.lg, alignItems: "center" },
  scoreLabel: { color: colors.onBrandPrimary, opacity: 0.85 },
  scoreValue: { fontSize: 56, fontWeight: "800", color: colors.brandSecondary, marginTop: spacing.sm },
  scoreMax: { color: colors.onBrandPrimary, opacity: 0.7 },
  pillRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap", justifyContent: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.brandSecondary },
  pillText: { color: colors.onBrandSecondary, fontWeight: "700", fontSize: 12 },
  statGrid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  statBox: { flex: 1, padding: spacing.md, borderRadius: radii.md, borderWidth: 1.5, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  section: { fontSize: 13, color: colors.muted, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  chapRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  chapName: { flex: 1, fontSize: 12, color: colors.onSurface },
  chapBar: { width: 100, height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  chapFill: { height: "100%", backgroundColor: colors.success },
  chapPct: { width: 50, textAlign: "right", color: colors.muted, fontSize: 12, fontWeight: "600" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  reviewBtn: { backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 16, borderRadius: radii.md },
  reviewText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
