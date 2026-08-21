import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { UI02_ORIGINAL_FOCUS_LAYOUT } from "@/lib/family/ui02-assessment-layout";
import { createMobileRequestId, familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

type FamilyStructure = "双亲家庭" | "单亲家庭" | "重组家庭";
type ChildGender = "男孩" | "女孩";

const FOCUS_ICON: Record<string, { name: "book.fill" | "heart.fill" | "message.fill" | "phone.fill" | "shield.fill"; color: string }> = {
  LEARNING_HABITS: { name: "book.fill", color: "#36B7C7" },
  EMOTION_REGULATION: { name: "message.fill", color: "#F28C45" },
  PARENT_CHILD_COMMUNICATION: { name: "heart.fill", color: "#F06B71" },
  DEVICE_USE_CONTEXT: { name: "phone.fill", color: "#5FA7F7" },
  SELF_REGULATION: { name: "shield.fill", color: "#55B86A" },
};

export default function FamilyAssessmentScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { selectedGrowthFocus, assessmentSyncState, selectGrowthFocus, setAssessmentSyncState } = useFamilyMobile();
  const [familyStructure, setFamilyStructure] = useState<FamilyStructure>("双亲家庭");
  const [childGender, setChildGender] = useState<ChildGender>("男孩");

  const saveFocus = async () => {
    if (!selectedGrowthFocus) return;
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

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView refreshControl={<FamilyRefreshControl />} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="返回" onPress={() => router.back()} hitSlop={10} style={styles.iconButton}>
            <Text style={[styles.backArrow, { color: colors.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.screenTitle, { color: colors.text }]}>家庭测评</Text>
          <View style={styles.topActions}>
            <IconSymbol name="ellipsis" size={22} color={colors.text} />
            <View style={[styles.contextCircle, { borderColor: colors.text }]} />
          </View>
        </View>

        <View style={styles.stepBlock}>
          <Text style={[styles.stepText, { color: colors.text }]}>第 2 / 5 步</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressValue, { backgroundColor: "#1B7CF2" }]} />
          </View>
        </View>

        <View style={styles.questionBlock}>
          <Text style={[styles.questionTitle, { color: colors.text }]}>您孩子目前最需要改善的问题是？</Text>
          <Text style={[styles.questionHint, { color: colors.muted }]}>（单选）</Text>
        </View>

        <View style={styles.focusList}>
          {UI02_ORIGINAL_FOCUS_LAYOUT.map((item) => {
            const selected = item.id === selectedGrowthFocus;
            const icon = FOCUS_ICON[item.id] ?? FOCUS_ICON.PARENT_CHILD_COMMUNICATION;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => { selectGrowthFocus(item.id); haptic.selection(); }}
                style={({ pressed }) => [
                  styles.focusCard,
                  { backgroundColor: colors.background, borderColor: selected ? "#1B7CF2" : colors.border },
                  selected && styles.focusCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.focusIcon, { backgroundColor: `${icon.color}20` }]}>
                  <IconSymbol name={icon.name} size={19} color={icon.color} />
                </View>
                <View style={styles.focusCopy}>
                  <Text style={[styles.focusTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.focusSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
                </View>
                {selected ? <IconSymbol name="checkmark.circle.fill" size={22} color="#1B7CF2" /> : <View style={styles.checkSpacer} />}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.extraBlock}>
          <Text style={[styles.extraTitle, { color: colors.text }]}>补充信息<Text style={[styles.optional, { color: colors.muted }]}>（可选）</Text></Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.text }]}>孩子年龄/阶段</Text>
            <View style={[styles.ageSelector, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.ageText, { color: colors.text }]}>10岁（小学四年级）</Text>
              <Text style={[styles.chevron, { color: colors.muted }]}>⌄</Text>
            </View>
          </View>
          <ChoiceRow label="家庭情况" options={["双亲家庭", "单亲家庭", "重组家庭"]} value={familyStructure} onChange={setFamilyStructure} colors={colors} />
          <ChoiceRow label="孩子性别" options={["男孩", "女孩"]} value={childGender} onChange={setChildGender} colors={colors} />
        </View>

        {assessmentSyncState === "error" ? (
          <Text style={[styles.saveHint, { color: colors.muted }]}>暂时无法同步，仍可继续查看成长解读。</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!selectedGrowthFocus || assessmentSyncState === "syncing"}
          onPress={() => { void saveFocus(); }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: selectedGrowthFocus ? "#1B7CF2" : colors.border },
            pressed && selectedGrowthFocus && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>{assessmentSyncState === "syncing" ? "正在保存" : "下一步"}</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => { onChange(option); haptic.selection(); }}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: colors.background, borderColor: selected ? "#1B7CF2" : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? "#1B7CF2" : colors.muted }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 18, gap: 0 },
  topBar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 36, height: 40, justifyContent: "center", alignItems: "flex-start" },
  backArrow: { fontSize: 35, lineHeight: 38, fontWeight: "300", marginTop: -4 },
  screenTitle: { position: "absolute", left: 48, right: 48, textAlign: "center", fontSize: 17, lineHeight: 23, fontWeight: "800" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 14, minWidth: 50, justifyContent: "flex-end" },
  contextCircle: { width: 16, height: 16, borderWidth: 1.6, borderRadius: 8 },
  stepBlock: { marginTop: 18, gap: 10 },
  stepText: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressValue: { width: "40%", height: "100%", borderRadius: 3 },
  questionBlock: { marginTop: 20, gap: 3 },
  questionTitle: { fontSize: 20, lineHeight: 28, fontWeight: "800" },
  questionHint: { fontSize: 14, lineHeight: 20 },
  focusList: { marginTop: 14, gap: 8 },
  focusCard: { minHeight: 64, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  focusCardSelected: { borderWidth: 2, paddingHorizontal: 12 },
  focusIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  focusCopy: { flex: 1, gap: 1 },
  focusTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  focusSubtitle: { fontSize: 12, lineHeight: 17 },
  checkSpacer: { width: 22, height: 22 },
  extraBlock: { marginTop: 20, gap: 12 },
  extraTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  optional: { fontSize: 13, fontWeight: "500" },
  infoRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  infoLabel: { fontSize: 14, lineHeight: 20 },
  ageSelector: { minHeight: 32, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 5 },
  ageText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  chevron: { fontSize: 14, lineHeight: 16 },
  chips: { flexDirection: "row", alignItems: "center", gap: 5 },
  chip: { minHeight: 29, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  saveHint: { marginTop: 12, fontSize: 12, lineHeight: 18, textAlign: "center" },
  primaryButton: { marginTop: 18, minHeight: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 17, lineHeight: 23, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
