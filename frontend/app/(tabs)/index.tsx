import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

type Category = { category_id: string; name: string; name_hi: string; description: string; description_hi: string; icon: string };

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isGuest } = useAuth();
  const { t, pick, lang, toggle } = useLang();

  const { data: cats, isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/catalog/categories"),
  });

  const greeting = user?.name ? t(`Hi, ${user.name.split(" ")[0]}`, `नमस्ते, ${user.name.split(" ")[0]}`)
    : t("Welcome, Learner", "स्वागत है, छात्र");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} testID="home-greeting">{greeting}</Text>
          <Text style={styles.subGreeting}>{t("Ready for today's practice?", "आज के अभ्यास के लिए तैयार?")}</Text>
        </View>
        <Pressable testID="home-lang-toggle" onPress={toggle} style={styles.langToggle}>
          <Text style={styles.langToggleText}>{lang === "en" ? "हिं" : "EN"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.hero} testID="home-hero">
          <Text style={styles.heroTitle}>{t("Previous Year Questions", "पिछले वर्ष के प्रश्न")}</Text>
          <Text style={styles.heroSub}>
            {t("Bank • SSC • Railway  |  Free, bilingual practice", "बैंक • एसएससी • रेलवे  |  मुफ्त, द्विभाषी अभ्यास")}
          </Text>
          <Pressable
            testID="home-start-practice-btn"
            style={styles.heroCta}
            onPress={() => router.push("/(tabs)/practice")}
          >
            <Text style={styles.heroCtaText}>{t("Start Practice", "अभ्यास शुरू करें")}</Text>
            <Icon name="arrow-forward" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{t("Exam Categories", "परीक्षा श्रेणियाँ")}</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.catGrid}>
            {(cats || []).map((c) => (
              <Pressable
                key={c.category_id}
                testID={`category-card-${c.category_id}`}
                style={styles.catCard}
                onPress={() => router.push({ pathname: "/(tabs)/practice", params: { category: c.category_id } })}
              >
                <View style={styles.catIconWrap}>
                  <Icon name={c.icon as any} size={30} color={colors.brandSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catName}>{pick(c.name, c.name_hi)}</Text>
                  <Text style={styles.catDesc}>{pick(c.description, c.description_hi)}</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}

        {isGuest && (
          <View style={styles.guestBanner}>
            <Icon name="information-circle" size={20} color={colors.brandPrimary} />
            <Text style={styles.guestBannerText}>
              {t("Guest mode: sign in to save progress across devices.", "अतिथि मोड: डिवाइसों में प्रगति सहेजने के लिए साइन इन करें।")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  greeting: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  subGreeting: { fontSize: 13, color: colors.muted, marginTop: 2 },
  langToggle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  langToggleText: { color: colors.onSurface, fontWeight: "700" },
  hero: { backgroundColor: colors.brandPrimary, padding: spacing.xl, borderRadius: radii.lg, marginBottom: spacing.xl },
  heroTitle: { color: colors.onBrandPrimary, fontSize: 20, fontWeight: "800" },
  heroSub: { color: colors.onBrandPrimary, opacity: 0.85, fontSize: 13, marginTop: spacing.xs, marginBottom: spacing.lg },
  heroCta: { flexDirection: "row", alignSelf: "flex-start", backgroundColor: colors.brandSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.pill, alignItems: "center", gap: spacing.sm },
  heroCtaText: { color: colors.onBrandSecondary, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  catGrid: { gap: spacing.md },
  catCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.lg },
  catIconWrap: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  catName: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  catDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  guestBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radii.md, marginTop: spacing.xl },
  guestBannerText: { flex: 1, color: colors.onBrandTertiary, fontSize: 12, lineHeight: 18 },
});
