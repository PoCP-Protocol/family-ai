import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getGrowthFocus } from "@/lib/family/core-growth";
import { useFamilyMobile } from "@/lib/family/family-state";

export default function FamilyAssessmentResultScreen() {
  const colors = useColors();
  const { selectedGrowthFocus, assessmentSyncState } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const observations = focus?.subtitle ? focus.subtitle.split("、").filter(Boolean) : [];

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "测评完成", headerBackTitle: "返回" }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: "#EAF6FF" }]}>
          <View style={styles.heroIcon}>
            <IconSymbol name="checkmark.circle.fill" size={36} color="#1B7CF2" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>免费家庭测评已完成</Text>
          <Text style={[styles.heroText, { color: colors.muted }]}>这是你这次家庭自查的结果，帮你把最近的情况整理清楚，随时可以回来查看或重新调整。</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.muted }]}>你这次最想先支持的方向</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{focus?.title ?? "家庭支持方向"}</Text>
          <Text style={[styles.cardText, { color: colors.muted }]}>{focus?.subtitle ?? "你可以随时回到测评，补充或调整这次的选择。"}</Text>
        </View>

        {observations.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.muted }]}>这次你关注到的情况</Text>
            {observations.map((item) => (
              <View key={item} style={styles.observationRow}>
                <View style={[styles.dot, { backgroundColor: "#1B7CF2" }]} />
                <Text style={[styles.cardText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
            <Text style={[styles.boundaryText, { color: colors.muted }]}>这些都是你选择的家庭视角情况，不是对孩子的评分、排名或诊断。</Text>
          </View>
        ) : null}

        <View style={[styles.statusCard, { backgroundColor: assessmentSyncState === "synced" ? "#EAF8F3" : "#F1F5F9" }]}>
          <IconSymbol name={assessmentSyncState === "synced" ? "checkmark.circle.fill" : "clock.fill"} size={22} color={assessmentSyncState === "synced" ? "#16866D" : "#64748B"} />
          <Text style={[styles.statusText, { color: colors.text }]}>{assessmentSyncState === "synced" ? "已保存到家庭测评记录" : "已保存在本机，连接家庭后可同步"}</Text>
        </View>

        <Pressable onPress={() => router.replace("/ui/UI-02" as Href)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>返回调整测评</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/ui/UI-03" as Href)} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
          <Text style={[styles.linkButtonText, { color: colors.muted }]}>如需进一步理解，可查看家庭支持方向（需家庭确认）</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 18, gap: 14 },
  hero: { borderRadius: 24, paddingHorizontal: 22, paddingVertical: 26, gap: 12, alignItems: "flex-start" },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 23, lineHeight: 31, fontWeight: "900" },
  heroText: { fontSize: 14, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 7 },
  cardLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  cardTitle: { fontSize: 17, lineHeight: 24, fontWeight: "900" },
  cardText: { fontSize: 13, lineHeight: 21 },
  boundaryText: { fontSize: 12, lineHeight: 19, marginTop: 4 },
  observationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  statusCard: { borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  statusText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  primaryButton: { minHeight: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "900" },
  linkButton: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  linkButtonText: { fontSize: 12, lineHeight: 18, textAlign: "center", textDecorationLine: "underline" },
  pressed: { opacity: 0.85 },
});