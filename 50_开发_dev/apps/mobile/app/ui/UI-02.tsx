import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { ASSESSMENT_ANSWER_OPTIONS, GROWTH_FOCUSES, assessmentCompletion, getGrowthFocus } from "@/lib/family/core-growth";
import { createMobileRequestId, familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

export default function FamilyAssessmentScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const {
    selectedGrowthFocus,
    assessmentAnswers,
    assessmentSyncState,
    selectGrowthFocus,
    answerAssessment,
    setAssessmentSyncState,
  } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const completion = assessmentCompletion(selectedGrowthFocus, assessmentAnswers);

  const saveFocus = async () => {
    if (!selectedGrowthFocus || completion < 1) return;
    haptic.light();
    if (session.status === "connected" && session.token && session.selectedFamily) {
      try {
        setAssessmentSyncState("syncing");
        await familyApi.recordDevFlowEvent(
          session.token,
          session.selectedFamily.family_id,
          { ui_id: "UI-02", command: "SELECT_SYNTHETIC_ASSESSMENT_DIMENSION", selection: selectedGrowthFocus },
          createMobileRequestId(`ui02-${selectedGrowthFocus.toLowerCase()}`),
        );
        setAssessmentSyncState("synced");
      } catch {
        setAssessmentSyncState("error");
      }
    }
    haptic.success();
    router.push("/ui/UI-03" as Href);
  };

  const questions = focus?.questions ?? [];

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "家庭测评", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={questions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.tint }]}>UI-02 · 家长视角</Text>
            <Text style={[styles.title, { color: colors.text }]}>现在最想先改善哪个家庭场景？</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>这不是儿童诊断。答案只代表你此刻的观察，也可以随时修改。</Text>
            <DataSourceBanner />
            <View style={styles.focusGrid}>
              {GROWTH_FOCUSES.map((item) => {
                const selected = item.id === selectedGrowthFocus;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => { selectGrowthFocus(item.id); haptic.selection(); }}
                    style={({ pressed }) => [
                      styles.focusCard,
                      { backgroundColor: colors.surface, borderColor: selected ? item.color : colors.border },
                      selected && { borderWidth: 2 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.focusDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.focusTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.focusSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
            {focus ? (
              <View style={styles.questionIntro}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>最近两周，这些情况出现得多吗？</Text>
                <Text style={[styles.progressText, { color: colors.muted }]}>{Math.round(completion * 100)}% 已回答</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.questionNumber, { color: colors.tint }]}>0{index + 1}</Text>
            <Text style={[styles.questionText, { color: colors.text }]}>{item.text}</Text>
            <View style={styles.answerRow}>
              {ASSESSMENT_ANSWER_OPTIONS.map((option) => {
                const selected = assessmentAnswers[item.id] === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => { answerAssessment(item.id, option.id); haptic.selection(); }}
                    style={({ pressed }) => [
                      styles.answer,
                      { backgroundColor: selected ? colors.tint : colors.background, borderColor: selected ? colors.tint : colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.answerText, { color: selected ? "#FFFFFF" : colors.text }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>先选择一个家庭场景</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>我们一次只处理一个重点，避免让家长和孩子背负过多任务。</Text>
          </View>
        }
        ListFooterComponent={focus ? (
          <View style={styles.footer}>
            <Text style={[styles.boundary, { color: colors.muted }]}>保存后会形成成长解读草稿，不会生成总分、排名或儿童诊断。</Text>
            <Pressable
              disabled={completion < 1 || assessmentSyncState === "syncing"}
              onPress={() => { void saveFocus(); }}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: completion === 1 ? colors.tint : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{assessmentSyncState === "syncing" ? "正在保存" : "保存并查看成长解读"}</Text>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 13 },
  header: { gap: 14, marginBottom: 2 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  focusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  focusCard: { width: "48%", minHeight: 126, borderWidth: 1, borderRadius: 20, padding: 14, gap: 7 },
  focusDot: { width: 10, height: 10, borderRadius: 5 },
  focusTitle: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  focusSubtitle: { fontSize: 12, lineHeight: 18 },
  questionIntro: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitle: { flex: 1, fontSize: 19, lineHeight: 25, fontWeight: "800" },
  progressText: { fontSize: 12, lineHeight: 17 },
  questionCard: { borderWidth: 1, borderRadius: 22, padding: 17, gap: 13 },
  questionNumber: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  questionText: { fontSize: 17, lineHeight: 25, fontWeight: "700" },
  answerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  answer: { minWidth: 66, minHeight: 42, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  answerText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  empty: { minHeight: 120, borderWidth: 1, borderRadius: 22, padding: 18, justifyContent: "center", gap: 5 },
  emptyTitle: { fontSize: 17, lineHeight: 23, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 21 },
  footer: { gap: 12, paddingTop: 6 },
  boundary: { fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
