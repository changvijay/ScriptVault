import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAI } from '@/context/AIContext';
import { useData } from '@/context/DataContext';
import {
  loadContentNiches,
  loadDailyIdea,
  saveDailyIdea,
  loadActiveNicheId,
} from '@/services/ai/storage';
import { DailyIdea, ContentNiche } from '@/services/ai/types';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

function parseAIIdea(raw: string, fallbackNiche: string, fallbackLang?: string) {
  try {
    // Extract the JSON object in case the AI added conversational text
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");

    const parsed = JSON.parse(match[0]);
    return {
      title: parsed.title || 'New Trend Script Concept',
      description: parsed.description || '',
      niche: parsed.niche || fallbackNiche,
      language: parsed.language || fallbackLang || 'English',
      captions: Array.isArray(parsed.captions) ? parsed.captions : [],
    };
  } catch {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

    let extractedTitle = '';
    let extractedDescription = '';
    let extractedCaptions: string[] = [];

    let currentSection = '';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.startsWith('title:')) {
        currentSection = 'title';
        extractedTitle += line.substring(6).trim().replace(/['",]$/, '') + ' ';
      } else if (lowerLine.startsWith('description:')) {
        currentSection = 'description';
        extractedDescription += line.substring(12).trim() + '\n';
      } else if (lowerLine.startsWith('captions:')) {
        currentSection = 'captions';
        const cap = line.substring(9).trim().replace(/['",]$/, '');
        if (cap) extractedCaptions.push(cap);
      } else if (lowerLine.startsWith('niche:') || lowerLine.startsWith('language:')) {
        currentSection = 'ignore';
      } else {
        // Append to current section
        if (currentSection === 'title') {
          extractedTitle += line.replace(/['",]$/, '') + ' ';
        } else if (currentSection === 'description') {
          extractedDescription += line + '\n';
        } else if (currentSection === 'captions') {
          const cap = line.replace(/['",]$/, '').trim();
          if (cap) extractedCaptions.push(cap);
        } else if (currentSection === '') {
          // If no section, just assume it's description
          extractedDescription += line + '\n';
        }
      }
    }

    return {
      title: extractedTitle.trim() || 'New Trend Script Concept',
      description: extractedDescription.trim() || cleaned,
      niche: fallbackNiche,
      language: fallbackLang || 'English',
      captions: extractedCaptions,
    };
  }
}

export function DailyAIIdeaCard() {
  const colors = useColors();
  const { hasAI, runCustomAction } = useAI();
  const { createScript } = useData();

  const [niches, setNiches] = useState<ContentNiche[]>([]);
  const [selectedNicheId, setSelectedNicheId] = useState<string | null>(null);
  const [idea, setIdea] = useState<DailyIdea | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsed by default so it's clean; toggles open/close on icon click
  const [expanded, setExpanded] = useState(false);

  // Tracks the most recent generateDailyIdea call so stale/out-of-order
  // AI responses can be detected and ignored (fixes race condition when
  // switching niches or hitting "regenerate" quickly)
  const requestIdRef = useRef(0);

  const todayStr = new Date().toISOString().slice(0, 10);

  const generateDailyIdea = useCallback(
    async (userNiches: ContentNiche[], specificNicheId?: string) => {
      if (userNiches.length === 0 || !hasAI) return;

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      const targetNiche =
        userNiches.find(n => n.id === specificNicheId) || userNiches[0];

      try {

        const prompt = `You are a viral content strategist who has studied thousands of top-performing short-form videos across TikTok, Reels, and Shorts. You specialize in the niche "${targetNiche.title}" and understand exactly what makes audiences stop scrolling, watch to the end, and share.
            TASK: Generate ONE specific, high-performing video/script concept for TODAY (${todayStr}).
            CONTEXT
            - Niche: "${targetNiche.title}"
            - Audience & format: "${targetNiche.description}"
            - Output language for audience-facing text: "${targetNiche.language || 'English'}"
            THINKING PROCESS (apply silently before writing the JSON — do not output this reasoning):
            1. What's currently trending or seasonally relevant in this niche right now (this week/month), not a generic evergreen topic?
            2. What specific hook (first 1-3 seconds) would stop this exact audience from scrolling? Name the hook mechanism (e.g. pattern interrupt, controversial claim, relatable pain point, curiosity gap, before/after).
            3. What's the retention structure — how does the video escalate or pay off so people watch to the end?
            4. What single clear action or takeaway should the viewer leave with?
            QUALITY BAR — reject and redo internally if the idea:
            - Could apply to almost any niche (too generic)
            - Has no clear reason to be posted TODAY specifically vs any random day
            - Doesn't name a concrete hook mechanism
            - Uses cliché phrasing like "You won't believe..." or "Number 5 will shock you"
            LANGUAGE RULES:
            - "title" and "captions" must be written naturally in "${targetNiche.language || 'English'}" (not translated word-for-word from English — write as a native speaker of that market would).
            - "description", "hook_mechanism", and "retention_strategy" must be in English (internal strategy notes for the creator).
            OUTPUT FORMAT — return ONLY valid, parsable JSON. No markdown, no code fences, no commentary before or after:
            {
              "niche": "${targetNiche.title}",
              "language": "${targetNiche.language || 'English'}",
              "title": "Catchy, high-retention script title in ${targetNiche.language || 'English'}",
              "hook_mechanism": "Name the specific psychological hook used (e.g. curiosity gap, pattern interrupt, relatable pain point) and why it works for this audience",
              "description": "2-3 sentences: the current trend/timing angle, the core script arc, and why it's specifically relevant today",
              "retention_strategy": "1-2 sentences on how the script keeps viewers watching to the end (pacing, escalation, payoff)",
              "captions": [
                "🔥 Viral hook caption in ${targetNiche.language || 'English'} — should work as on-screen text or opening line",
                "📢 Engaging call-to-action caption in ${targetNiche.language || 'English'}",
                "#trend #viral #${(targetNiche.language || 'English').toLowerCase()}"
              ]
            }`;

        const rawResult = await runCustomAction(
          prompt,
          `Target Niche: ${targetNiche.title} (${targetNiche.language}) | Context: ${targetNiche.description}`,
        );


        // A newer request has started since this one kicked off — drop this
        // stale result instead of letting it clobber the current selection.
        if (requestIdRef.current !== requestId) return;

        const parsed = parseAIIdea(
          rawResult,
          targetNiche.title,
          targetNiche.language,
        );

        const nextIdea: DailyIdea = {
          date: todayStr,
          niche: parsed.niche,
          language: parsed.language,
          title: parsed.title,
          description: parsed.description,
          captions: parsed.captions,
          accepted: false,
        };

        await saveDailyIdea(nextIdea);

        if (requestIdRef.current !== requestId) return;
        setIdea(nextIdea);
      } catch (e: any) {
        if (requestIdRef.current !== requestId) return;
        setError(
          e?.message ?? 'Could not automatically generate daily trend idea.',
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [hasAI, runCustomAction, todayStr],
  );

  useEffect(() => {
    let active = true;
    async function init() {
      const savedNiches = await loadContentNiches();

      if (!active) return;
      setNiches(savedNiches);

      if (savedNiches.length === 0) return;

      const activeId = await loadActiveNicheId();
      const defaultNiche =
        savedNiches.find(n => n.id === activeId) || savedNiches[0];

      const savedIdea = await loadDailyIdea();

      if (!active) return;

      // Ignore cached ideas from before the parsing fix
      const isBadCache =
        savedIdea?.title === '{' ||
        savedIdea?.title?.includes('{"niche"') ||
        savedIdea?.title?.startsWith('niche:');

      if (savedIdea && savedIdea.date === todayStr && savedIdea.title && !isBadCache) {
        setIdea(savedIdea);
        setSelectedNicheId(defaultNiche.id);
      } else {
        setSelectedNicheId(defaultNiche.id);
        generateDailyIdea(savedNiches, defaultNiche.id);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [todayStr, generateDailyIdea]);

  const handleSelectNiche = (niche: ContentNiche) => {
    setSelectedNicheId(niche.id);
    Haptics.selectionAsync();
    generateDailyIdea(niches, niche.id);
  };

  const handleAcceptIdea = async () => {
    if (!idea) return;
    try {
      const captionsBlock =
        idea.captions && idea.captions.length > 0
          ? `\n\n## 📢 Target Audience Captions & Hashtags\n${idea.captions.map(c => `- ${c}`).join('\n')}`
          : '';

      const newScript = await createScript({
        title: idea.title,
        notes: `# ${idea.title}\n\n**Niche:** ${idea.niche}\n**Language:** ${idea.language || 'English'}\n**Generated:** ${todayStr}\n\n## Content Outline & Trend Analysis\n${idea.description}${captionsBlock}`,
        status: 'not_started',
      });

      const acceptedIdea: DailyIdea = {
        ...idea,
        accepted: true,
        scriptId: newScript.id,
      };

      await saveDailyIdea(acceptedIdea);
      setIdea(acceptedIdea);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignore
    }
  };

  const toggleExpand = () => {
    Haptics.selectionAsync();
    setExpanded(!expanded);
  };

  if (!hasAI || niches.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      {/* Clickable Header bar (Toggles Closed / Open on click) */}
      <Pressable
        onPress={toggleExpand}
        style={[
          styles.header,
          {
            borderBottomWidth: expanded ? 1 : 0,
            borderBottomColor: colors.border,
            backgroundColor: expanded ? colors.card : colors.primary + '12',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: colors.primary + '22' },
            ]}
          >
            <Text style={{ fontSize: 16 }}>🔥</Text>
          </View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={[
                styles.headerTitle,
                { color: colors.foreground, fontFamily: 'Inter_700Bold' },
              ]}
              numberOfLines={1}
            >
              Daily Niche Trend Idea
            </Text>
            <Text
              style={[
                styles.headerSub,
                {
                  color: colors.mutedForeground,
                  fontFamily: 'Inter_400Regular',
                },
              ]}
              numberOfLines={1}
            >
              {expanded
                ? 'Tailored for target language & audience reach'
                : idea?.title
                  ? `${idea.language || 'English'} • ${idea.title}`
                  : "Tap icon to show today's AI concept & viral captions"}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {!!idea?.language && !expanded && (
            <View
              style={[
                styles.langBadgeSmall,
                {
                  backgroundColor: colors.primary + '20',
                  borderColor: colors.primary + '40',
                },
              ]}
            >
              <Text
                style={[
                  styles.langBadgeText,
                  { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
                ]}
              >
                {idea.language}
              </Text>
            </View>
          )}

          {/* Expand / Collapse Icon Button */}
          <Pressable
            onPress={toggleExpand}
            style={[
              styles.toggleIconBtn,
              {
                backgroundColor: expanded
                  ? colors.muted
                  : colors.primary + '25',
              },
            ]}
          >
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </Pressable>

      {/* ── Expandable Idea Content ── */}
      {expanded && (
        <>
          {/* Niche Selector Tabs */}
          {niches.length > 1 && (
            <View
              style={[
                styles.nicheBar,
                {
                  borderBottomColor: colors.border,
                  backgroundColor: colors.muted,
                },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nicheScroll}
              >
                {niches.map(niche => {
                  const isActive =
                    selectedNicheId === niche.id ||
                    idea?.niche === niche.title;
                  return (
                    <Pressable
                      key={niche.id}
                      onPress={() => handleSelectNiche(niche)}
                      style={[
                        styles.nicheChip,
                        {
                          backgroundColor: isActive
                            ? colors.primary + '20'
                            : colors.card,
                          borderColor: isActive
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.nicheChipText,
                          {
                            color: isActive
                              ? colors.primary
                              : colors.mutedForeground,
                            fontFamily: isActive
                              ? 'Inter_600SemiBold'
                              : 'Inter_500Medium',
                          },
                        ]}
                      >
                        {niche.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Body content */}
          <View style={styles.body}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={[
                    styles.loadingText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_400Regular',
                    },
                  ]}
                >
                  Analyzing market trends & audience reach…
                </Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text
                  style={[
                    styles.errorText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: 'Inter_400Regular',
                    },
                  ]}
                >
                  {error}
                </Text>
                <Pressable
                  onPress={() =>
                    generateDailyIdea(
                      niches,
                      selectedNicheId || niches[0].id,
                    )
                  }
                  style={[
                    styles.retryBtn,
                    { backgroundColor: colors.primary + '20' },
                  ]}
                >
                  <Feather
                    name="refresh-cw"
                    size={14}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: 'Inter_600SemiBold',
                      fontSize: 13,
                    }}
                  >
                    Try Generating Now
                  </Text>
                </Pressable>
              </View>
            ) : idea ? (
              <>
                <View style={{ gap: 16 }}>
                  {[
                    { label: 'Niche', value: idea.niche || 'Trend Concept' },
                    { label: 'Title', value: idea.title },
                    { label: 'Description', value: idea.description },
                    ...(idea.captions && idea.captions.length > 0
                      ? [{ label: 'Captions', value: idea.captions.map(c => `• ${c}`).join('\n\n') }]
                      : []
                    )
                  ].map((field, idx) => (
                    <View key={idx} style={{ gap: 6 }}>
                      <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>
                        {field.label}
                      </Text>
                      <View style={{ backgroundColor: colors.card, padding: 12, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>
                          {field.value}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Actions */}
                {idea.accepted ? (
                  <View
                    style={[
                      styles.acceptedRow,
                      {
                        backgroundColor: colors.completed + '15',
                        borderColor: colors.completed + '40',
                      },
                    ]}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Feather
                        name="check-circle"
                        size={16}
                        color={colors.completed}
                      />
                      <Text
                        style={{
                          color: colors.completed,
                          fontFamily: 'Inter_600SemiBold',
                          fontSize: 14,
                        }}
                      >
                        Added to Scripts!
                      </Text>
                    </View>
                    {idea.scriptId && (
                      <Pressable
                        onPress={() =>
                          router.push(`/script/${idea.scriptId}`)
                        }
                        style={[
                          styles.openScriptBtn,
                          { backgroundColor: colors.completed },
                        ]}
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontFamily: 'Inter_600SemiBold',
                            fontSize: 12,
                          }}
                        >
                          Open Script →
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={handleAcceptIdea}
                      style={[
                        styles.acceptBtn,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Feather name="plus-circle" size={16} color="#FFFFFF" />
                      <Text
                        style={[
                          styles.acceptBtnText,
                          {
                            color: colors.primaryForeground,
                            fontFamily: 'Inter_600SemiBold',
                          },
                        ]}
                      >
                        Accept & Add to Scripts
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        generateDailyIdea(
                          niches,
                          selectedNicheId || niches[0].id,
                        )
                      }
                      style={[
                        styles.newIdeaBtn,
                        {
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name="refresh-cw"
                        size={15}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: 'Inter_500Medium',
                          fontSize: 13,
                        }}
                      >
                        Trend Idea
                      </Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
  },
  headerSub: {
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  langBadgeText: {
    fontSize: 11,
  },
  toggleIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nicheBar: {
    borderBottomWidth: 1,
  },
  nicheScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  nicheChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  nicheChipText: {
    fontSize: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  body: {
    padding: 16,
    gap: 12,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ideaTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  ideaDesc: {
    fontSize: 14,
    lineHeight: 21,
  },
  captionsBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  captionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  captionsTitle: {
    fontSize: 13,
  },
  captionItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  acceptBtnText: {
    fontSize: 14,
  },
  newIdeaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  openScriptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});