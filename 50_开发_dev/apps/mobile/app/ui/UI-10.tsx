import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getChildPrompt, type ChildChoice } from "@/lib/family/child-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { selectChildActionPrompt, type FamilyApiCoreGrowthProjection } from "@/lib/family/family-api-projections";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

export default function ChildAssistantScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { lastReceipt, campCompletedDays, childChoiceDraft, recordChildChoice } = useFamilyMobile();
  const [promptOffset, setPromptOffset] = useState(0);
  const [remoteProjection, setRemoteProjection] = useState<FamilyApiCoreGrowthProjection | null>(null);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    familyApi.getDevCoreGrowth<FamilyApiCoreGrowthProjection>(session.token, session.selectedFamily.family_id)
      .then((result) => { if (active) setRemoteProjection(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const apiPrompt = selectChildActionPrompt(remoteProjection);
  const localPrompt = useMemo(() => getChildPrompt(campCompletedDays.length + promptOffset), [campCompletedDays.length, promptOffset]);
  const prompt = apiPrompt ? {
    id: `family-api-child-${apiPrompt.focus}`,
    title: apiPrompt.headline,
    invitation: apiPrompt.shared_action,
    purpose: apiPrompt.pause_hint,
    estimatedMinutes: 5,
    choices: localPrompt.choices,
  } : localPrompt;
  const hasFamilyAction = Boolean(apiPrompt) || Boolean(lastReceipt) || campCompletedDays.length > 0;

  const choose = (choice: ChildChoice) => {
    if (choice === "CHOOSE_ANOTHER") {
      setPromptOffset((value) => value + 1);
      haptic.selection();
      return;
    }
    recordChildChoice(prompt.id, choice);
    if (choice === "PAUSE_TODAY") haptic.selection();
    else haptic.success();
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "成长小助手", headerBackTitle: "返回" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.tint }]}>和孩子一起选择</Text>
          <Text style={[styles.title, { color: colors.text }]}>今天想一起试试什么？</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>没有标准答案。可以试试、换一个，也可以今天先暂停。</Text>
          <DataSourceBanner />
        </View>

        <View style={[styles.privacyBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.privacyDot, { backgroundColor: colors.success }]} />
          <View style={styles.privacyCopy}>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>只保存在这个家庭</Text>
            <Text style={[styles.privacyText, { color: colors.muted }]}>不记录姓名、学校、能力、分数或“是否听话”。</Text>
          </View>
        </View>

        {!hasFamilyAction ? (
          <View style={[styles.emptyPanel, { backgroundColor: "#09295A" }]}>
            <Text style={styles.emptyLabel}>先和家长完成一次家庭行动</Text>
            <Text style={styles.emptyTitle}>小助手会在行动之后，给你一个可以自由选择的小练习</Text>
            <Text style={styles.emptyText}>这里不会安排必须完成的挑战，也不会因为暂停而扣分。</Text>
            <Pressable onPress={() => router.push("/ui/UI-09" as Href)} style={({ pressed }) => [styles.darkButton, pressed && styles.pressed]}>
              <Text style={styles.darkButtonText}>和家长看看今日行动</Text>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.practiceCard, { backgroundColor: "#09295A" }]}>
              <View style={styles.practiceTopline}>
                <Text style={styles.practiceLabel}>可以一起试试</Text>
                <Text style={styles.practiceTime}>约 {prompt.estimatedMinutes} 分钟</Text>
              </View>
              <Text style={styles.practiceTitle}>{prompt.title}</Text>
              <Text style={styles.practiceInvitation}>{prompt.invitation}</Text>
              <Text style={styles.practicePurpose}>{prompt.purpose}</Text>
            </View>

            <View style={styles.choiceArea}>
              <Pressable onPress={() => choose("TRY_THIS")} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>我想试试</Text>
                <IconSymbol name="checkmark.circle.fill" size={21} color="#FFFFFF" />
              </Pressable>
              <View style={styles.choiceRow}>
                <Pressable onPress={() => choose("CHOOSE_ANOTHER")} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>换一个</Text>
                </Pressable>
                <Pressable onPress={() => choose("PAUSE_TODAY")} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.secondaryButtonText, { color: colors.muted }]}>今天先暂停</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {childChoiceDraft ? (
          <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name={childChoiceDraft.choice === "PAUSE_TODAY" ? "pause.circle.fill" : "checkmark.circle.fill"} size={30} color={childChoiceDraft.choice === "PAUSE_TODAY" ? colors.warning : colors.success} />
            <View style={styles.receiptCopy}>
              <Text style={[styles.receiptTitle, { color: colors.text }]}>
                {childChoiceDraft.choice === "PAUSE_TODAY" ? "今天先到这里也可以" : "你的选择已经记下"}
              </Text>
              <Text style={[styles.receiptText, { color: colors.muted }]}>这是一次家庭内的选择记录，不会被当作你的能力、性格或表现。</Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.parentNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.parentNoteLabel, { color: colors.tint }]}>给家长</Text>
          <Text style={[styles.parentNoteTitle, { color: colors.text }]}>让选择真的有用</Text>
          <Text style={[styles.parentNoteText, { color: colors.muted }]}>孩子选择暂停或换一个时，不追问理由、不扣分，也不把这个选择解释成抗拒。</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 16 },
  header: { gap: 8 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: "800" },
  subtitle: { fontSize: 16, lineHeight: 24 },
  privacyBar: { minHeight: 76, borderWidth: 1, borderRadius: 19, padding: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  privacyDot: { width: 10, height: 10, borderRadius: 5 },
  privacyCopy: { flex: 1, gap: 2 },
  privacyTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  privacyText: { fontSize: 12, lineHeight: 18 },
  emptyPanel: { borderRadius: 26, padding: 21, gap: 10 },
  emptyLabel: { color: "#FFD9B8", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  emptyTitle: { color: "#FFFFFF", fontSize: 21, lineHeight: 29, fontWeight: "800" },
  emptyText: { color: "#C4D7EE", fontSize: 14, lineHeight: 21 },
  darkButton: { minHeight: 50, borderRadius: 16, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  darkButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "800" },
  practiceCard: { borderRadius: 28, padding: 22, gap: 12 },
  practiceTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  practiceLabel: { color: "#FFD9B8", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  practiceTime: { color: "#BFD3EC", fontSize: 12, lineHeight: 17 },
  practiceTitle: { color: "#FFFFFF", fontSize: 26, lineHeight: 34, fontWeight: "800" },
  practiceInvitation: { color: "#FFFFFF", fontSize: 17, lineHeight: 25, fontWeight: "600" },
  practicePurpose: { color: "#BFD3EC", fontSize: 13, lineHeight: 19 },
  choiceArea: { gap: 10 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  choiceRow: { flexDirection: "row", gap: 10 },
  secondaryButton: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  receipt: { minHeight: 92, borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  receiptCopy: { flex: 1, gap: 4 },
  receiptTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  receiptText: { fontSize: 13, lineHeight: 19 },
  parentNote: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 6 },
  parentNoteLabel: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  parentNoteTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  parentNoteText: { fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
