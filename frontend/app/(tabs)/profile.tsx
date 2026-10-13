import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isGuest, signOut, signInWithGoogle } = useAuth();
  const { t, lang, setLang } = useLang();

  const Row = ({ icon, label, onPress, testID, right }: any) => (
    <Pressable testID={testID} style={styles.row} onPress={onPress}>
      <Icon name={icon} size={20} color={colors.onSurface} />
      <Text style={styles.rowLabel}>{label}</Text>
      {right ?? <Icon name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || "G").slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} testID="profile-name">{user?.name || t("Guest", "अतिथि")}</Text>
            <Text style={styles.email}>{user?.email || t("Not signed in", "साइन इन नहीं किया")}</Text>
            {user?.role === "admin" && (
              <View style={styles.badge}><Text style={styles.badgeText}>ADMIN</Text></View>
            )}
          </View>
        </View>

        <Text style={styles.section}>{t("Preferences", "वरीयताएँ")}</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Icon name="language" size={20} color={colors.onSurface} />
            <Text style={styles.rowLabel}>{t("Language", "भाषा")}</Text>
            <View style={styles.langPills}>
              <Pressable testID="profile-lang-en" onPress={() => setLang("en")} style={[styles.langPill, lang === "en" && styles.langPillActive]}>
                <Text style={[styles.langPillText, lang === "en" && styles.langPillTextActive]}>EN</Text>
              </Pressable>
              <Pressable testID="profile-lang-hi" onPress={() => setLang("hi")} style={[styles.langPill, lang === "hi" && styles.langPillActive]}>
                <Text style={[styles.langPillText, lang === "hi" && styles.langPillTextActive]}>हिं</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={styles.section}>{t("Library", "लाइब्रेरी")}</Text>
        <View style={styles.group}>
          <Row testID="profile-bookmarks-btn" icon="bookmark" label={t("Bookmarks", "बुकमार्क")} onPress={() => router.push("/bookmarks")} />
          <Row testID="profile-history-btn" icon="time" label={t("Test History", "टेस्ट इतिहास")} onPress={() => router.push("/(tabs)/history")} />
        </View>

        {user?.role === "admin" && (
          <>
            <Text style={styles.section}>{t("Admin", "व्यवस्थापक")}</Text>
            <View style={styles.group}>
              <Row testID="profile-admin-btn" icon="construct" label={t("Admin Dashboard", "व्यवस्थापक डैशबोर्ड")} onPress={() => router.push("/admin")} />
            </View>
          </>
        )}

        <View style={{ marginTop: spacing.xl }}>
          {isGuest ? (
            <Pressable testID="profile-signin-btn" style={styles.signoutBtn} onPress={signInWithGoogle}>
              <Icon name="logo-google" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.signoutText}>{t("Sign in with Google", "Google से साइन इन करें")}</Text>
            </Pressable>
          ) : (
            <Pressable testID="profile-signout-btn" style={[styles.signoutBtn, { backgroundColor: colors.error }]} onPress={signOut}>
              <Icon name="log-out" size={18} color={colors.onError} />
              <Text style={styles.signoutText}>{t("Sign Out", "साइन आउट")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.brandPrimary, borderRadius: radii.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: colors.onBrandSecondary },
  name: { fontSize: 18, fontWeight: "800", color: colors.onBrandPrimary },
  email: { fontSize: 12, color: colors.onBrandPrimary, opacity: 0.8, marginTop: 2 },
  badge: { alignSelf: "flex-start", backgroundColor: colors.brandSecondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, marginTop: spacing.xs },
  badgeText: { fontSize: 10, color: colors.onBrandSecondary, fontWeight: "800" },
  section: { fontSize: 12, color: colors.muted, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  group: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.onSurface },
  langPills: { flexDirection: "row", gap: spacing.xs },
  langPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surfaceTertiary },
  langPillActive: { backgroundColor: colors.brandPrimary },
  langPillText: { color: colors.onSurfaceTertiary, fontWeight: "700", fontSize: 12 },
  langPillTextActive: { color: colors.onBrandPrimary },
  signoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: radii.md },
  signoutText: { color: colors.onBrandPrimary, fontWeight: "700" },
});
