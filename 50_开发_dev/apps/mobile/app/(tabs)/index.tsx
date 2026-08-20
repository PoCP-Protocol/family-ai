import type { Href } from "expo-router";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useFamilyMobile } from "@/lib/family/family-state";
import { getFamilyScreen } from "@/lib/family/ui-registry";

const QUICK_IDS = ["UI-35", "UI-02", "UI-19"] as const;

export default function TodayScreen() {
  const colors = useColors();
  const { todayAction, campStarted, campCurrentDay, campCompletedDays } = useFamilyMobile();
  const quickItems = QUICK_IDS.map((id) => getFamilyScreen(id)).filter(Boolean);

  return (
    <ScreenContainer>
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={quickItems}
        keyExtractor={(item) => item!.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingCopy}>
                <Text style={[styles.eyebrow, { color: colors.tint }]}>我们家的今天</Text>
                <Text style={[styles.title, { color: colors.text }]}>晚上好，先做一件小事</Text>
              </View>
              <View style={[styles.familyMark, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.familyMarkText, { color: colors.tint }]}>家</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看今日成长任务"
              onPress={() => router.push("/ui/UI-09" as Href)}
              style={({ pressed }) => [styles.todayCard, { backgroundColor: "#09295A" }, pressed && styles.pressed]}
            >
              <View style={styles.todayTopline}>
                <Text style={styles.todayLabel}>{todayAction.status === "checked_in" ? "今天已记录" : "今晚一件事"}</Text>
                <Text style={styles.todayDuration}>约 {todayAction.estimatedMinutes} 分钟</Text>
              </View>
              <Text style={styles.todayTitle}>{todayAction.title}</Text>
              <Text style={styles.todayReason}>{todayAction.status === "checked_in" ? "这次行动已记录。完成不代表已经产生教育效果。" : todayAction.reason}</Text>
              <View style={styles.todayFooter}>
                <Text style={styles.todayAction}>{todayAction.status === "checked_in" ? "查看记录" : "查看行动卡"}</Text>
                <IconSymbol name="chevron.right" size={20} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={[styles.signalBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.signalDot, { backgroundColor: colors.success }]} />
              <View style={styles.signalCopy}>
                <Text style={[styles.signalTitle, { color: colors.text }]}>建议来源清晰</Text>
                <Text style={[styles.signalText, { color: colors.muted }]}>规则化家庭成长建议 · 不代表教育结果</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看 21 天智慧父母成长营"
              onPress={() => router.push("/ui/UI-35" as Href)}
              style={({ pressed }) => [styles.campStrip, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <View style={[styles.campDay, { backgroundColor: colors.background }]}>
                <Text style={[styles.campDayNumber, { color: colors.tint }]}>{campStarted ? campCurrentDay : 1}</Text>
                <Text style={[styles.campDayLabel, { color: colors.muted }]}>DAY</Text>
              </View>
              <View style={styles.campCopy}>
                <Text style={[styles.campTitle, { color: colors.text }]}>21 天智慧父母成长营</Text>
                <Text style={[styles.campSubtitle, { color: colors.muted }]}>{campStarted ? `已记录 ${campCompletedDays.length}/21 天 · 继续当前阶段` : "三阶段 · 每天一件小事"}</Text>
              </View>
              <IconSymbol name="chevron.right" size={20} color={colors.muted} />
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>继续我们的成长旅程</Text>
          </View>
        }
        renderItem={({ item }) => item ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/ui/${item.id}` as Href)}
            style={({ pressed }) => [styles.quickRow, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.background }]}>
              <Text style={[styles.quickIconText, { color: colors.tint }]}>{item.id.slice(3)}</Text>
            </View>
            <View style={styles.quickCopy}>
              <Text style={[styles.quickTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.quickSubtitle, { color: colors.muted }]} numberOfLines={2}>{item.subtitle}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 12 },
  headerArea: { gap: 16, marginBottom: 6 },
  greetingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  greetingCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 28, lineHeight: 36, fontWeight: "800" },
  familyMark: { width: 48, height: 48, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  familyMarkText: { fontSize: 21, lineHeight: 26, fontWeight: "800" },
  todayCard: { minHeight: 226, borderRadius: 28, padding: 22, justifyContent: "space-between" },
  todayTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  todayLabel: { color: "#FFD9B8", fontSize: 14, lineHeight: 20, fontWeight: "800" },
  todayDuration: { color: "#D7E8FF", fontSize: 13, lineHeight: 18 },
  todayTitle: { color: "#FFFFFF", fontSize: 26, lineHeight: 34, fontWeight: "800", maxWidth: 310 },
  todayReason: { color: "#D7E8FF", fontSize: 15, lineHeight: 22, maxWidth: 330 },
  todayFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  todayAction: { color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "700" },
  signalBar: { minHeight: 72, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  signalDot: { width: 10, height: 10, borderRadius: 5 },
  signalCopy: { flex: 1, gap: 2 },
  signalTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  signalText: { fontSize: 13, lineHeight: 18 },
  campStrip: { minHeight: 78, borderWidth: 1, borderRadius: 20, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  campDay: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  campDayNumber: { fontSize: 19, lineHeight: 22, fontWeight: "800" },
  campDayLabel: { fontSize: 9, lineHeight: 12, fontWeight: "700", letterSpacing: 0.8 },
  campCopy: { flex: 1, gap: 3 },
  campTitle: { fontSize: 16, lineHeight: 21, fontWeight: "800" },
  campSubtitle: { fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", marginTop: 4 },
  quickRow: { minHeight: 94, borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 13 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  quickIconText: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  quickCopy: { flex: 1, gap: 4 },
  quickTitle: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  quickSubtitle: { fontSize: 14, lineHeight: 19 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
