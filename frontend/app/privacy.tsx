import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Stack } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useLang } from "@/src/lang-context";
import { colors, radii, spacing } from "@/src/theme";

const EFFECTIVE_DATE = { en: "Effective date: 31 October 2026", hi: "प्रभावी तिथि: 31 अक्टूबर 2026" };

const SECTIONS: { en: [string, string]; hi: [string, string] }[] = [
  {
    en: ["Who we are", "StudyAdda Dhanbad, Room No. 421, 2nd Floor, Luby Circular Road City Centre, Near Bus Stand, Dhanbad - 826001, Jharkhand, India. A free exam practice app for Bank, SSC and Railway aspirants."],
    hi: ["हम कौन हैं", "स्टडीअड्डा धनबाद, रूम नं. 421, दूसरी मंज़िल, लूबी सर्कुलर रोड सिटी सेंटर, बस स्टैंड के पास, धनबाद - 826001, झारखंड। बैंक, एसएससी और रेलवे परीक्षार्थियों के लिए मुफ्त अभ्यास ऐप।"],
  },
  {
    en: ["Information we collect", "With Google sign-in we receive your name, email and profile picture. With Apple sign-in we receive an Apple user ID and, only if you share them, your name and email (may be a private relay address). We store your language, tests, answers, scores, practised questions (to avoid repeats) and bookmarks so you can see progress on any device. Guest tests are not stored on our servers."],
    hi: ["हम कौन सी जानकारी लेते हैं", "Google साइन इन से हमें आपका नाम, ईमेल और प्रोफ़ाइल फ़ोटो मिलती है। Apple साइन इन से Apple यूज़र आईडी और, यदि आप साझा करें, तो नाम और ईमेल मिलते हैं। हम आपकी भाषा, टेस्ट, उत्तर, स्कोर, अभ्यास किए गए प्रश्न (दोहराव रोकने के लिए) और बुकमार्क सहेजते हैं। अतिथि टेस्ट हमारे सर्वर पर नहीं सहेजे जाते।"],
  },
  {
    en: ["How we use it", "Only to run the app: sign-in, saving practice history, bookmarks and performance. We do not sell your data or use it for advertising."],
    hi: ["हम इसका उपयोग कैसे करते हैं", "केवल ऐप चलाने के लिए: साइन इन, अभ्यास इतिहास, बुकमार्क और प्रदर्शन सहेजना। हम आपका डेटा नहीं बेचते और न ही विज्ञापन के लिए उपयोग करते हैं।"],
  },
  {
    en: ["Sharing", "We do not share your personal data with third parties, except the sign-in provider (Google or Apple) used to log you in."],
    hi: ["साझाकरण", "हम आपका व्यक्तिगत डेटा किसी तीसरे पक्ष से साझा नहीं करते, सिवाय साइन-इन प्रदाता (Google या Apple) के।"],
  },
  {
    en: ["Deleting your data", "Delete your account any time from Profile > Delete Account. This permanently removes your profile, test history, practised-question history and bookmarks. You can also request deletion by email."],
    hi: ["अपना डेटा हटाना", "प्रोफ़ाइल > खाता हटाएँ से कभी भी अपना खाता हटाएँ। इससे आपकी प्रोफ़ाइल, टेस्ट इतिहास, अभ्यास इतिहास और बुकमार्क स्थायी रूप से हट जाते हैं। आप ईमेल से भी अनुरोध कर सकते हैं।"],
  },
  {
    en: ["Children", "The app is meant for students preparing for recruitment exams and is not directed at children under 13."],
    hi: ["बच्चे", "यह ऐप भर्ती परीक्षाओं की तैयारी करने वाले छात्रों के लिए है और 13 वर्ष से कम उम्र के बच्चों के लिए नहीं है।"],
  },
  {
    en: ["Contact us", "Email: un2085@gmail.com\nPhone: 9123494102, 8101698099"],
    hi: ["संपर्क करें", "ईमेल: un2085@gmail.com\nफ़ोन: 9123494102, 8101698099"],
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
        <Text style={styles.date} testID="privacy-effective-date">{lang === "hi" ? EFFECTIVE_DATE.hi : EFFECTIVE_DATE.en}</Text>
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
  date: { fontSize: 13, color: colors.muted, fontWeight: "600", marginBottom: spacing.md },
});
