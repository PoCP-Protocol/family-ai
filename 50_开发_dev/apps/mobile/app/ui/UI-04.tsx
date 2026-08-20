import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getGrowthFocus } from "@/lib/family/core-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { MOBILE_JOURNEY_PHASES, getJourneyWeeklyAction, type MobileJourneyPhase } from "@/lib/family/journey-plan-content";
import { getUiActionPolicy } from "@/lib/family/ui-action-policies";
import { haptic } from "@/lib/haptics";

interface RemoteJourneyPlan {
  plan?: {
    title?: string;
    status?: string;
    current_phase?: string;
    current_day?: number;
    total_days?: number;
    phases?: { phase: string; start_day: number; end_day: number; status: string }[];
  } | null;
}

interface RemotePlanPreview {
  state?: string;
  focus?: { label?: string } | null;
  structure?: { horizon_days?: number; stages?: { stage_id: string; label: string; weeks: string; intent: string; small_action: string }[] };
  next_action?: { text?: string } | null;
  next_allowed_action?: string;
}

export default function JourneyPlanScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { selectedGrowthFocus, activeOnboardingId, recordUiAction, uiActionReceipts } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const [remoteJourney, setRemoteJourney] = useState<RemoteJourneyPlan | null>(null);
  const [remotePreview, setRemotePreview] = useState<RemotePlanPreview | null>(null);
  const localDecision = uiActionReceipts.find((item) => item.screenId === "UI-04");

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    familyApi.getJourneyPlan<RemoteJourneyPlan>(session.token, session.selectedFamily.family_id)
      .then((result) => { if (active) setRemoteJourney(result); })
      .catch(() => undefined);
    if (activeOnboardingId) {
      familyApi.getPlanPreview<RemotePlanPreview>(session.token, session.selectedFamily.family_id, activeOnboardingId)
        .then((result) => { if (active) setRemotePreview(result); })
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token]);

  const plan = remoteJourney?.plan;
  const currentPhase = plan?.current_phase ?? "SEE";
  const currentDay = plan?.current_day ?? 1;
  const stages: MobileJourneyPhase[] = remotePreview?.structure?.stages?.length
    ? remotePreview.structure.stages.map((stage, index) => ({
      id: (stage.stage_id as MobileJourneyPhase["id"]) ?? MOBILE_JOURNEY_PHASES[index].id,
      label: stage.label,
      days: stage.weeks,
      intent: stage.intent,
      smallAction: stage.small_action,
    }))
    : [...MOBILE_JOURNEY_PHASES];

  const saveDecision = () => {
    const policy = getUiActionPolicy("UI-04");
    if (policy) recordUiAction(policy, "家庭已选择继续了解 90 天成长方案");
    haptic.success();
    router.push("/ui/UI-05" as Href);
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "90 天成长方案", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={stages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.tint }]}>家庭成长方案</Text>
            <Text style={[styles.title, { color: colors.text }]}>{plan?.title ?? `${focus?.title ?? "家庭成长"} 90 天方案`}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>计划提供节奏，不是儿童诊断或成长结果。每次阶段转换都由家庭回顾后决定。</Text>
            <DataSourceBanner />
            <View style={[styles.statusPanel, { backgroundColor: "#09295A" }]}>
              <View style={styles.statusTopline}>
                <Text style={styles.statusLabel}>{plan ? `正式计划 · ${plan.status}` : "家庭审阅草稿"}</Text>
                <Text style={styles.statusDay}>Day {currentDay}/90</Text>
              </View>
              <Text style={styles.statusTitle}>{stages.find((item) => item.id === currentPhase)?.label ?? "看见与理解"}</Text>
              <Text style={styles.statusText}>{remotePreview?.next_action?.text ?? getJourneyWeeklyAction(selectedGrowthFocus)}</Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>四个阶段</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const active = item.id === currentPhase;
          const completed = plan?.phases?.find((phase) => phase.phase === item.id)?.status === "COMPLETED";
          return (
            <View style={[styles.phaseRow, { backgroundColor: colors.surface, borderColor: active ? colors.tint : colors.border }]}>
              <View style={[styles.phaseNumber, { backgroundColor: active ? colors.tint : colors.background }]}>
                <Text style={[styles.phaseNumberText, { color: active ? "#FFFFFF" : colors.tint }]}>{index + 1}</Text>
              </View>
              <View style={styles.phaseCopy}>
                <View style={styles.phaseTopline}>
                  <Text style={[styles.phaseTitle, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.phaseDays, { color: colors.muted }]}>{item.days}</Text>
                </View>
                <Text style={[styles.phaseIntent, { color: colors.muted }]}>{item.intent}</Text>
                <Text style={[styles.phaseAction, { color: colors.tint }]}>{item.smallAction}</Text>
              </View>
              {completed ? <IconSymbol name="checkmark.circle.fill" size={21} color={colors.success} /> : null}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {localDecision ? <Text style={[styles.receipt, { color: colors.success }]}>{localDecision.message}</Text> : null}
            <Pressable onPress={saveDecision} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>{plan?.status === "ACTIVE" ? "进入 90 天陪跑" : "确认了解，查看陪跑节奏"}</Text>
              <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.boundary, { color: colors.muted }]}>本机确认只保存方案选择，不会自动创建正式计划、会员或订单。</Text>
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
  statusPanel: { borderRadius: 25, padding: 20, gap: 8 },
  statusTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusLabel: { color: "#FFD9B8", fontSize: 12, lineHeight: 17, fontWeight: "800" },
  statusDay: { color: "#BFD3EC", fontSize: 12, lineHeight: 17 },
  statusTitle: { color: "#FFFFFF", fontSize: 23, lineHeight: 30, fontWeight: "800" },
  statusText: { color: "#D7E8FF", fontSize: 14, lineHeight: 21 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  phaseRow: { minHeight: 136, borderWidth: 1.5, borderRadius: 22, padding: 15, flexDirection: "row", gap: 13 },
  phaseNumber: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  phaseNumberText: { fontSize: 16, lineHeight: 21, fontWeight: "900" },
  phaseCopy: { flex: 1, gap: 5 },
  phaseTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  phaseTitle: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  phaseDays: { fontSize: 11, lineHeight: 16 },
  phaseIntent: { fontSize: 13, lineHeight: 20 },
  phaseAction: { fontSize: 12, lineHeight: 18, fontWeight: "700" },
  footer: { gap: 11, paddingTop: 10 },
  receipt: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  boundary: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
