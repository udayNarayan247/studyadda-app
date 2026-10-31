import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

const SECTIONS: { en: [string, string]; hi: [string, string] }[] = [
  {
    en: ["Information we collect", "If you sign in with Google, we receive your name, email address and profile picture. We store your language preference, test attempts, answers, scores and bookmarks so you can see your progress on any device. Guest tests are not stored on our servers."],
    hi: ["हम कौन सी जानकारी लेते हैं", "Google से साइन इन करने पर हमें आपका नाम, ईमेल और प्रोफ़ाइल फ़ोटो मिलती है। हम आपकी भाषा, टेस्ट, उत्तर, स्कोर और बुकमार्क सहेजते हैं ताकि आप किसी भी डिवाइस पर प्रगति देख सकें। अतिथि टेस्ट हमारे सर्वर पर नहीं सहेजे जाते।"],
  },
  {
    en: ["How we use it", "Only to run the app: sign-in, saving practice history, bookmarks and performance. We do not sell your data or use it for advertising."],
    hi: ["हम इसका उपयोग कैसे करते हैं", "केवल ऐप चलाने के लिए: साइन इन, अभ्यास इतिहास, बुकमार्क और प्रदर्शन सहेजना। हम आपका डेटा नहीं बेचते और न ही विज्ञापन के लिए उपयोग करते हैं।"],
  },
  {
    en: ["Sharing", "We do not share your personal data with third parties, except the sign-in provider used to log you in."],
    hi: ["साझाकरण", "हम आपका व्यक्तिगत डेटा किसी तीसरे पक्ष से साझा नहीं करते, सिवाय साइन-इन प्रदाता के।"],
  },
  {
    en: ["Deleting your data", "You can delete your account any time from Profile > Delete Account. This permanently removes your profile, test history and bookmarks."],
    hi: ["अपना डेटा हटाना", "आप कभी भी प्रोफ़ाइल > खाता हटाएँ से अपना खाता हटा सकते हैं। इससे आपकी प्रोफ़ाइल, टेस्ट इतिहास और बुकमार्क स्थायी रूप से हट जाते हैं।"],
  },
];

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useLang();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/login"))} style={styles.backBtn} testID="privacy-back">
          <Icon name="arrow-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{t("Privacy Policy", "गोपनीयता नीति")}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} testID="privacy-content">
        {SECTIONS.map((s) => {
          const [h, b] = lang === "hi" ? s.hi : s.en;
          return (
            <View key={s.en[0]} style={styles.card}>
              <Text style={styles.h}>{h}</Text>
              <Text style={styles.b}>{b}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  card: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  h: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.xs },
  b: { fontSize: 14, color: colors.onSurfaceTertiary, lineHeight: 22 },
});
