import type { Href } from "expo-router";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DataSourceBanner } from "@/components/family/data-source-banner";
import { FamilyRefreshControl } from "@/components/family/family-refresh-control";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { buildFamilyRhythmEvents, buildPrivateGrowthStory } from "@/lib/family/child-growth";
import { familyApi } from "@/lib/family/family-api-client";
import { selectPrivateGrowthStory, type FamilyApiPlatformSurfacesProjection } from "@/lib/family/family-api-projections";
import { useFamilyApiSession } from "@/lib/family/family-api-session";
import { useFamilyMobile } from "@/lib/family/family-state";
import { haptic } from "@/lib/haptics";

interface StoryDisplayItem {
  id: string;
  title: string;
  detail: string;
  sourceLabel: string;
}

export default function PrivateGrowthStoryScreen() {
  const colors = useColors();
  const session = useFamilyApiSession();
  const state = useFamilyMobile();
  const [familyNote, setFamilyNote] = useState(state.privateGrowthStory?.familyNote ?? "");
  const [remoteProjection, setRemoteProjection] = useState<FamilyApiPlatformSurfacesProjection | null>(null);

  useEffect(() => {
    if (session.status !== "connected" || !session.token || !session.selectedFamily) return;
    let active = true;
    familyApi.getDevPlatformSurfaces<FamilyApiPlatformSurfacesProjection>(session.token, session.selectedFamily.family_id)
      .then((result) => { if (active) setRemoteProjection(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session.selectedFamily, session.status, session.token]);

  const localEvents = useMemo(() => buildFamilyRhythmEvents({
    selectedGrowthFocus: state.selectedGrowthFocus,
    lastReceipt: state.lastReceipt,
    campCompletedDays: state.campCompletedDays,
    uiActionReceipts: state.uiActionReceipts,
    childChoiceDraft: state.childChoiceDraft,
  }).slice(-4), [state.campCompletedDays, state.childChoiceDraft, state.lastReceipt, state.selectedGrowthFocus, state.uiActionReceipts]);
  const remoteStory = selectPrivateGrowthStory(remoteProjection);
  const events = useMemo<StoryDisplayItem[]>(() => {
    if (remoteStory?.moments.length) {
      return remoteStory.moments.map((detail, index) => ({
        id: `family-api-story-${index}`,
        title: `家庭成长片段 ${index + 1}`,
        detail,
        sourceLabel: "家庭过程记录",
      }));
    }
    return localEvents.map((event) => ({ id: event.id, title: event.title, detail: event.detail, sourceLabel: `${event.sourceUi} · 家庭过程记录` }));
  }, [localEvents, remoteStory?.moments]);
  const preview = useMemo(() => {
    if (!remoteStory) return buildPrivateGrowthStory(localEvents, familyNote);
    return {
      id: "private-growth-story-current",
      title: remoteStory.title,
      summary: remoteStory.summary,
      sourceEventIds: events.map((event) => event.id),
      familyNote: familyNote.trim(),
      visibility: "FAMILY_PRIVATE" as const,
      state: "PRIVATE_DRAFT" as const,
      perspectiveKind: "family_narrative_not_fact_or_outcome" as const,
      externalEffect: false as const,
      updatedAt: new Date().toISOString(),
    };
  }, [events, familyNote, localEvents, remoteStory]);

  const saveDraft = () => {
    state.savePrivateGrowthStory(preview);
    haptic.success();
  };

  return (
    <ScreenContainer edges={["left", "right", "bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: "家庭成长故事", headerBackTitle: "返回" }} />
      <FlatList
        refreshControl={<FamilyRefreshControl />}
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.metaRow}>
              <Text style={[styles.eyebrow, { color: colors.tint }]}>家庭私有故事</Text>
              <View style={[styles.privateBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.privateDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.privateText, { color: colors.success }]}>仅家庭可见</Text>
              </View>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>把共同尝试过的片段，温和地记下来</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>这是一份家庭叙事草稿，不是孩子的成果证明，也不会自动保存为图片、分享或发布。</Text>
            <DataSourceBanner />

            <View style={[styles.storyCover, { backgroundColor: "#09295A" }]}>
              <Text style={styles.storyLabel}>我们的家庭故事</Text>
              <Text style={styles.storyTitle}>{preview.title}</Text>
              <Text style={styles.storySummary}>{preview.summary}</Text>
              <View style={styles.storyBoundary}>
                <Text style={styles.storyBoundaryText}>过程片段 · 家庭视角 · 不代表成长结果</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>故事里的几个片段</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.storyEvent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.storyNumber, { backgroundColor: colors.background }]}>
              <Text style={[styles.storyNumberText, { color: colors.tint }]}>{index + 1}</Text>
            </View>
            <View style={styles.storyEventCopy}>
              <Text style={[styles.storyEventTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.storyEventDetail, { color: colors.muted }]}>{item.detail}</Text>
              <Text style={[styles.storyEventSource, { color: colors.tint }]}>{item.sourceLabel}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>故事还没有开始</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>可以先从一次家庭愿意记录的小行动出发。完成后，这里只整理已经发生的过程。</Text>
            <Pressable onPress={() => router.push("/ui/UI-09" as Href)} style={[styles.smallButton, { backgroundColor: colors.tint }]}>
              <Text style={styles.smallButtonText}>去看今日行动</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.noteArea}>
              <Text style={[styles.noteLabel, { color: colors.text }]}>家庭想补充的一句话（可选）</Text>
              <TextInput
                accessibilityLabel="家庭故事备注"
                value={familyNote}
                onChangeText={setFamilyNote}
                multiline
                returnKeyType="done"
                placeholder="例如：我们发现，慢一点说话时更容易听见彼此。请不要填写孩子姓名、学校或联系方式。"
                placeholderTextColor={colors.muted}
                style={[styles.noteInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              />
            </View>

            <View style={[styles.noSharePanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="lock.fill" size={24} color={colors.success} />
              <View style={styles.noShareCopy}>
                <Text style={[styles.noShareTitle, { color: colors.text }]}>当前只保存私有草稿</Text>
                <Text style={[styles.noShareText, { color: colors.muted }]}>不生成二维码、不下载、不调用系统分享、不发布社区，也不发送通知。</Text>
              </View>
            </View>

            <Pressable
              disabled={events.length === 0}
              onPress={saveDraft}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: events.length > 0 ? colors.tint : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>保存为家庭私有故事草稿</Text>
              <IconSymbol name="checkmark.circle.fill" size={21} color="#FFFFFF" />
            </Pressable>

            {state.privateGrowthStory ? (
              <View style={[styles.receipt, { backgroundColor: "#16866D18", borderColor: colors.success }]}>
                <Text style={[styles.receiptTitle, { color: colors.success }]}>家庭故事草稿已保存</Text>
                <Text style={[styles.receiptText, { color: colors.muted }]}>仍然只在本机家庭空间中，未产生任何外部效果。</Text>
              </View>
            ) : null}

            <Pressable onPress={() => router.push("/ui/UI-11" as Href)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>回到我们的成长节奏</Text>
            </Pressable>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36, gap: 12 },
  header: { gap: 15, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eyebrow: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "800", letterSpacing: 0.8 },
  privateBadge: { minHeight: 34, borderWidth: 1, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 },
  privateDot: { width: 8, height: 8, borderRadius: 4 },
  privateText: { fontSize: 11, lineHeight: 16, fontWeight: "800" },
  title: { fontSize: 29, lineHeight: 37, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 23 },
  storyCover: { borderRadius: 28, padding: 22, gap: 11 },
  storyLabel: { color: "#FFD9B8", fontSize: 12, lineHeight: 17, fontWeight: "800", letterSpacing: 0.6 },
  storyTitle: { color: "#FFFFFF", fontSize: 26, lineHeight: 35, fontWeight: "800" },
  storySummary: { color: "#D7E8FF", fontSize: 15, lineHeight: 23 },
  storyBoundary: { alignSelf: "flex-start", borderRadius: 999, backgroundColor: "#FFFFFF14", paddingHorizontal: 11, paddingVertical: 7 },
  storyBoundaryText: { color: "#BFD3EC", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800" },
  storyEvent: { minHeight: 112, borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: "row", gap: 12 },
  storyNumber: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  storyNumberText: { fontSize: 16, lineHeight: 21, fontWeight: "900" },
  storyEventCopy: { flex: 1, gap: 4 },
  storyEventTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  storyEventDetail: { fontSize: 13, lineHeight: 19 },
  storyEventSource: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  empty: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 9 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 21 },
  smallButton: { minHeight: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 3 },
  smallButtonText: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontWeight: "800" },
  footer: { gap: 12, paddingTop: 12 },
  noteArea: { gap: 8 },
  noteLabel: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  noteInput: { minHeight: 114, borderWidth: 1, borderRadius: 18, padding: 15, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
  noSharePanel: { minHeight: 82, borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  noShareCopy: { flex: 1, gap: 3 },
  noShareTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  noShareText: { fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 21, fontWeight: "800" },
  receipt: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 4 },
  receiptTitle: { fontSize: 15, lineHeight: 20, fontWeight: "800" },
  receiptText: { fontSize: 12, lineHeight: 18 },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
