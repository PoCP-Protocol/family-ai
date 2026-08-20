import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getGrowthFocus } from "@/lib/family/core-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { getJourneyWeeklyAction } from "@/lib/family/journey-plan-content";

interface ServiceJourney {
  state?: string;
  process_summary?: { label?: string; completed_actions?: number };
  next_hint?: { text?: string };
  service_cards?: { service_ref: string; label: string; state: string }[];
}

export default function CompanionJourneyScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { selectedGrowthFocus, activeOnboardingId, lastReceipt, campCompletedDays } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const [remote, setRemote] = useState<ServiceJourney | null>(null);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !activeOnboardingId) return;
    let active = true;
    familyApi.getServiceJourney<ServiceJourney>(session.token, session.selectedFamily.family_id, activeOnboardingId)
      .then((result) => { if (active) setRemote(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token]);

  const completedActions = remote?.process_summary?.completed_actions ?? (lastReceipt ? 1 : 0) + campCompletedDays.length;
  const weeklyAction = remote?.next_hint?.text ?? getJourneyWeeklyAction(selectedGrowthFocus);

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "90 天陪跑", headerBackTitle: "返回" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.tint }]}>UI-05 · 本周陪跑</Text>
        <Text style={[styles.title, { color: colors.text }]}>{focus ? `${focus.title} · 从一个小行动开始` : "从一个小行动开始"}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>陪跑提供节奏、提醒和回顾，不评价家庭好坏，也不要求连续完美。</Text>
        <DataSourceBanner />

        <View style={[styles.weekPanel, { backgroundColor: "#09295A" }]}>
          <View style={styles.weekTopline}>
            <Text style={styles.weekLabel}>本周一件事</Text>
            <Text style={styles.weekCount}>已记录 {completedActions} 次行动</Text>
          </View>
          <Text style={styles.weekAction}>{weeklyAction}</Text>
          <Pressable onPress={() => router.push("/ui/UI-09" as Href)} style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}>
            <Text style={styles.inlineButtonText}>打开今日任务</Text>
            <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>本周陪伴节奏</Text>
        <CadenceRow number="1" title="选择行动" detail="只选一个 5–15 分钟的小行动。" color="#2563EB" />
        <CadenceRow number="2" title="记录发生" detail="完成、跳过和恢复都可以如实记录。" color="#16866D" />
        <CadenceRow number="3" title="家庭回顾" detail="回看什么有帮助，再决定继续或调整。" color="#F28C45" />

        <View style={[styles.servicePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.serviceTitle, { color: colors.text }]}>陪伴支持</Text>
          <Text style={[styles.serviceText, { color: colors.muted }]}>{remote?.process_summary?.label ?? "当前提供家庭私有回顾、温和提醒和服务入口。"}</Text>
          <Pressable onPress={() => router.push("/ui/UI-06" as Href)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
            <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>查看我的陪伴服务</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/ui/UI-08" as Href)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>进入阶段回顾</Text>
          <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function CadenceRow({ number, title, detail, color }: { number: string; title: string; detail: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.cadenceRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cadenceNumber, { backgroundColor: `${color}18` }]}><Text style={[styles.cadenceNumberText, { color }]}>{number}</Text></View>
      <View style={styles.cadenceCopy}>
        <Text style={[styles.cadenceTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cadenceDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 14 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  weekPanel: { borderRadius: 26, padding: 20, gap: 12 },
  weekTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  weekLabel: { color: "#FFD9B8", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  weekCount: { color: "#BFD3EC", fontSize: 12, lineHeight: 17 },
  weekAction: { color: "#FFFFFF", fontSize: 22, lineHeight: 30, fontWeight: "800" },
  inlineButton: { minHeight: 48, borderRadius: 15, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  inlineButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  cadenceRow: { minHeight: 78, borderWidth: 1, borderRadius: 19, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  cadenceNumber: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cadenceNumberText: { fontSize: 16, lineHeight: 21, fontWeight: "900" },
  cadenceCopy: { flex: 1, gap: 3 },
  cadenceTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  cadenceDetail: { fontSize: 13, lineHeight: 19 },
  servicePanel: { borderWidth: 1, borderRadius: 22, padding: 18, gap: 8 },
  serviceTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  serviceText: { fontSize: 14, lineHeight: 21 },
  secondaryButton: { minHeight: 48, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 3 },
  secondaryButtonText: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
