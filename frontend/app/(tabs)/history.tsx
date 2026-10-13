import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

type TestRow = {
  session_id: string;
  config: { mode: string; question_count: number };
  status: string;
  score?: number;
  accuracy?: number;
  correct_count?: number;
  wrong_count?: number;
  unattempted?: number;
  started_at: string;
};

export default function History() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { t } = useLang();

  const { data, isLoading } = useQuery<TestRow[]>({
    queryKey: ["my-tests"],
    queryFn: () => api<TestRow[]>("/tests"),
    enabled: !!user,
  });

  if (isGuest) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Icon name="lock-closed" size={48} color={colors.muted} />
        <Text style={styles.emptyText}>{t("Sign in to view test history.", "टेस्ट इतिहास देखने के लिए साइन इन करें।")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Test History", "टेस्ट इतिहास")}</Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(it) => it.session_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="document-text-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>{t("No tests yet. Start your first practice!", "अभी कोई टेस्ट नहीं। अपना पहला अभ्यास शुरू करें!")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`history-row-${item.session_id}`}
              style={styles.row}
              onPress={() => {
                if (item.status === "submitted") router.push({ pathname: "/result/[sessionId]", params: { sessionId: item.session_id } });
                else router.push({ pathname: "/quiz/[sessionId]", params: { sessionId: item.session_id } });
              }}
            >
              <View style={styles.rowIcon}>
                <Icon name={item.status === "submitted" ? "checkmark-done" : "play-circle"} size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t(labelMode(item.config.mode), labelModeHi(item.config.mode))} · {item.config.question_count} Q</Text>
                <Text style={styles.rowSub}>
                  {item.status === "submitted"
                    ? t(`Score ${item.score ?? 0} · ${item.correct_count}/${item.config.question_count} correct · ${(item.accuracy ?? 0).toFixed(0)}%`,
                        `स्कोर ${item.score ?? 0} · ${item.correct_count}/${item.config.question_count} सही · ${(item.accuracy ?? 0).toFixed(0)}%`)
                    : t("Ongoing — resume", "जारी — पुनः आरंभ")}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function labelMode(m: string) {
  if (m === "chapter") return "Chapter PYQ";
  if (m === "mixed") return "Mixed Practice";
  if (m === "mock") return "Full Mock";
  return "Custom";
}
function labelModeHi(m: string) {
  if (m === "chapter") return "अध्याय PYQ";
  if (m === "mixed") return "मिश्रित अभ्यास";
  if (m === "mock") return "फुल मॉक";
  return "कस्टम";
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  emptyText: { color: colors.muted, textAlign: "center" },
});
