import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

export default function DailyTaskScreen() {
  const colors = useColors();
  const { todayAction, lastReceipt, activeCampDay, startAction, completeAction, skipAction } = useFamilyMobile();
  const [reflection, setReflection] = useState(lastReceipt?.actionId === todayAction.id ? lastReceipt.reflection : "");
  const isComplete = todayAction.status === "checked_in";

  const handleStart = () => {
    haptic.light();
    startAction();
  };

  const handleComplete = () => {
    completeAction(reflection);
    haptic.success();
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "今日成长任务", headerBackTitle: "返回" }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.metaRow}>
          <Text style={[styles.eyebrow, { color: colors.tint }]}>{activeCampDay ? `21 天成长营 · Day ${activeCampDay}` : "我们家的今天"}</Text>
          <Text style={[styles.duration, { color: colors.muted }]}>约 {todayAction.estimatedMinutes} 分钟</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{todayAction.title}</Text>
        <Text style={[styles.reason, { color: colors.muted }]}>{todayAction.reason}</Text>

        <View style={[styles.actionPanel, { backgroundColor: "#09295A" }]}>
          <Text style={styles.panelLabel}>今晚做什么</Text>
          <Text style={styles.panelText}>{todayAction.title}</Text>
          <View style={styles.divider} />
          <Text style={styles.panelLabel}>可以怎么说</Text>
          <Text style={styles.quote}>“{todayAction.suggestedWords}”</Text>
        </View>

        <View style={[styles.infoPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>只观察一个信号</Text>
          <Text style={[styles.infoText, { color: colors.muted }]}>{todayAction.observationPrompt}</Text>
        </View>

        {!isComplete ? (
          <View style={styles.formArea}>
            {todayAction.status === "not_started" ? (
              <Pressable onPress={handleStart} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>开始这次练习</Text>
              </Pressable>
            ) : (
              <>
                <Text style={[styles.formLabel, { color: colors.text }]}>完成后，记下一句话（可选）</Text>
                <TextInput
                  accessibilityLabel="家长反思"
                  multiline
                  returnKeyType="done"
                  value={reflection}
                  onChangeText={setReflection}
                  placeholder="例如：我忍住了打断，孩子多说了一会儿。"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                />
                <Text style={[styles.perspectiveNote, { color: colors.muted }]}>这段记录是你的视角，不会被当作孩子的事实或教育结果。</Text>
                <Pressable onPress={handleComplete} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.success }, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>已完成，记下来</Text>
                  <IconSymbol name="checkmark.circle.fill" size={21} color="#FFFFFF" />
                </Pressable>
              </>
            )}
            <Pressable onPress={() => { skipAction(); haptic.selection(); }} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.secondaryButtonText, { color: colors.muted }]}>今天不适合，先跳过</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.receipt, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="checkmark.circle.fill" size={32} color={colors.success} />
            <Text style={[styles.receiptTitle, { color: colors.text }]}>这次行动已记录</Text>
            <Text style={[styles.receiptText, { color: colors.muted }]}>完成代表行动发生，不代表已经产生教育效果。</Text>
            {reflection ? <Text style={[styles.reflection, { color: colors.text }]}>“{reflection}”</Text> : null}
            <Pressable
              onPress={() => router.push((activeCampDay ? "/ui/UI-35" : "/(tabs)") as Href)}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{activeCampDay ? "回到 21 天成长营" : "回到今天"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, gap: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  duration: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: "800" },
  reason: { fontSize: 16, lineHeight: 24 },
  actionPanel: { borderRadius: 28, padding: 22, gap: 10 },
  panelLabel: { color: "#FFD9B8", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  panelText: { color: "#FFFFFF", fontSize: 22, lineHeight: 30, fontWeight: "800" },
  quote: { color: "#FFFFFF", fontSize: 18, lineHeight: 27, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#31547D", marginVertical: 4 },
  infoPanel: { borderWidth: 1, borderRadius: 20, padding: 17, gap: 6 },
  infoTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  infoText: { fontSize: 14, lineHeight: 21 },
  formArea: { gap: 12 },
  formLabel: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  input: { minHeight: 116, borderWidth: 1, borderRadius: 18, padding: 15, fontSize: 16, lineHeight: 23, textAlignVertical: "top" },
  perspectiveNote: { fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, borderRadius: 18, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  receipt: { borderWidth: 1, borderRadius: 24, padding: 22, gap: 10, alignItems: "center" },
  receiptTitle: { fontSize: 22, lineHeight: 29, fontWeight: "800" },
  receiptText: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  reflection: { width: "100%", fontSize: 15, lineHeight: 23, fontWeight: "600", textAlign: "center", marginVertical: 4 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
