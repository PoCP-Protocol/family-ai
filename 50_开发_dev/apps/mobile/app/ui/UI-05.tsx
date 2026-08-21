import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { familyApi } from "@/lib/family/family-api-client";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

interface ServiceJourney {
  process_summary?: { label?: string; completed_actions?: number };
}

const WEEKLY_TASKS = ["完成3次亲子沟通练习", "孩子情绪记录 3/3 天", "学习计划执行 4/6 天"] as const;

export default function CompanionJourneyScreen() {
  const session = useFamilyApiSession();
  const { activeOnboardingId, lastReceipt, campCompletedDays } = useFamilyMobile();
  const [remote, setRemote] = useState<ServiceJourney | null>(null);
  const serviceCardsOpacity = useRef(new Animated.Value(0.62)).current;
  const serviceCardsOffset = useRef(new Animated.Value(5)).current;
  const serviceCardsRevealed = useRef(false);
  const checkinScale = useRef(new Animated.Value(1)).current;
  const isRoutingToCheckin = useRef(false);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily || !activeOnboardingId) return;
    let active = true;
    familyApi.getServiceJourney<ServiceJourney>(session.token, session.selectedFamily.family_id, activeOnboardingId)
      .then((result) => { if (active) setRemote(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [activeOnboardingId, session.selectedFamily, session.status, session.token]);

  const progress = useMemo(() => {
    const completed = Math.max(0, Math.min(9, remote?.process_summary?.completed_actions ?? 7));
    return { completed, total: 9, percentage: Math.round((completed / 9) * 100) };
  }, [remote]);
  const thirdTaskDone = Boolean(lastReceipt) || campCompletedDays.length > 0;

  const revealServiceCards = useCallback(() => {
    if (serviceCardsRevealed.current) return;
    serviceCardsRevealed.current = true;
    Animated.parallel([
      Animated.timing(serviceCardsOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(serviceCardsOffset, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [serviceCardsOffset, serviceCardsOpacity]);

  useEffect(() => {
    const fallback = setTimeout(revealServiceCards, 260);
    return () => clearTimeout(fallback);
  }, [revealServiceCards]);

  const openCheckin = () => {
    if (isRoutingToCheckin.current) return;
    isRoutingToCheckin.current = true;
    haptic.light();
    Animated.sequence([
      Animated.timing(checkinScale, { toValue: 0.965, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(checkinScale, { toValue: 1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      router.push("/ui/UI-09" as Href);
      isRoutingToCheckin.current = false;
    });
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={27} color="#222222" />
            </Pressable>
            <Text style={styles.topTitle}>陪跑服务</Text>
            <View style={styles.topActions}><Text style={styles.moreText}>•••</Text><Text style={styles.circleText}>⊙</Text></View>
          </View>

          <Animated.View style={[styles.serviceCardsTransition, { opacity: serviceCardsOpacity, transform: [{ translateY: serviceCardsOffset }] }]}>
            <Image onLoad={revealServiceCards} onError={revealServiceCards} source={require("@/assets/images/ui05-service-cards-baseline.png")} resizeMode="contain" style={styles.serviceCards} accessibilityLabel="家庭顾问、班主任陪跑、AI提醒和专家答疑" />
          </Animated.View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeadline}>
              <Text style={styles.progressTitle}>本周完成度</Text>
              <Text style={styles.progressCount}>本周任务　{progress.completed}/{progress.total}</Text>
            </View>
            <View style={styles.progressValueRow}>
              <Text style={styles.progressValue}>{progress.percentage}</Text><Text style={styles.progressPercent}>%</Text>
              <View style={styles.progressCopy}><Text style={styles.progressCaption}>{remote?.process_summary?.label ?? "超过 78% 的伙伴"}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.percentage}%` }]} /></View></View>
            </View>
            <View style={styles.weeklyList}>
              {WEEKLY_TASKS.map((task, index) => {
                const done = index < 2 || thirdTaskDone;
                return <WeeklyTaskLine key={task} text={task} done={done} />;
              })}
            </View>
          </View>

          <View style={styles.segmentBar}>
            <View style={[styles.segmentItem, styles.segmentActive]}><Text style={styles.segmentTextActive}>成长打卡</Text></View>
            <View style={styles.segmentItem}><Text style={styles.segmentText}>家长交流</Text></View>
            <View style={styles.segmentItem}><Text style={styles.segmentText}>本周直播</Text></View>
          </View>

          <View style={styles.feedCard}>
            <View style={styles.feedHeader}><View style={[styles.avatar, { backgroundColor: "#F7D9CF" }]}><Text style={styles.avatarText}>慧</Text></View><View style={styles.feedAuthor}><Text style={styles.feedName}>慧慧妈妈</Text><Text style={styles.feedTime}>刚刚</Text></View><View style={styles.checkedPill}><Text style={styles.checkedPillText}>已打卡</Text></View></View>
            <Text style={styles.feedText}>今天和孩子一起制定了学习计划，孩子很主动，棒棒哒！</Text>
            <View style={styles.feedMeta}><Text style={styles.feedMetaText}>♧ 23</Text><Text style={styles.feedMetaText}>◯ 8</Text></View>
          </View>

          <View style={[styles.feedCard, styles.secondFeed]}>
            <View style={styles.feedHeader}><View style={[styles.avatar, { backgroundColor: "#DFE9F7" }]}><Text style={styles.avatarText}>乐</Text></View><View style={styles.feedAuthor}><Text style={styles.feedName}>乐乐爸爸</Text><Text style={styles.feedTime}>10分钟前</Text></View></View>
            <Text style={styles.feedText}>坚持打卡第7天，看到孩子的变化！感谢平台的陪伴！</Text>
            <View style={styles.feedMeta}><Text style={styles.feedMetaText}>♧ 18</Text><Text style={styles.feedMetaText}>◯ 5</Text></View>
          </View>
        </ScrollView>

        <Animated.View style={{ transform: [{ scale: checkinScale }] }}>
          <Pressable accessibilityLabel="打卡" onPress={openCheckin} style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
            <Text style={styles.fabPlus}>＋</Text><Text style={styles.fabText}>打卡</Text>
          </Pressable>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

function WeeklyTaskLine({ text, done }: { text: string; done: boolean }) {
  return <View style={styles.weeklyTaskLine}><Text style={styles.weeklyTaskText}>{text}</Text>{done ? <IconSymbol name="checkmark.circle.fill" size={19} color="#1DB875" /> : <View style={styles.emptyCheck} />}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { paddingBottom: 104 },
  topBar: { minHeight: 64, paddingHorizontal: 18, alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  backButton: { width: 36, alignItems: "flex-start" },
  topTitle: { color: "#20242A", fontSize: 19, lineHeight: 26, fontWeight: "800" },
  topActions: { width: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moreText: { color: "#20242A", fontSize: 17, lineHeight: 19, fontWeight: "900", letterSpacing: 1 },
  circleText: { color: "#20242A", fontSize: 25, lineHeight: 25 },
  serviceCardsTransition: { alignSelf: "center", width: "100%", height: 211, marginTop: 1 },
  serviceCards: { width: "100%", height: 211 },
  progressCard: { marginHorizontal: 19, marginTop: 8, padding: 17, backgroundColor: "#FFFFFF", borderRadius: 15, borderWidth: 1, borderColor: "#EDF0F5" },
  progressHeadline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressTitle: { color: "#1E2732", fontSize: 16, lineHeight: 22, fontWeight: "900" },
  progressCount: { color: "#697585", fontSize: 12, lineHeight: 17, fontWeight: "700" },
  progressValueRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 9 },
  progressValue: { color: "#237CF2", fontSize: 47, lineHeight: 51, fontWeight: "900" },
  progressPercent: { color: "#222B36", fontSize: 25, lineHeight: 32, fontWeight: "700", marginBottom: 5, marginLeft: 2 },
  progressCopy: { flex: 1, marginLeft: 15, marginBottom: 8, gap: 9 },
  progressCaption: { color: "#9AA4B3", fontSize: 11, lineHeight: 15 },
  progressTrack: { height: 5, flex: 1, backgroundColor: "#E6EAF0", borderRadius: 5, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: "#227CFA", borderRadius: 5 },
  weeklyList: { marginTop: 12, gap: 11 },
  weeklyTaskLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weeklyTaskText: { color: "#566272", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  emptyCheck: { width: 18, height: 18, borderRadius: 9, borderColor: "#3A88F5", borderWidth: 1.5 },
  segmentBar: { minHeight: 50, marginTop: 14, flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#F1F2F5" },
  segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 2 },
  segmentActive: { borderBottomWidth: 3, borderBottomColor: "#257CF2" },
  segmentTextActive: { color: "#287CED", fontSize: 15, lineHeight: 21, fontWeight: "900" },
  segmentText: { color: "#343D48", fontSize: 15, lineHeight: 21, fontWeight: "700" },
  feedCard: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "#EDF0F3" },
  secondFeed: { paddingTop: 17 },
  feedHeader: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#385067", fontSize: 17, lineHeight: 23, fontWeight: "800" },
  feedAuthor: { flex: 1, marginLeft: 10, gap: 1 },
  feedName: { color: "#2B3440", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  feedTime: { color: "#A0A8B4", fontSize: 11, lineHeight: 15 },
  checkedPill: { borderRadius: 13, borderWidth: 1, borderColor: "#A9E4C5", paddingHorizontal: 9, paddingTop: 3, paddingBottom: 3 },
  checkedPillText: { color: "#2CB37B", fontSize: 12, lineHeight: 16, fontWeight: "800" },
  feedText: { color: "#394553", fontSize: 15, lineHeight: 24, fontWeight: "600", marginTop: 12 },
  feedMeta: { flexDirection: "row", justifyContent: "flex-end", gap: 20, marginTop: 10 },
  feedMetaText: { color: "#8E98A4", fontSize: 13, lineHeight: 18 },
  fab: { position: "absolute", right: 20, bottom: 20, minWidth: 105, minHeight: 49, borderRadius: 25, backgroundColor: "#247DF0", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, shadowColor: "#1C74DE", shadowOpacity: 0.24, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabPlus: { color: "#FFFFFF", fontSize: 25, lineHeight: 29, fontWeight: "500" },
  fabText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "900" },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
});
