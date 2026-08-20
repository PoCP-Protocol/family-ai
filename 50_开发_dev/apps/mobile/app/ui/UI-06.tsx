import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { createMobileRequestId, familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { getUiActionPolicy } from "@/lib/family/ui-action-policies";
import { haptic } from "@/lib/haptics";

interface ServiceJourney {
  state?: string;
  visibility?: string;
  service_cards?: { service_ref: string; label: string; state: "READ_ONLY" | "HOLD" }[];
  process_summary?: { label?: string; completed_actions?: number };
  private_feed?: { entry_id: string; kind: string; text: string }[];
  next_hint?: { text?: string };
}

const LOCAL_SERVICES = [
  { service_ref: "FAMILY_COMPANION", label: "家庭陪伴说明", state: "READ_ONLY" as const },
  { service_ref: "WEEKLY_REVIEW", label: "本周回顾入口", state: "READ_ONLY" as const },
  { service_ref: "AI_REMINDER", label: "温和提醒", state: "READ_ONLY" as const },
  { service_ref: "EXPERT_LIVE", label: "专家答疑", state: "HOLD" as const },
];

export default function CompanionServiceScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { activeOnboardingId, recordUiAction, uiActionReceipts } = useFamilyMobile();
  const [remote, setRemote] = useState<ServiceJourney | null>(null);
  const [saving, setSaving] = useState(false);
  const localReceipt = uiActionReceipts.find((item) => item.screenId === "UI-06");
  const services = remote?.service_cards ?? LOCAL_SERVICES;

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !activeOnboardingId) return;
    let active = true;
    familyApi.getServiceJourney<ServiceJourney>(session.token, session.selectedFamily.family_id, activeOnboardingId)
      .then((result) => { if (active) setRemote(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token]);

  const savePrivateDraft = async () => {
    const policy = getUiActionPolicy("UI-06");
    if (!policy) return;
    setSaving(true);
    if (session.status === "connected" && session.token && session.selectedFamily && activeOnboardingId) {
      await familyApi.createPrivateCheckinDraft(
        session.token,
        session.selectedFamily.family_id,
        activeOnboardingId,
        "WEEKLY_ACTION_SEE",
        createMobileRequestId("ui06-private-checkin"),
      ).catch(() => undefined);
    }
    recordUiAction(policy, "家庭已留下一个本周私有打卡草稿");
    setSaving(false);
    haptic.success();
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "我的陪伴服务", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={services}
        keyExtractor={(item) => item.service_ref}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.tint }]}>家庭私有旅程</Text>
            <Text style={[styles.title, { color: colors.text }]}>陪伴服务与家庭记录</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>这里展示服务入口和过程记录。专家、提醒和线下服务只有确认发生后才会成为服务记录。</Text>
            <DataSourceBanner />
            <View style={[styles.processPanel, { backgroundColor: "#09295A" }]}>
              <Text style={styles.processLabel}>当前过程</Text>
              <Text style={styles.processTitle}>{remote?.process_summary?.label ?? "从本周的一件小行动开始"}</Text>
              <Text style={styles.processText}>家庭私有 · 过程记录 · 不是分数或成长结果</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>可用服务</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.serviceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.serviceIcon, { backgroundColor: item.state === "HOLD" ? "#F28C4518" : "#16866D18" }]}>
              <IconSymbol name={item.state === "HOLD" ? "pause.circle.fill" : "checkmark.circle.fill"} size={24} color={item.state === "HOLD" ? colors.warning : colors.success} />
            </View>
            <View style={styles.serviceCopy}>
              <Text style={[styles.serviceTitle, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.serviceState, { color: colors.muted }]}>{item.state === "HOLD" ? "需要家庭确认后再安排" : "可查看"}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={[styles.hintPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.hintTitle, { color: colors.text }]}>本周回顾提示</Text>
              <Text style={[styles.hintText, { color: colors.muted }]}>{remote?.next_hint?.text ?? "哪一次表达让你们更容易继续对话？"}</Text>
            </View>
            {localReceipt ? <Text style={[styles.receipt, { color: colors.success }]}>{localReceipt.message}</Text> : null}
            <Pressable onPress={() => { void savePrivateDraft(); }} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{saving ? "正在保存" : "留下本周私有打卡草稿"}</Text>
            </Pressable>
            <Text style={[styles.boundary, { color: colors.muted }]}>草稿不会公开发布，也不会自动变成服务记录或成长结果。</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 12 },
  header: { gap: 15, marginBottom: 4 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  processPanel: { borderRadius: 24, padding: 19, gap: 6 },
  processLabel: { color: "#67D5FF", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  processTitle: { color: "#FFFFFF", fontSize: 20, lineHeight: 27, fontWeight: "800" },
  processText: { color: "#C4D7EE", fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  serviceRow: { minHeight: 78, borderWidth: 1, borderRadius: 19, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  serviceIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  serviceCopy: { flex: 1, gap: 3 },
  serviceTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  serviceState: { fontSize: 13, lineHeight: 18 },
  footer: { gap: 11, paddingTop: 10 },
  hintPanel: { borderWidth: 1, borderRadius: 20, padding: 17, gap: 6 },
  hintTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  hintText: { fontSize: 14, lineHeight: 21 },
  receipt: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  primaryButton: { minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "800" },
  boundary: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
