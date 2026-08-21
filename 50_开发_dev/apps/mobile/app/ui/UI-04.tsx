import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { MOBILE_JOURNEY_PHASES, type MobileJourneyPhase } from "@/lib/family/journey-plan-content";
import { getUiActionPolicy } from "@/lib/family/ui-action-policies";
import { haptic } from "@/lib/haptics";

interface RemoteJourneyPlan {
  plan?: { status?: string; current_phase?: string; phases?: { phase: string; status: string }[] } | null;
}

interface RemotePlanPreview {
  structure?: { stages?: { stage_id: string; small_action: string }[] };
}

type BaselineWeek = {
  id: MobileJourneyPhase["id"];
  week: string;
  title: string;
  intent: string;
  tasks: readonly [string, string];
  tone: "mint" | "blue" | "orange" | "gray";
  illustration: string;
};

const BASELINE_WEEKS: readonly BaselineWeek[] = [
  { id: "SEE", week: "第1周", title: "关系破冰", intent: "建立信任，打开沟通通道", tasks: ["亲子时光15分钟", "倾听孩子的感受"], tone: "mint", illustration: "♥" },
  { id: "PARENT_FIRST", week: "第2周", title: "行为训练", intent: "减少冲突，正向引导行为", tasks: ["积极反馈练习", "制定家庭规则"], tone: "blue", illustration: "▣" },
  { id: "CO_CREATE", week: "第3周", title: "习惯建立", intent: "制定计划，培养好习惯", tasks: ["学习计划制定", "每日习惯打卡"], tone: "orange", illustration: "◎" },
  { id: "STABILIZE", week: "第4周", title: "情绪管理", intent: "识别情绪，科学表达", tasks: ["识别此刻的感受", "用一句话表达需要"], tone: "gray", illustration: "○" },
] as const;

function getPhaseStatus(plan: RemoteJourneyPlan["plan"], phaseId: string, currentPhase: string) {
  const remote = plan?.phases?.find((phase) => phase.phase === phaseId)?.status;
  if (remote === "COMPLETED") return "completed" as const;
  if (phaseId === currentPhase) return "active" as const;
  return "pending" as const;
}

export default function JourneyPlanScreen() {
  const session = useFamilyApiSession();
  const { activeOnboardingId, recordUiAction } = useFamilyMobile();
  const [remoteJourney, setRemoteJourney] = useState<RemoteJourneyPlan | null>(null);
  const [remotePreview, setRemotePreview] = useState<RemotePlanPreview | null>(null);

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
  const phases = useMemo(() => {
    const remoteStages = remotePreview?.structure?.stages ?? [];
    return BASELINE_WEEKS.map((week, index) => {
      const remote = remoteStages.find((stage) => stage.stage_id === week.id);
      const fallback = MOBILE_JOURNEY_PHASES[index];
      return { ...week, smallAction: remote?.small_action ?? fallback?.smallAction ?? week.tasks[0] };
    });
  }, [remotePreview]);

  const beginPlan = () => {
    const policy = getUiActionPolicy("UI-04");
    if (policy) recordUiAction(policy, "家庭已选择开始执行当前成长计划");
    haptic.success();
    router.push("/ui/UI-05" as Href);
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <FlatList
          refreshControl={<FamilyRefreshControl />}
          data={phases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <View style={styles.topBar}>
                <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
                  <IconSymbol name="chevron.left" size={27} color="#222222" />
                </Pressable>
                <Text style={styles.topTitle}>90天成长方案</Text>
                <View style={styles.topActions}><Text style={styles.moreText}>•••</Text><Text style={styles.circleText}>⊙</Text></View>
              </View>
              <Image source={require("@/assets/images/ui04-plan-summary-baseline.png")} resizeMode="contain" style={styles.summaryReference} accessibilityLabel="当前阶段、目标、累计时长、难度与计划统计" />
            </>
          }
          renderItem={({ item, index }) => {
            const status = getPhaseStatus(plan, item.id, currentPhase);
            const tone = toneStyles[item.tone];
            const statusLabel = status === "completed" ? "已完成" : status === "active" ? "进行中" : "未开始";
            return (
              <View style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: tone.dot }]} />
                  {index < phases.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: tone.line }]} /> : null}
                </View>
                <View style={[styles.weekCard, { backgroundColor: tone.surface, borderColor: tone.border }]}>
                  <View style={styles.weekHeader}>
                    <View style={[styles.weekBadge, { backgroundColor: tone.badge }]}><Text style={styles.weekBadgeText}>{item.week}</Text></View>
                    <Text style={styles.weekTitle}>{item.title}</Text>
                    <Text style={styles.weekStatus}>（{statusLabel}）</Text>
                  </View>
                  <Text style={styles.weekIntent}>{item.intent}</Text>
                  <View style={styles.weekBody}>
                    <View style={styles.taskList}>
                      {item.tasks.map((task, taskIndex) => {
                        const done = status === "completed" || (status === "active" && taskIndex === 0);
                        return (
                          <View key={task} style={styles.taskLine}>
                            <View style={[styles.taskBullet, { borderColor: tone.dot }]}><View style={[styles.taskBulletInner, { backgroundColor: done ? tone.dot : "transparent" }]} /></View>
                            <Text style={styles.taskText}>{task}</Text>
                            {done ? <IconSymbol name="checkmark.circle.fill" size={18} color={tone.dot} /> : <View style={[styles.emptyCheck, { borderColor: tone.dot }]} />}
                          </View>
                        );
                      })}
                    </View>
                    <View style={[styles.illustration, { backgroundColor: tone.art }]}><Text style={[styles.illustrationText, { color: tone.dot }]}>{item.illustration}</Text></View>
                  </View>
                  {status === "active" ? <Text style={[styles.currentAction, { color: tone.dot }]}>{item.smallAction}</Text> : null}
                </View>
              </View>
            );
          }}
        />
        <View style={styles.fixedFooter}>
          <Pressable onPress={beginPlan} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>开始执行计划</Text></Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const toneStyles = {
  mint: { surface: "#F1FCF7", border: "#CDEFE1", badge: "#19B785", dot: "#18AE76", line: "#90DFC2", art: "#DDF8EB" },
  blue: { surface: "#F0F6FF", border: "#D3E2FF", badge: "#317EED", dot: "#2F81F7", line: "#AFCBF9", art: "#DCEBFF" },
  orange: { surface: "#FFF8EB", border: "#F6E0BC", badge: "#F09C24", dot: "#F5A11E", line: "#F5CEA0", art: "#FFEECE" },
  gray: { surface: "#F7F8FA", border: "#E4E7EC", badge: "#9299A4", dot: "#A6ADB7", line: "#D4D8DE", art: "#EEF0F3" },
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingBottom: 106 },
  topBar: { minHeight: 64, paddingHorizontal: 18, alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  backButton: { width: 36, alignItems: "flex-start" },
  topTitle: { color: "#20242A", fontSize: 19, lineHeight: 26, fontWeight: "800" },
  topActions: { width: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moreText: { color: "#20242A", fontSize: 17, lineHeight: 19, fontWeight: "900", letterSpacing: 1 },
  circleText: { color: "#20242A", fontSize: 25, lineHeight: 25 },
  summaryReference: { alignSelf: "center", width: "100%", height: 222, marginTop: 2, marginBottom: 5 },
  timelineRow: { flexDirection: "row", paddingHorizontal: 18, minHeight: 164 },
  timelineRail: { width: 28, alignItems: "center" },
  timelineDot: { width: 11, height: 11, borderRadius: 6, marginTop: 17, zIndex: 1 },
  timelineLine: { position: "absolute", top: 28, width: 2, bottom: -3 },
  weekCard: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 12, marginBottom: 12 },
  weekHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  weekBadge: { borderRadius: 3, paddingHorizontal: 8, paddingTop: 3, paddingBottom: 3 },
  weekBadgeText: { color: "#FFFFFF", fontSize: 13, lineHeight: 17, fontWeight: "800" },
  weekTitle: { color: "#1D242D", fontSize: 18, lineHeight: 24, fontWeight: "900" },
  weekStatus: { color: "#8D96A3", fontSize: 12, lineHeight: 17 },
  weekIntent: { color: "#4E5B68", fontSize: 14, lineHeight: 21, fontWeight: "600", marginTop: 7 },
  weekBody: { flexDirection: "row", marginTop: 10, gap: 8 },
  taskList: { flex: 1, gap: 8, paddingTop: 2 },
  taskLine: { minHeight: 21, flexDirection: "row", alignItems: "center", gap: 7 },
  taskBullet: { width: 14, height: 14, borderWidth: 1.5, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  taskBulletInner: { width: 6, height: 6, borderRadius: 3 },
  taskText: { flex: 1, color: "#3D4854", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  emptyCheck: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5 },
  illustration: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  illustrationText: { fontSize: 37, lineHeight: 42, fontWeight: "900" },
  currentAction: { fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 9 },
  fixedFooter: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#FFFFFF", paddingHorizontal: 19, paddingTop: 11, paddingBottom: 13, borderTopWidth: 1, borderTopColor: "#F2F2F2" },
  primaryButton: { minHeight: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#FF8A1F" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 19, lineHeight: 26, fontWeight: "900" },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});
