import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { useAuth } from "@/src/auth-context";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithGoogle, signInWithApple, signInAsGuest } = useAuth();
  const { t, lang, setLang } = useLang();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  const onApple = async () => {
    setAuthError(null);
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      setAuthError(t("Apple sign-in failed. Please try again.", "Apple साइन इन विफल रहा। कृपया पुनः प्रयास करें।"));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.langRow}>
        <Pressable
          testID="lang-toggle-en"
          onPress={() => setLang("en")}
          style={[styles.langPill, lang === "en" && styles.langPillActive]}
        >
          <Text style={[styles.langText, lang === "en" && styles.langTextActive]}>EN</Text>
        </Pressable>
        <Pressable
          testID="lang-toggle-hi"
          onPress={() => setLang("hi")}
          style={[styles.langPill, lang === "hi" && styles.langPillActive]}
        >
          <Text style={[styles.langText, lang === "hi" && styles.langTextActive]}>हिं</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Image
          testID="login-logo"
          source={require("@/assets/images/app-logo.png")}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="StudyAdda Dhanbad logo"
        />
        <Text style={styles.brand}>StudyAdda Dhanbad</Text>
        <Text style={styles.tag}>
          {t("Free PYQs & Practice for Bank, SSC, Railway Exams", "बैंक, एसएससी, रेलवे परीक्षाओं के लिए मुफ्त PYQs और अभ्यास")}
        </Text>
      </View>

      <View style={styles.ctas}>
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            testID="apple-signin-btn"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radii.md}
            style={styles.appleBtn}
            onPress={onApple}
          />
        )}
        <Pressable testID="google-signin-btn" style={styles.googleBtn} onPress={signInWithGoogle}>
          <Icon name="logo-google" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.googleText}>{t("Continue with Google", "Google से जारी रखें")}</Text>
        </Pressable>
        <Pressable testID="guest-signin-btn" style={styles.guestBtn} onPress={signInAsGuest}>
          <Text style={styles.guestText}>{t("Continue as Guest", "अतिथि के रूप में जारी रखें")}</Text>
        </Pressable>
        {!!authError && <Text style={styles.authError} testID="login-auth-error">{authError}</Text>}
        <Text style={styles.footer}>
          {t("Sign in to sync bookmarks, test history and performance across devices.",
             "डिवाइसों में बुकमार्क, टेस्ट इतिहास और प्रदर्शन सिंक करने के लिए साइन इन करें।")}
        </Text>
        <Pressable testID="login-privacy-link" onPress={() => router.push("/privacy")} hitSlop={8}>
          <Text style={styles.privacyLink}>{t("Privacy Policy", "गोपनीयता नीति")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  langRow: { flexDirection: "row", alignSelf: "flex-end", gap: spacing.sm },
  langPill: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  langPillActive: { backgroundColor: colors.brandPrimary },
  langText: { color: colors.onSurfaceTertiary, fontWeight: "600" },
  langTextActive: { color: colors.onBrandPrimary },
  hero: { alignItems: "center", gap: spacing.lg },
  logo: { width: 180, height: 180 },
  appleBtn: { width: "100%", height: 52 },
  authError: { color: colors.error, fontSize: 13, textAlign: "center" },
  brand: { fontSize: 28, fontWeight: "800", color: colors.onSurface, letterSpacing: 0.3 },
  tag: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22, paddingHorizontal: spacing.lg },
  ctas: { gap: spacing.md },
  googleBtn: { flexDirection: "row", backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: radii.md, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  googleText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  guestBtn: { borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: 16, borderRadius: radii.md, alignItems: "center" },
  guestText: { color: colors.onSurface, fontWeight: "600", fontSize: 16 },
  footer: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: spacing.sm, lineHeight: 18 },
  privacyLink: { fontSize: 12, color: colors.info, textAlign: "center", textDecorationLine: "underline", paddingVertical: spacing.md },
});
