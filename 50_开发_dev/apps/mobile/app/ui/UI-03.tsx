import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg";

import { ProjectionStateCard } from "@/components/family/projection-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { GROWTH_FOCUSES, getGrowthFocus } from "@/lib/family/core-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { getLocalGrowthExplanation } from "@/lib/family/growth-explanations";

interface RemoteExplanation {
  recommendations?: { text: string; source: string; status: string }[];
}

const RADAR_LABELS = ["亲子沟通", "学习习惯", "情绪调节", "自我管理", "手机与边界"] as const;
const RADAR_POINTS = [
  { x: 120, y: 22, labelX: 120, labelY: 12, anchor: "middle" as const },
  { x: 190, y: 73, labelX: 211, labelY: 66, anchor: "start" as const },
  { x: 164, y: 157, labelX: 184, labelY: 176, anchor: "start" as const },
  { x: 76, y: 157, labelX: 56, labelY: 176, anchor: "end" as const },
  { x: 50, y: 73, labelX: 29, labelY: 66, anchor: "end" as const },
] as const;

export default function GrowthExplanationScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { selectedGrowthFocus, activeOnboardingId, setActiveOnboardingId } = useFamilyMobile();
  const focus = getGrowthFocus(selectedGrowthFocus);
  const local = getLocalGrowthExplanation(selectedGrowthFocus);
  const [remote, setRemote] = useState<RemoteExplanation | null>(null);
  const [remoteState, setRemoteState] = useState<"idle" | "loading" | "ready" | "fallback">("idle");

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    setRemoteState("loading");
    familyApi.getActiveOnboarding(session.token, session.selectedFamily.family_id)
      .then(async (onboarding) => {
        const onboardingId = typeof onboarding?.onboarding_id === "string" ? onboarding.onboarding_id : activeOnboardingId;
        if (!onboardingId) throw new Error("NO_ACTIVE_ONBOARDING");
        if (active) setActiveOnboardingId(onboardingId);
        return familyApi.getReportExplanation<RemoteExplanation>(session.token!, session.selectedFamily!.family_id, onboardingId);
      })
      .then((result) => {
        if (!active) return;
        setRemote(result);
        setRemoteState("ready");
      })
      .catch(() => {
        if (active) setRemoteState("fallback");
      });
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token, setActiveOnboardingId]);

  const actionItems = useMemo(() => {
    if (!local) return [];
    return [
      remote?.recommendations?.[0]?.text ?? local.recommendation,
      local.fallback,
      `记录一次观察：${local.observationPrompt}`,
    ];
  }, [local, remote?.recommendations]);

  if (!focus || !local) {
    return (
      <ScreenContainer edges={["left", "right", "bottom"]}>
        <Stack.Screen options={{ headerShown: true, title: "家庭成长解读", headerBackTitle: "返回" }} />
        <View style={styles.emptyPage}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>先完成一次家庭测评</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>选择一个当前关注方向后，我们会按家庭的测评记录整理成长概览和下一步建议。</Text>
          <Pressable onPress={() => router.replace("/ui/UI-02" as Href)} style={[styles.primaryButton, { backgroundColor: colors.tint }]}>
            <Text style={styles.primaryButtonText}>进入家庭测评</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const selectedIndex = GROWTH_FOCUSES.findIndex((item) => item.id === focus.id);
  const issueTags = [focus.title, "家庭协作", "持续观察"];

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "家庭成长解读",
          headerBackTitle: "返回",
          headerRight: () => <IconSymbol name="ellipsis" size={24} color="#111827" />,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.assessmentSummary}>
          <View style={styles.summaryAvatar}><IconSymbol name="person.crop.circle.fill" size={56} color="#FFFFFF" /></View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>家庭成长测评</Text>
            <Text style={styles.summaryMeta}>当前关注：{focus.title}</Text>
            <Text style={styles.summaryMeta}>测评记录：已保存</Text>
            <Text style={styles.summaryBody}>本页依据家庭本次选择整理成长概览；家庭资料未补充时，不显示预置个人信息。</Text>
          </View>
          <IconSymbol name="chevron.right" size={19} color="#FFFFFF" />
        </View>

        {remoteState === "loading" || remoteState === "fallback" ? (
          <ProjectionStateCard
            compact
            state={remoteState === "loading" ? "loading" : "fallback"}
            title={remoteState === "loading" ? "正在整理成长解读" : "暂时使用家庭本机记录"}
            detail={remoteState === "loading" ? "成长概览会在家庭记录同步后更新。" : "你仍可查看当前概览并生成下一步成长方案。"}
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>综合成长评估</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>基于本次家庭选择</Text>
        </View>
        <GrowthRadarOverview selectedIndex={selectedIndex} focusTitle={focus.title} />
        <Text style={[styles.radarNote, { color: colors.muted }]}>五个方向用于帮助家庭组织观察；维度记录会随后续测评与行动逐步补充。</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>核心关注</Text>
        <View style={styles.tags}>
          {issueTags.map((tag, index) => (
            <View key={tag} style={[styles.tag, { backgroundColor: index === 0 ? "#FDEBEC" : index === 1 ? "#EEF2FF" : "#FFF3E5" }]}>
              <Text style={[styles.tagText, { color: index === 0 ? "#D96464" : index === 1 ? "#5B6FEF" : "#B87530" }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>成长建议</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>优先级从高到低</Text>
        </View>
        <View style={styles.suggestions}>
          {actionItems.map((item, index) => (
            <View key={`${index}-${item}`} style={styles.suggestionRow}>
              <View style={[styles.suggestionIndex, { backgroundColor: index === 0 ? "#EAF0FF" : "#F1F5FB" }]}><Text style={[styles.suggestionIndexText, { color: index === 0 ? colors.tint : colors.muted }]}>{index + 1}</Text></View>
              <Text style={[styles.suggestionText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => router.push("/ui/UI-04" as Href)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
          <IconSymbol name="star.fill" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>生成个性化成长方案</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function GrowthRadarOverview({ selectedIndex, focusTitle }: { selectedIndex: number; focusTitle: string }) {
  const colors = useColors();
  const outer = RADAR_POINTS.map((point) => `${point.x},${point.y}`).join(" ");
  const inner = RADAR_POINTS.map((point) => `${120 + (point.x - 120) * 0.58},${96 + (point.y - 96) * 0.58}`).join(" ");
  return (
    <View style={[styles.radarCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Svg width={240} height={196} viewBox="0 0 240 196" accessibilityLabel={`五维成长概览，当前关注${focusTitle}`}>
        <Polygon points={outer} fill="none" stroke="#B9D2F5" strokeWidth={1} />
        <Polygon points={inner} fill="none" stroke="#D7E7FB" strokeWidth={1} />
        {RADAR_POINTS.map((point, index) => <Line key={`axis-${RADAR_LABELS[index]}`} x1={120} y1={96} x2={point.x} y2={point.y} stroke="#D7E7FB" strokeWidth={1} />)}
        <Circle cx={120} cy={96} r={36} fill="#EAF3FF" />
        <Circle cx={120} cy={96} r={28} fill="#FFFFFF" stroke="#C8DEF8" strokeWidth={1} />
        <SvgText x={120} y={92} textAnchor="middle" fill="#2563EB" fontSize={12} fontWeight="700">成长概览</SvgText>
        <SvgText x={120} y={110} textAnchor="middle" fill="#6B7280" fontSize={10}>持续补充</SvgText>
        {RADAR_POINTS.map((point, index) => <Circle key={`point-${RADAR_LABELS[index]}`} cx={point.x} cy={point.y} r={index === selectedIndex ? 5 : 3} fill={index === selectedIndex ? "#2563EB" : "#B9D2F5"} />)}
        {RADAR_POINTS.map((point, index) => <SvgText key={`label-${RADAR_LABELS[index]}`} x={point.labelX} y={point.labelY} textAnchor={point.anchor} fill={index === selectedIndex ? "#2563EB" : "#5B6B7F"} fontSize={11} fontWeight={index === selectedIndex ? "700" : "500"}>{RADAR_LABELS[index]}</SvgText>)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 34, gap: 16, backgroundColor: "#FFFFFF" },
  emptyPage: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  emptyTitle: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  emptyText: { fontSize: 15, lineHeight: 23 },
  assessmentSummary: { minHeight: 132, borderRadius: 14, backgroundColor: "#2F8FFB", padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  summaryAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#77B8FF", alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { color: "#FFFFFF", fontSize: 17, lineHeight: 23, fontWeight: "800" },
  summaryMeta: { color: "#E8F3FF", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  summaryBody: { color: "#FFFFFF", fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { fontSize: 18, lineHeight: 25, fontWeight: "800" },
  sectionHint: { fontSize: 11, lineHeight: 16 },
  radarCard: { alignItems: "center", borderWidth: 1, borderRadius: 14, paddingTop: 10, paddingBottom: 4 },
  radarNote: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: -8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  tagText: { fontSize: 12, lineHeight: 17, fontWeight: "700" },
  suggestions: { gap: 12 },
  suggestionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  suggestionIndex: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  suggestionIndexText: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  suggestionText: { flex: 1, fontSize: 14, lineHeight: 22 },
  primaryButton: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
});
