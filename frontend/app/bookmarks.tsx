import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Bookmarks() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, pick } = useLang();

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["bookmarks"],
    queryFn: () => api("/bookmarks"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="bookmarks-back">
          <Icon name="arrow-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("Bookmarks", "बुकमार्क")}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(it) => it.question_id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: spacing.xxl, gap: spacing.md }}>
              <Icon name="bookmark-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted }}>{t("No bookmarks yet.", "अभी कोई बुकमार्क नहीं।")}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.qText}>{pick(item.text, item.text_hi)}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaItem}>{t("Correct", "सही")}: {item.correct}</Text>
                {item.source && <Text style={styles.metaItem}>{item.source}</Text>}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  card: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  qText: { color: colors.onSurface, fontSize: 14, lineHeight: 22 },
  meta: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  metaItem: { fontSize: 11, color: colors.muted },
});
