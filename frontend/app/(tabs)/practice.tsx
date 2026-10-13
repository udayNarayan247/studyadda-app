import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useState } from "react";
import { api } from "@/src/api";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

type Category = { category_id: string; name: string; name_hi: string };
type Exam = { exam_id: string; category_id: string; name: string; name_hi: string };

export default function Practice() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { t, pick } = useLang();
  const [selectedCat, setSelectedCat] = useState<string | undefined>(params.category);

  const { data: cats } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/catalog/categories"),
  });

  const activeCat = selectedCat || cats?.[0]?.category_id;

  const { data: exams, isLoading } = useQuery<Exam[]>({
    queryKey: ["exams", activeCat],
    queryFn: () => api<Exam[]>(`/catalog/exams?category_id=${activeCat}`),
    enabled: !!activeCat,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("Practice", "अभ्यास")}</Text>
        <Text style={styles.subtitle}>{t("Choose exam category to begin", "शुरू करने के लिए परीक्षा श्रेणी चुनें")}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowContent}
        style={styles.chipRow}
      >
        {(cats || []).map((c) => {
          const active = c.category_id === activeCat;
          return (
            <Pressable
              key={c.category_id}
              testID={`cat-chip-${c.category_id}`}
              onPress={() => setSelectedCat(c.category_id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{pick(c.name, c.name_hi)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : (
          (exams || []).map((ex) => (
            <Pressable
              key={ex.exam_id}
              testID={`exam-row-${ex.exam_id}`}
              style={styles.examRow}
              onPress={() => router.push({ pathname: "/exam/[examId]", params: { examId: ex.exam_id } })}
            >
              <View style={styles.examIconWrap}>
                <Icon name="document-text" size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.examName}>{pick(ex.name, ex.name_hi)}</Text>
                <Text style={styles.examHint}>{t("Tap to open practice modes", "अभ्यास मोड खोलने के लिए टैप करें")}</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chipRow: { height: 56, flexGrow: 0 },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary },
  examRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  examIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  examName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  examHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
