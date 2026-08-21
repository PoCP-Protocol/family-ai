import type { Href } from "expo-router";
import { router } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { UI01_HOME_TARGETS } from "@/lib/family/ui01-home-entry-map";
import { useFamilyMobile } from "@/lib/family/family-state";

const assessmentBanner = require("@/assets/images/ui01/assessment-banner.png");
const recommendationLive = require("@/assets/images/ui01/recommendation-live.png");
const recommendationCourse = require("@/assets/images/ui01/recommendation-course.png");
const recommendationCase = require("@/assets/images/ui01/recommendation-case.png");

type HomeIcon = "heart.fill" | "gift.fill" | "calendar.fill" | "photo.fill" | "video.fill" | "headphones.fill" | "checkmark.circle.fill" | "book.fill";

const QUICK_ENTRIES: readonly { label: string; icon: HomeIcon; color: string; target: Href }[] = [
  { label: "AI诊断", icon: "heart.fill", color: "#35B9D7", target: `/ui/${UI01_HOME_TARGETS.aiInterpretation}` as Href },
  { label: "21天挑战营", icon: "gift.fill", color: "#F59D34", target: `/ui/${UI01_HOME_TARGETS.camp21}` as Href },
  { label: "90天成长计划", icon: "calendar.fill", color: "#36A866", target: `/ui/${UI01_HOME_TARGETS.plan90}` as Href },
  { label: "成长案例", icon: "photo.fill", color: "#F0A337", target: `/ui/${UI01_HOME_TARGETS.growthStories}` as Href },
  { label: "专家直播", icon: "video.fill", color: "#55A6E9", target: `/ui/${UI01_HOME_TARGETS.expertLive}` as Href },
  { label: "家庭顾问", icon: "headphones.fill", color: "#EC725D", target: `/ui/${UI01_HOME_TARGETS.familyAdvisor}` as Href },
];

const RECOMMENDATIONS: readonly { title: string; image: number; target: Href }[] = [
  { title: "妈妈总问我：为什么？", image: recommendationLive, target: `/ui/${UI01_HOME_TARGETS.recommendations}` as Href },
  { title: "高效学习习惯养成课", image: recommendationCourse, target: `/ui/${UI01_HOME_TARGETS.recommendations}` as Href },
  { title: "从紧张冲突到亲子和谐", image: recommendationCase, target: `/ui/${UI01_HOME_TARGETS.recommendations}` as Href },
];

export default function TodayScreen() {
  const colors = useColors();
  const { todayAction } = useFamilyMobile();
  const communicationDone = todayAction.status === "checked_in";
  const tasks = [
    { label: "亲子沟通小练习", icon: "checkmark.circle.fill" as const, color: "#39AC7A", done: communicationDone },
    { label: "完成今日阅读打卡", icon: "book.fill" as const, color: "#F1A136", done: false },
    { label: "情绪记录", icon: "heart.fill" as const, color: "#F1A136", done: false },
  ];

  const open = (target: Href) => router.push(target);

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
              <View style={styles.topActions}>
                <IconSymbol name="ellipsis" size={25} color={colors.text} />
                <IconSymbol name="eye.fill" size={22} color={colors.text} />
              </View>
            </View>

            <View style={styles.welcomeRow}>
              <Text style={[styles.welcome, { color: colors.text }]}>早上好，{"\n"}今天也一起陪孩子成长 ☀</Text>
              <IconSymbol name="bell.fill" size={25} color={colors.text} />
            </View>

            <Pressable accessibilityRole="button" accessibilityLabel="免费家庭测评" onPress={() => open(`/ui/${UI01_HOME_TARGETS.freeAssessment}` as Href)} style={({ pressed }) => [styles.assessmentBanner, pressed && styles.pressed]}>
              <Image source={assessmentBanner} resizeMode="cover" style={styles.assessmentImage} />
            </Pressable>

            <View style={[styles.quickGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {QUICK_ENTRIES.map((entry) => (
                <Pressable key={entry.label} accessibilityRole="button" accessibilityLabel={entry.label} onPress={() => open(entry.target)} style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}>
                  <IconSymbol name={entry.icon} size={29} color={entry.color} />
                  <Text style={[styles.quickLabel, { color: colors.text }]}>{entry.label}</Text>
                </Pressable>
              ))}
            </View>

            <SectionTitle title="今日成长任务" action="查看全部" onPress={() => open(`/ui/${UI01_HOME_TARGETS.dailyTasks}` as Href)} colors={colors} />
            <View style={[styles.taskList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {tasks.map((task, index) => (
                <Pressable key={task.label} accessibilityRole="button" accessibilityLabel={task.label} onPress={() => open(`/ui/${UI01_HOME_TARGETS.dailyTasks}` as Href)} style={({ pressed }) => [styles.taskRow, index < tasks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, pressed && styles.pressed]}>
                  <IconSymbol name={task.icon} size={21} color={task.color} />
                  <Text style={[styles.taskLabel, { color: colors.text }]}>{task.label}</Text>
                  {task.done ? <IconSymbol name="checkmark.circle.fill" size={22} color="#32B276" /> : <Text style={[styles.completePill, { color: colors.tint, borderColor: `${colors.tint}55` }]}>去完成</Text>}
                </Pressable>
              ))}
            </View>

            <SectionTitle title="推荐内容/服务" action="更多" onPress={() => open(`/ui/${UI01_HOME_TARGETS.recommendations}` as Href)} colors={colors} />
            <View style={styles.recommendationRow}>
              {RECOMMENDATIONS.map((item) => (
                <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={`查看${item.title}`} onPress={() => open(item.target)} style={({ pressed }) => [styles.recommendationCard, pressed && styles.pressed]}>
                  <Image source={item.image} resizeMode="cover" style={styles.recommendationImage} />
                </Pressable>
              ))}
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

function SectionTitle({ title, action, onPress, colors }: { title: string; action: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.sectionTopline}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
        <Text style={[styles.moreText, { color: colors.muted }]}>{action}</Text>
        <IconSymbol name="chevron.right" size={17} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28 },
  page: { gap: 14 },
  topBar: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  platformTitle: { fontSize: 22, lineHeight: 29, fontWeight: "900" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 4 },
  welcomeRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 2 },
  welcome: { fontSize: 23, lineHeight: 31, fontWeight: "900" },
  assessmentBanner: { height: 110, borderRadius: 17, overflow: "hidden" },
  assessmentImage: { width: "100%", height: "100%" },
  quickGrid: { borderWidth: 1, borderRadius: 17, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
  quickEntry: { width: "33.333%", minHeight: 94, alignItems: "center", justifyContent: "center", gap: 7, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#EDF1F5" },
  quickLabel: { fontSize: 13, lineHeight: 18, fontWeight: "700", textAlign: "center" },
  sectionTopline: { marginTop: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: "900" },
  moreButton: { flexDirection: "row", alignItems: "center", gap: 1, minHeight: 32, paddingLeft: 8 },
  moreText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  taskList: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  taskRow: { minHeight: 51, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 },
  taskLabel: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "700" },
  completePill: { minWidth: 62, minHeight: 28, borderWidth: 1, borderRadius: 14, textAlign: "center", textAlignVertical: "center", fontSize: 12, lineHeight: 26, fontWeight: "800" },
  recommendationRow: { flexDirection: "row", gap: 9 },
  recommendationCard: { flex: 1, height: 128, borderRadius: 12, overflow: "hidden", backgroundColor: "#E6ECF3" },
  recommendationImage: { width: "100%", height: "100%" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
