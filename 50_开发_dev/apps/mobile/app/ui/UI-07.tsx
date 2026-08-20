import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { assessmentCompletion, getGrowthFocus } from "@/lib/family/core-growth";
import { useFamilyMobile } from "@/lib/family/family-state";

export default function GrowthAssessmentEntryScreen() {
  const colors = useColors();
  const { selectedGrowthFocus, assessmentAnswers, assessmentSyncState } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const completion = assessmentCompletion(selectedGrowthFocus, assessmentAnswers);

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "成长测评", headerBackTitle: "返回" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.tint }]}>UI-07 · 成长入口</Text>
        <Text style={[styles.title, { color: colors.text }]}>从一个真实场景开始</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>测评帮助家庭决定先练习什么，不用于给孩子贴标签，也不产生家庭总分。</Text>
        <DataSourceBanner />

        {focus ? (
          <View style={[styles.focusPanel, { backgroundColor: colors.surface, borderColor: focus.color }]}>
            <View style={[styles.focusMark, { backgroundColor: focus.color }]} />
            <Text style={[styles.focusLabel, { color: colors.muted }]}>当前关注场景</Text>
            <Text style={[styles.focusTitle, { color: colors.text }]}>{focus.title}</Text>
            <Text style={[styles.focusSubtitle, { color: colors.muted }]}>{focus.subtitle}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${Math.round(completion * 100)}%`, backgroundColor: focus.color }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.muted }]}>
              {completion === 1 ? `已完成 · ${assessmentSyncState === "synced" ? "Family API 已回读" : "保存在本机"}` : `${Math.round(completion * 100)}% 已回答`}
            </Text>
          </View>
        ) : (
          <View style={[styles.focusPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.focusLabel, { color: colors.muted }]}>还没有选择关注场景</Text>
            <Text style={[styles.focusTitle, { color: colors.text }]}>一次只从一个重点开始</Text>
            <Text style={[styles.focusSubtitle, { color: colors.muted }]}>预计 3 分钟，可以随时返回修改。</Text>
          </View>
        )}

        <View style={[styles.boundaryPanel, { backgroundColor: "#09295A" }]}>
          <Text style={styles.boundaryTitle}>你会得到什么</Text>
          <Text style={styles.boundaryItem}>· 一份来源清楚的家庭成长解读</Text>
          <Text style={styles.boundaryItem}>· 一个本周可以开始的小行动</Text>
          <Text style={styles.boundaryItem}>· 可由家庭确认的 90 天计划草稿</Text>
          <Text style={styles.boundaryNote}>不会生成儿童诊断、家庭排名或确定性效果结论。</Text>
        </View>

        <Pressable
          onPress={() => router.push("/ui/UI-02" as Href)}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{focus ? "继续或修改家庭测评" : "开始家庭测评"}</Text>
          <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 16 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  focusPanel: { borderWidth: 1.5, borderRadius: 24, padding: 20, gap: 8 },
  focusMark: { width: 36, height: 6, borderRadius: 3, marginBottom: 4 },
  focusLabel: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  focusTitle: { fontSize: 24, lineHeight: 31, fontWeight: "800" },
  focusSubtitle: { fontSize: 14, lineHeight: 21 },
  progressTrack: { height: 7, borderRadius: 999, overflow: "hidden", marginTop: 6 },
  progressFill: { height: 7, borderRadius: 999 },
  progressText: { fontSize: 12, lineHeight: 17 },
  boundaryPanel: { borderRadius: 24, padding: 20, gap: 8 },
  boundaryTitle: { color: "#FFD9B8", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  boundaryItem: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, fontWeight: "600" },
  boundaryNote: { color: "#BFD3EC", fontSize: 12, lineHeight: 18, marginTop: 4 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
