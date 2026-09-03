import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { CAMP_21_DAYS, getCamp21Day } from "@/lib/family/camp21";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

const STAGES = [
  { title: "观察与连接", range: "Day 1–7" },
  { title: "沟通与习惯", range: "Day 8–14" },
  { title: "反思与延续", range: "Day 15–21" },
];

export default function Camp21Screen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const { campStarted, campCurrentDay, campCompletedDays, startCamp, activateCampDay } = useFamilyMobile();
  const [reviewedContentConnected, setReviewedContentConnected] = useState(false);
  const [growthConsentReady, setGrowthConsentReady] = useState(false);
  const day = getCamp21Day(campCurrentDay);
  const progress = campCompletedDays.length / CAMP_21_DAYS.length;

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    const familyId = session.selectedFamily.family_id;
    Promise.all([
      familyApi.getActiveOnboarding(session.token, familyId),
      familyApi.getInterventionLibrary<{ items?: Array<{ review_status?: string }> }>(session.token, familyId).catch(() => null),
    ]).then(async ([onboarding, library]) => {
      const context = typeof onboarding?.child_id === "string"
        ? await familyApi.resolveFamilyContext<{ consent?: { allowed?: boolean } }>(session.token!, familyId, onboarding.child_id, "GROWTH_GUIDANCE").catch(() => null)
        : null;
      if (!active) return;
      setReviewedContentConnected(Boolean(library?.items?.some((item) => item.review_status === "PUBLISHED")));
      setGrowthConsentReady(Boolean(context?.consent?.allowed));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const beginToday = () => {
    if (!campStarted) startCamp();
    activateCampDay(campCurrentDay);
    haptic.light();
    router.push("/ui/UI-09" as Href);
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "21 天智慧父母成长营", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={STAGES}
        keyExtractor={(item) => item.title}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.metaRow}>
              <Text style={[styles.eyebrow, { color: colors.tint }]}>家长行动课程</Text>
              <Text style={[styles.dayCount, { color: colors.muted }]}>{campCompletedDays.length}/21 已记录</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>每天一件小事，形成新的家庭节奏</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>课程分三阶段推进。完成代表行动发生，不代表孩子或家庭已经产生确定效果。</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 4)}%`, backgroundColor: colors.success }]} />
            </View>

            <View style={[styles.todayPanel, { backgroundColor: "#09295A" }]}>
              <View style={styles.todayTopline}>
                <Text style={styles.todayLabel}>{campStarted ? `今天 · Day ${day.day}` : "从 Day 1 开始"}</Text>
                <Text style={styles.todayStage}>{day.stage}</Text>
              </View>
              <Text style={styles.todayTitle}>{day.title}</Text>
              <Text style={styles.todayIntent}>{day.intent}</Text>
              <View style={styles.todayActionRow}>
                <Text style={styles.todayMinutes}>约 {day.estimatedMinutes} 分钟</Text>
                <Pressable onPress={beginToday} style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}>
                  <Text style={styles.inlineButtonText}>{campStarted ? "开始今天练习" : "开始成长营"}</Text>
                  <IconSymbol name="chevron.right" size={19} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            <View style={[styles.reviewNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="checkmark.seal.fill" size={23} color={colors.warning} />
              <View style={styles.reviewCopy}>
                <Text style={[styles.reviewTitle, { color: colors.text }]}>成长营说明</Text>
                <Text style={[styles.reviewText, { color: colors.muted }]}>三阶段帮助家长循序练习；{reviewedContentConnected ? "首个练习已连接审核内容库" : "当前使用已评审课程基线"}，{growthConsentReady ? "成长使用同意已确认" : "仅按最小必要家庭信息运行"}。</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>三个成长阶段</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const start = index * 7 + 1;
          const end = start + 6;
          const completed = campCompletedDays.filter((value) => value >= start && value <= end).length;
          const active = day.day >= start && day.day <= end;
          return (
            <View style={[styles.stageRow, { backgroundColor: colors.surface, borderColor: active ? colors.tint : colors.border }]}>
              <View style={[styles.stageNumber, { backgroundColor: active ? colors.tint : colors.background }]}>
                <Text style={[styles.stageNumberText, { color: active ? "#FFFFFF" : colors.tint }]}>{index + 1}</Text>
              </View>
              <View style={styles.stageCopy}>
                <Text style={[styles.stageTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.stageRange, { color: colors.muted }]}>{item.range} · 已记录 {completed}/7</Text>
              </View>
              {completed === 7 ? <IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} /> : null}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={[styles.handoff, { borderColor: colors.border }]}>
            <Text style={[styles.handoffTitle, { color: colors.text }]}>完成后，下一步由家庭决定</Text>
            <Text style={[styles.handoffText, { color: colors.muted }]}>Day 21 会形成过程回顾，并提供 90 天成长方案草稿入口；不会自动创建计划、会员或订单。</Text>
            <Pressable onPress={() => router.push("/ui/UI-04" as Href)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>先了解 90 天成长方案</Text>
            </Pressable>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 12 },
  header: { gap: 16, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.6 },
  dayCount: { fontSize: 13, lineHeight: 18 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  progressTrack: { height: 7, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 999 },
  todayPanel: { borderRadius: 28, padding: 22, gap: 12 },
  todayTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  todayLabel: { color: "#FFD9B8", fontSize: 13, lineHeight: 18, fontWeight: "800" },
  todayStage: { color: "#BFE8FF", fontSize: 13, lineHeight: 18 },
  todayTitle: { color: "#FFFFFF", fontSize: 25, lineHeight: 33, fontWeight: "800" },
  todayIntent: { color: "#D7E8FF", fontSize: 15, lineHeight: 22 },
  todayActionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 3 },
  todayMinutes: { color: "#BFE8FF", fontSize: 13, lineHeight: 18 },
  inlineButton: { minHeight: 44, borderRadius: 15, paddingHorizontal: 15, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", gap: 4 },
  inlineButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  reviewNote: { minHeight: 82, borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  reviewCopy: { flex: 1, gap: 3 },
  reviewTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  reviewText: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  stageRow: { minHeight: 82, borderWidth: 1.5, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 },
  stageNumber: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stageNumberText: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  stageCopy: { flex: 1, gap: 3 },
  stageTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  stageRange: { fontSize: 13, lineHeight: 18 },
  handoff: { borderTopWidth: 1, marginTop: 10, paddingTop: 22, gap: 9 },
  handoffTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  handoffText: { fontSize: 14, lineHeight: 21 },
  secondaryButton: { minHeight: 52, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 5 },
  secondaryButtonText: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
