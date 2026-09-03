import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

interface RemoteTodayAction {
  action_id?: string;
  journey_plan_id?: string | null;
  journey_phase?: string | null;
  day_index?: number;
  assignment_text?: string;
  boundary?: string;
}

interface RemoteInterventionLibrary { items?: Array<{ review_status?: string; intervention?: { intervention_code?: string } }>; }
interface RemoteContextResolution { consent?: { allowed?: boolean }; action_bridge_status?: string; }

export default function DailyTaskScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { todayAction, lastReceipt, activeCampDay, campCompletedDays, startAction, completeAction, skipAction } = useFamilyMobile();
  const [reflection, setReflection] = useState(lastReceipt?.actionId === todayAction.id ? lastReceipt.reflection : "");
  const [remoteAction, setRemoteAction] = useState<RemoteTodayAction | null>(null);
  const [reviewedContentConnected, setReviewedContentConnected] = useState(false);
  const [contextResolution, setContextResolution] = useState<RemoteContextResolution | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "submitting">("idle");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const isComplete = todayAction.status === "checked_in";
  const isStarted = todayAction.status === "in_progress";
  const progress = isComplete ? 78 : Math.max(28, Math.min(66, 28 + campCompletedDays.length * 4));

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    const familyId = session.selectedFamily.family_id;
    Promise.all([
      familyApi.getTodayGrowthAction<RemoteTodayAction | null>(session.token, familyId),
      familyApi.getActiveOnboarding(session.token, familyId),
      familyApi.getInterventionLibrary<RemoteInterventionLibrary>(session.token, familyId).catch(() => null),
    ]).then(async ([today, onboarding, interventionLibrary]) => {
      const context = typeof onboarding?.child_id === "string"
        ? await familyApi.resolveFamilyContext<RemoteContextResolution>(session.token!, familyId, onboarding.child_id, "GROWTH_GUIDANCE").catch(() => null)
        : null;
      if (!active) return;
      setRemoteAction(today);
      setReviewedContentConnected(Boolean(interventionLibrary?.items?.some((item) => item.review_status === "PUBLISHED")));
      setContextResolution(context);
    }).catch(() => { if (active) setSyncMessage("今天的计划任务暂时无法同步。") });
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const handlePrimary = async () => {
    if (!isStarted) { startAction(); haptic.light(); return; }
    if (syncState === "submitting") return;
    if (session.status === "connected" && session.token && session.selectedFamily) {
      if (!remoteAction?.action_id || !remoteAction.journey_plan_id) { setSyncMessage("当前还没有可完成的计划任务，请回到成长方案后再试。"); return; }
      setSyncState("submitting"); setSyncMessage(null);
      try {
        await familyApi.checkInTodayTask(session.token, session.selectedFamily.family_id, remoteAction.action_id, { completion_status: "COMPLETED", reflection, occurred_at: new Date().toISOString() }, `ui09-checkin-${remoteAction.action_id}`);
      } catch { setSyncState("idle"); setSyncMessage("暂时无法同步这次行动，请稍后重试。"); return; }
      setSyncState("idle");
    }
    completeAction(reflection); haptic.success();
  };

  const tasks = [
    { id: "1", title: remoteAction?.assignment_text ?? todayAction.title, detail: todayAction.reason, time: `${todayAction.estimatedMinutes}分钟`, checked: isComplete },
    { id: "2", title: "记录一次家庭互动", detail: "选择一个值得留意的家庭瞬间", time: "5分钟", checked: false },
    { id: "3", title: "完成专注力小游戏", detail: "轻松陪伴，一起完成一个小挑战", time: "10分钟", checked: false },
  ];

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><IconSymbol name="chevron.left" size={27} color="#24282D" /></Pressable><Text style={styles.topTitle}>今日成长任务</Text><View style={styles.moreCircle}><Text style={styles.moreText}>•••</Text></View></View>
        <View style={styles.reminder}><View style={styles.robot}><Text style={styles.robotFace}>◉‿◉</Text></View><View style={styles.reminderCopy}><Text style={styles.reminderTitle}>AI家庭管家提醒：</Text><Text style={styles.reminderMain}>今天建议完成 <Text style={styles.reminderNumber}>3</Text> 个成长动作</Text><Text style={styles.reminderHint}>{activeCampDay ? `21 天成长营 · Day ${activeCampDay}` : "坚持每日完成，孩子会更有收获！"}</Text></View></View>
        {remoteAction?.journey_plan_id ? <Text style={styles.planLink}>已关联当前成长计划 · {remoteAction.journey_phase ?? "当前阶段"} · Day {remoteAction.day_index ?? 1}</Text> : null}
        <Text style={styles.sourceLine}>内容来源：{reviewedContentConnected ? "已审核家庭练习库" : "家庭计划规则"} · {contextResolution?.consent?.allowed ? "成长使用同意已确认" : "按最小必要信息运行"} · 完成仅记录行动</Text>
        {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}

        <View style={styles.tasks}>{tasks.map((task) => <TaskCard key={task.id} number={task.id} title={task.title} detail={task.detail} time={task.time} checked={task.checked} />)}</View>
        <View style={styles.progressCard}><View style={styles.progressSide}><Text style={styles.progressLabel}>本周完成度</Text><View style={styles.progressNumberRow}><Text style={styles.progressNumber}>{progress}%</Text><View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View></View></View><View style={styles.streakSide}><Text style={styles.progressLabel}>连续打卡</Text><Text style={styles.streakNumber}>{Math.max(1, campCompletedDays.length || (isComplete ? 12 : 1))}<Text style={styles.streakUnit}> 天</Text></Text></View></View>

        {!isComplete && isStarted ? <View style={styles.reflectionPanel}><Text style={[styles.reflectionLabel, { color: colors.text }]}>完成后，记下一句话（可选）</Text><TextInput accessibilityLabel="家长反思" multiline returnKeyType="done" value={reflection} onChangeText={setReflection} placeholder="例如：我先停下来听完了。" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /><Text style={[styles.perspective, { color: colors.muted }]}>这段记录是你的视角，不会被当作孩子的事实或教育结果。</Text></View> : null}

        {isComplete ? <View style={styles.receipt}><IconSymbol name="checkmark.circle.fill" size={25} color="#1A8A67" /><Text style={styles.receiptText}>今天的行动已记录；它不代表已经产生教育效果。</Text></View> : null}
        <Pressable disabled={syncState === "submitting"} onPress={handlePrimary} style={({ pressed }) => [styles.completeButton, (pressed || syncState === "submitting") && styles.pressed]}><Text style={styles.completeText}>{syncState === "submitting" ? "正在同步行动" : isStarted ? "完成今日任务" : "开始今日任务"}</Text></Pressable>
        {!isComplete ? <Pressable onPress={() => { skipAction(); haptic.selection(); }} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}><Text style={[styles.skipText, { color: colors.muted }]}>今天不适合，先跳过</Text></Pressable> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function TaskCard({ number, title, detail, time, checked }: { number: string; title: string; detail: string; time: string; checked: boolean }) { return <View style={[styles.taskCard, checked && styles.taskComplete]}><View style={styles.taskNumber}><Text style={styles.taskNumberText}>{number}</Text></View><View style={styles.taskCopy}><Text style={styles.taskTitle} numberOfLines={1}>{title}</Text><Text style={styles.taskDetail} numberOfLines={1}>{detail}</Text><View style={styles.taskMeta}><Text style={styles.recordHint}>过程记录</Text><Text style={styles.time}>{time}</Text></View></View><View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.check}>✓</Text> : null}</View></View>; }

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 27, backgroundColor: "#FFFFFF" }, topBar: { minHeight: 61, alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, backButton: { width: 42, height: 42, alignItems: "flex-start", justifyContent: "center" }, topTitle: { color: "#22272D", fontSize: 19, lineHeight: 26, fontWeight: "900" }, moreCircle: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: "#2B3036", alignItems: "center", justifyContent: "center" }, moreText: { color: "#2B3036", fontSize: 11, lineHeight: 11, fontWeight: "900", letterSpacing: -1 },
  reminder: { minHeight: 132, borderRadius: 18, paddingHorizontal: 17, backgroundColor: "#1479F4", flexDirection: "row", alignItems: "center", overflow: "hidden" }, robot: { width: 80, height: 80, borderRadius: 30, marginRight: 12, backgroundColor: "#BFE0FF", borderWidth: 5, borderColor: "#F5FBFF", justifyContent: "center", alignItems: "center" }, robotFace: { color: "#126EE4", fontSize: 19, lineHeight: 22, fontWeight: "900" }, reminderCopy: { flex: 1, gap: 3 }, reminderTitle: { color: "#E8F4FF", fontSize: 17, lineHeight: 22, fontWeight: "900" }, reminderMain: { color: "#FFFFFF", fontSize: 18, lineHeight: 25, fontWeight: "900" }, reminderNumber: { color: "#FFE071", fontSize: 28, lineHeight: 30 }, reminderHint: { color: "#D9ECFF", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  tasks: { gap: 11, marginTop: 13 }, taskCard: { minHeight: 113, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 19, borderWidth: 1.5, borderColor: "#E3EAF2", flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF" }, taskComplete: { backgroundColor: "#F2FBF7", borderColor: "#9EDCC4" }, taskNumber: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#2E8BEE", alignItems: "center", justifyContent: "center" }, taskNumberText: { color: "#FFFFFF", fontSize: 23, lineHeight: 27, fontWeight: "900" }, taskCopy: { flex: 1, marginLeft: 13, gap: 3 }, taskTitle: { color: "#343940", fontSize: 17, lineHeight: 23, fontWeight: "900" }, taskDetail: { color: "#68727D", fontSize: 12, lineHeight: 18, fontWeight: "700" }, taskMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, recordHint: { color: "#F29B30", fontSize: 12, lineHeight: 17, fontWeight: "900" }, time: { color: "#3A85E8", fontSize: 12, lineHeight: 17, fontWeight: "900" }, checkbox: { width: 30, height: 30, borderRadius: 7, borderWidth: 2, borderColor: "#91BDF4", marginLeft: 8, alignItems: "center", justifyContent: "center" }, checkboxChecked: { backgroundColor: "#2D8CEF", borderColor: "#2D8CEF" }, check: { color: "#FFFFFF", fontSize: 18, lineHeight: 20, fontWeight: "900" },
  progressCard: { minHeight: 104, marginTop: 15, borderRadius: 17, borderWidth: 1.5, borderColor: "#E3EAF2", flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF" }, progressSide: { flex: 1.55, paddingLeft: 19 }, streakSide: { flex: 1, paddingLeft: 17, borderLeftWidth: 1, borderLeftColor: "#D9E3ED" }, progressLabel: { color: "#3D444C", fontSize: 15, lineHeight: 21, fontWeight: "900" }, progressNumberRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 11 }, progressNumber: { color: "#237FEF", fontSize: 29, lineHeight: 35, fontWeight: "900" }, track: { flex: 1, height: 7, borderRadius: 4, marginRight: 16, backgroundColor: "#DDE9FA", overflow: "hidden" }, fill: { height: 7, borderRadius: 4, backgroundColor: "#237FEF" }, streakNumber: { color: "#237FEF", fontSize: 29, lineHeight: 35, fontWeight: "900", marginTop: 6 }, streakUnit: { fontSize: 14 },
  planLink: { marginTop: 10, color: "#476A92", fontSize: 12, lineHeight: 17, fontWeight: "800" }, sourceLine: { marginTop: 4, color: "#6D7885", fontSize: 10, lineHeight: 15, fontWeight: "600" }, syncMessage: { marginTop: 8, color: "#8B6643", fontSize: 12, lineHeight: 17, fontWeight: "700" }, reflectionPanel: { marginTop: 13, gap: 7 }, reflectionLabel: { fontSize: 14, lineHeight: 20, fontWeight: "800" }, input: { minHeight: 89, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 20, textAlignVertical: "top" }, perspective: { fontSize: 11, lineHeight: 16 }, receipt: { minHeight: 52, marginTop: 13, borderRadius: 13, paddingHorizontal: 12, backgroundColor: "#EEF9F3", flexDirection: "row", alignItems: "center", gap: 8 }, receiptText: { flex: 1, color: "#416A5B", fontSize: 12, lineHeight: 17, fontWeight: "700" }, completeButton: { minHeight: 65, marginTop: 15, borderRadius: 33, backgroundColor: "#187AF2", alignItems: "center", justifyContent: "center" }, completeText: { color: "#FFFFFF", fontSize: 20, lineHeight: 27, fontWeight: "900" }, skipButton: { minHeight: 40, alignItems: "center", justifyContent: "center" }, skipText: { fontSize: 13, lineHeight: 18, fontWeight: "700" }, pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
});
