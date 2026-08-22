import { router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { ProjectionStateCard } from "@/components/family/projection-state-card";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { UI01_HOME_TARGETS } from "@/lib/family/ui01-home-entry-map";

const assessmentBanner = require("@/assets/images/ui01/assessment-banner.png");
const recommendationLive = require("@/assets/images/ui01/recommendation-live.png");
const recommendationCourse = require("@/assets/images/ui01/recommendation-course.png");
const recommendationCase = require("@/assets/images/ui01/recommendation-case.png");

type HomeIcon = "heart.fill" | "gift.fill" | "calendar.fill" | "photo.fill" | "video.fill" | "headphones.fill" | "checkmark.circle.fill" | "book.fill";
type ExperienceState = "idle" | "loading" | "ready" | "error";

interface RemoteTodayAction { action_id?: string; assignment_text?: string; journey_plan_id?: string | null; journey_phase?: string | null; day_index?: number; }
interface RemoteJourneyPlan { plan?: { plan_id?: string; status?: string; current_phase?: string } | null; }
interface RemoteInterventionLibrary { items?: Array<{ review_status?: string; intervention?: { name_zh?: string } }>; }
interface RemoteServiceSupply { offerings?: Array<{ title?: string; availability_status?: string }>; live_session?: { title?: string; status?: string } | null; }
interface RemoteCommerceCatalog { products?: Array<{ title?: string; product_ref?: string }>; }

const QUICK_ENTRIES: readonly { label: string; icon: HomeIcon; color: string; target: Href }[] = [
  { label: "AI成长解读", icon: "heart.fill", color: "#35B9D7", target: `/ui/${UI01_HOME_TARGETS.aiInterpretation}` as Href },
  { label: "21天成长营", icon: "gift.fill", color: "#F59D34", target: `/ui/${UI01_HOME_TARGETS.camp21}` as Href },
  { label: "90天成长计划", icon: "calendar.fill", color: "#36A866", target: `/ui/${UI01_HOME_TARGETS.plan90}` as Href },
  { label: "成长故事", icon: "photo.fill", color: "#F0A337", target: `/ui/${UI01_HOME_TARGETS.growthStories}` as Href },
  { label: "专家支持", icon: "video.fill", color: "#55A6E9", target: `/ui/${UI01_HOME_TARGETS.expertLive}` as Href },
  { label: "家庭顾问", icon: "headphones.fill", color: "#EC725D", target: `/ui/${UI01_HOME_TARGETS.familyAdvisor}` as Href },
];

export default function TodayScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { todayAction } = useFamilyMobile();
  const [experienceState, setExperienceState] = useState<ExperienceState>("idle");
  const [experienceMessage, setExperienceMessage] = useState<string | null>(null);
  const [remoteToday, setRemoteToday] = useState<RemoteTodayAction | null>(null);
  const [remoteJourney, setRemoteJourney] = useState<RemoteJourneyPlan | null>(null);
  const [library, setLibrary] = useState<RemoteInterventionLibrary | null>(null);
  const [serviceSupply, setServiceSupply] = useState<RemoteServiceSupply | null>(null);
  const [commerceCatalog, setCommerceCatalog] = useState<RemoteCommerceCatalog | null>(null);

  const loadExperience = useCallback(async () => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) {
      setExperienceState("idle");
      setExperienceMessage("连接家庭账户后，可查看今天的行动、计划与服务安排。");
      return;
    }
    setExperienceState("loading");
    setExperienceMessage(null);
    try {
      const familyId = session.selectedFamily.family_id;
      const [today, journey, interventions, services, products] = await Promise.all([
        familyApi.getTodayGrowthAction<RemoteTodayAction | null>(session.token, familyId),
        familyApi.getJourneyPlan<RemoteJourneyPlan>(session.token, familyId),
        familyApi.getInterventionLibrary<RemoteInterventionLibrary>(session.token, familyId).catch(() => null),
        familyApi.getServiceOfferings<RemoteServiceSupply>(session.token, familyId, {}).catch(() => null),
        familyApi.getCommerceProducts<RemoteCommerceCatalog>(session.token, familyId).catch(() => null),
      ]);
      setRemoteToday(today);
      setRemoteJourney(journey);
      setLibrary(interventions);
      setServiceSupply(services);
      setCommerceCatalog(products);
      setExperienceState("ready");
    } catch {
      setExperienceState("error");
      setExperienceMessage("暂时无法同步家庭成长安排。你仍可从测评、计划或专家支持继续探索。");
    }
  }, [session.selectedFamily, session.status, session.token]);

  useEffect(() => { void loadExperience(); }, [loadExperience]);

  const open = (target: Href) => router.push(target);
  const communicationDone = todayAction.status === "checked_in";
  const publishedInterventions = useMemo(() => library?.items?.filter((item) => item.review_status === "PUBLISHED") ?? [], [library]);
  const plan = remoteJourney?.plan;
  const primaryTask = remoteToday?.assignment_text ?? todayAction.title;
  const tasks = [
    { label: primaryTask, icon: "checkmark.circle.fill" as const, color: "#39AC7A", done: communicationDone, target: `/ui/${UI01_HOME_TARGETS.dailyTasks}` as Href },
    { label: plan?.plan_id ? `当前计划 · ${plan.current_phase ?? "正在准备下一步"}` : "建立一段90天成长计划", icon: "calendar.fill" as const, color: "#4D90E8", done: Boolean(plan?.plan_id), target: `/ui/${UI01_HOME_TARGETS.plan90}` as Href },
    { label: publishedInterventions.length > 0 ? `已准备 ${publishedInterventions.length} 项家庭练习` : "先完成家庭测评，获得下一步建议", icon: "book.fill" as const, color: "#F1A136", done: publishedInterventions.length > 0, target: `/ui/${publishedInterventions.length > 0 ? UI01_HOME_TARGETS.aiInterpretation : UI01_HOME_TARGETS.freeAssessment}` as Href },
  ];
  const recommendations = [
    { title: serviceSupply?.live_session?.title ?? serviceSupply?.offerings?.[0]?.title ?? "查看专家支持与咨询准备", image: recommendationLive, target: `/ui/${UI01_HOME_TARGETS.expertLive}` as Href, label: "专家支持" },
    { title: publishedInterventions[0]?.intervention?.name_zh ?? "查看已审核家庭练习", image: recommendationCourse, target: `/ui/${UI01_HOME_TARGETS.aiInterpretation}` as Href, label: "成长练习" },
    { title: commerceCatalog?.products?.[0]?.title ?? "查看家庭可用权益与课程", image: recommendationCase, target: "/ui/UI-13" as Href, label: "课程与权益" },
  ];

  return (
    <ScreenContainer containerClassName="bg-surface">
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={[]}
        renderItem={null}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.page}>
            <View style={styles.topBar}>
              <Text style={[styles.platformTitle, { color: colors.text }]}>家庭成长平台</Text>
              <View style={styles.topActions}><IconSymbol name="ellipsis" size={25} color={colors.text} /><IconSymbol name="bell.fill" size={22} color={colors.text} /></View>
            </View>
            <View style={styles.welcomeRow}><Text style={[styles.welcome, { color: colors.text }]}>早上好，{"\n"}今天也一起陪孩子成长</Text><Text style={[styles.statusHint, { color: colors.muted }]}>{plan?.plan_id ? "计划进行中" : "从一件小事开始"}</Text></View>

            <Pressable accessibilityRole="button" accessibilityLabel="免费家庭测评" onPress={() => open(`/ui/${UI01_HOME_TARGETS.freeAssessment}` as Href)} style={({ pressed }) => [styles.assessmentBanner, pressed && styles.pressed]}><Image source={assessmentBanner} resizeMode="cover" style={styles.assessmentImage} /></Pressable>

            {experienceState === "loading" ? <ProjectionStateCard compact state="loading" title="正在整理今天的家庭成长安排" detail="计划、行动和已审核内容会在同步后显示。" /> : null}
            {experienceState === "error" ? <ProjectionStateCard compact state="error" title="暂时无法同步家庭安排" detail={experienceMessage ?? "请检查连接后重试。"} onRetry={() => { void loadExperience(); }} /> : null}
            {experienceState === "idle" && experienceMessage ? <ProjectionStateCard compact state="fallback" title="从家庭测评开始" detail={experienceMessage} onRetry={() => open(`/ui/${UI01_HOME_TARGETS.freeAssessment}` as Href)} retryLabel="开始测评" /> : null}

            <View style={[styles.quickGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>{QUICK_ENTRIES.map((entry) => <Pressable key={entry.label} accessibilityRole="button" accessibilityLabel={entry.label} onPress={() => open(entry.target)} style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}><IconSymbol name={entry.icon} size={29} color={entry.color} /><Text style={[styles.quickLabel, { color: colors.text }]}>{entry.label}</Text></Pressable>)}</View>

            <SectionTitle title="今日成长任务" action="查看全部" onPress={() => open(`/ui/${UI01_HOME_TARGETS.dailyTasks}` as Href)} colors={colors} />
            <View style={[styles.taskList, { backgroundColor: colors.surface, borderColor: colors.border }]}>{tasks.map((task, index) => <Pressable key={task.label} accessibilityRole="button" accessibilityLabel={task.label} onPress={() => open(task.target)} style={({ pressed }) => [styles.taskRow, index < tasks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, pressed && styles.pressed]}><IconSymbol name={task.icon} size={21} color={task.color} /><Text style={[styles.taskLabel, { color: colors.text }]} numberOfLines={1}>{task.label}</Text>{task.done ? <IconSymbol name="checkmark.circle.fill" size={22} color="#32B276" /> : <Text style={[styles.completePill, { color: colors.tint, borderColor: `${colors.tint}55` }]}>去看看</Text>}</Pressable>)}</View>

            <SectionTitle title="为你准备" action="更多" onPress={() => open(`/ui/${UI01_HOME_TARGETS.recommendations}` as Href)} colors={colors} />
            <View style={styles.recommendationRow}>{recommendations.map((item) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`查看${item.label}`} onPress={() => open(item.target)} style={({ pressed }) => [styles.recommendationCard, pressed && styles.pressed]}><Image source={item.image} resizeMode="cover" style={styles.recommendationImage} /><View style={styles.recommendationOverlay}><Text style={styles.recommendationLabel}>{item.label}</Text><Text style={styles.recommendationTitle} numberOfLines={2}>{item.title}</Text></View></Pressable>)}</View>
            <Text style={[styles.boundary, { color: colors.muted }]}>今天的安排来自家庭计划、已审核内容与服务目录；完成行动只会记录过程，不代表已经产生教育结果。</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function SectionTitle({ title, action, onPress, colors }: { title: string; action: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.sectionTopline}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}><Text style={[styles.moreText, { color: colors.muted }]}>{action}</Text><IconSymbol name="chevron.right" size={17} color={colors.muted} /></Pressable></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 }, page: { gap: 14 }, topBar: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, platformTitle: { fontSize: 22, lineHeight: 29, fontWeight: "900" }, topActions: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 4 }, welcomeRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 2 }, welcome: { flex: 1, fontSize: 23, lineHeight: 31, fontWeight: "900" }, statusHint: { fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 8 }, assessmentBanner: { height: 110, borderRadius: 17, overflow: "hidden" }, assessmentImage: { width: "100%", height: "100%" }, quickGrid: { borderWidth: 1, borderRadius: 17, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" }, quickEntry: { width: "33.333%", minHeight: 94, alignItems: "center", justifyContent: "center", gap: 7, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#EDF1F5" }, quickLabel: { fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" }, sectionTopline: { marginTop: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: "900" }, moreButton: { flexDirection: "row", alignItems: "center", gap: 1, minHeight: 32, paddingLeft: 8 }, moreText: { fontSize: 13, lineHeight: 18, fontWeight: "700" }, taskList: { borderWidth: 1, borderRadius: 16, overflow: "hidden" }, taskRow: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 }, taskLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" }, completePill: { minWidth: 62, minHeight: 28, borderWidth: 1, borderRadius: 14, textAlign: "center", textAlignVertical: "center", fontSize: 12, lineHeight: 26, fontWeight: "800" }, recommendationRow: { flexDirection: "row", gap: 9 }, recommendationCard: { flex: 1, height: 132, borderRadius: 12, overflow: "hidden", backgroundColor: "#E6ECF3" }, recommendationImage: { width: "100%", height: "100%" }, recommendationOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 57, paddingHorizontal: 8, paddingTop: 6, backgroundColor: "rgba(9,41,90,0.78)" }, recommendationLabel: { color: "#D9EDFF", fontSize: 10, lineHeight: 13, fontWeight: "800" }, recommendationTitle: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "800" }, boundary: { fontSize: 11, lineHeight: 16, fontWeight: "600" }, pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
