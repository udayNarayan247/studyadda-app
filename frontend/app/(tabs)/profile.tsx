import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isGuest, signOut, signInWithGoogle, deleteAccount } = useAuth();
  const { t, lang, setLang } = useLang();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      setConfirmDelete(false);
    } catch {
      setDeleteError(t("Could not delete account. Please try again.", "खाता नहीं हटाया जा सका। कृपया पुनः प्रयास करें।"));
    } finally {
      setDeleting(false);
    }
  };

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

        <Text style={styles.section}>{t("About", "जानकारी")}</Text>
        <View style={styles.group}>
          <Row testID="profile-privacy-btn" icon="shield-checkmark" label={t("Privacy Policy", "गोपनीयता नीति")} onPress={() => router.push("/privacy")} />
        </View>

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
          {!!user && (
            <Pressable testID="profile-delete-account-btn" style={styles.deleteBtn} onPress={() => { setDeleteError(null); setConfirmDelete(true); }}>
              <Text style={styles.deleteText}>{t("Delete Account", "खाता हटाएँ")}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {confirmDelete && (
        <View style={styles.modalBackdrop} testID="delete-account-modal">
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("Delete your account?", "अपना खाता हटाएँ?")}</Text>
            <Text style={styles.modalBody}>
              {t("This permanently deletes your profile, test history and bookmarks. This cannot be undone.",
                 "इससे आपकी प्रोफ़ाइल, टेस्ट इतिहास और बुकमार्क स्थायी रूप से हट जाएँगे। इसे वापस नहीं किया जा सकता।")}
            </Text>
            {!!deleteError && <Text style={styles.modalError} testID="delete-account-error">{deleteError}</Text>}
            <View style={styles.modalRow}>
              <Pressable testID="delete-account-cancel" style={styles.modalBtn} onPress={() => setConfirmDelete(false)} disabled={deleting}>
                <Text style={styles.modalBtnText}>{t("Cancel", "रद्द करें")}</Text>
              </Pressable>
              <Pressable testID="delete-account-confirm" style={[styles.modalBtn, styles.modalBtnDanger]} onPress={onDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color={colors.onError} /> : <Text style={[styles.modalBtnText, { color: colors.onError }]}>{t("Delete", "हटाएँ")}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
  deleteBtn: { marginTop: spacing.md, paddingVertical: 14, alignItems: "center", borderRadius: radii.md, borderWidth: 1, borderColor: colors.error },
  deleteText: { color: colors.error, fontWeight: "700" },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(11,21,42,0.55)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, width: "100%", maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  modalBody: { fontSize: 14, color: colors.muted, marginTop: spacing.sm, lineHeight: 22 },
  modalError: { fontSize: 13, color: colors.error, marginTop: spacing.sm },
  modalRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  modalBtn: { flex: 1, minHeight: 48, borderRadius: radii.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  modalBtnDanger: { backgroundColor: colors.error, borderColor: colors.error },
  modalBtnText: { fontWeight: "700", color: colors.onSurface },
});
