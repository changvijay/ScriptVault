import { AIAction, AIActionMeta } from './types';

export const ACTION_META: Record<AIAction, AIActionMeta> = {
  enhance: {
    key: 'enhance',
    label: 'Enhance Script',
    emoji: '✨',
    description: 'Make it more compelling and natural',
  },
  hooks: {
    key: 'hooks',
    label: 'Add Hooks',
    emoji: '🎣',
    description: 'Generate 5 attention-grabbing openers',
  },
  grammar: {
    key: 'grammar',
    label: 'Fix Grammar',
    emoji: '📝',
    description: 'Correct grammar, spelling & punctuation',
  },
  cta: {
    key: 'cta',
    label: 'Improve CTA',
    emoji: '🎯',
    description: 'Strengthen the call to action',
  },
  tone: {
    key: 'tone',
    label: 'Improve Tone',
    emoji: '😊',
    description: 'Make it warmer and more conversational',
  },
  shorten: {
    key: 'shorten',
    label: 'Shorten Script',
    emoji: '✂️',
    description: 'Cut to ~70% while keeping the key message',
  },
  expand: {
    key: 'expand',
    label: 'Expand Script',
    emoji: '📈',
    description: 'Add context, examples & smoother transitions',
  },
  trend_idea: {
    key: 'trend_idea',
    label: 'Niche Trend Idea & Captions',
    emoji: '🔥',
    description: 'Current market trend idea, viral hooks & language captions',
  },
};

export const SYSTEM_PROMPTS: Record<AIAction, string> = {
  enhance:
    'Rewrite this short-form script (Reels/TikTok/Shorts) following these script-writing rules:\n' +
    '1. Must open with a strong hook in the first line — curiosity, tension, bold claim, or relatable pain point.\n' +
    '2. Must use engaging, emotional, and conversational language throughout — not flat or written-essay tone.\n' +
    '3. Must end with a clear, natural call to action.\n' +
    'Keep the original idea, message, and intent unchanged — only improve how it\'s delivered. Return only the enhanced script.',

  hooks:
    'Add ONE new hook line at the very top of this script, before the existing first line. ' +
    'The hook must grab attention within 1-3 seconds using curiosity, tension, a bold statement, or a relatable pain point, ' +
    'matching the tone and language of the existing script. ' +
    'Do not change, remove, or rewrite anything else in the script. Return the full script with the new hook line added at the top.',

  grammar:
    'Fix only spelling, grammar, and punctuation mistakes in this script. ' +
    'Do not change the wording, sentence structure, ideas, or script content in any other way. ' +
    'Return only the corrected script.',

  cta:
    'Rewrite only the ending of this script to include a strong call to action, following these rules:\n' +
    '1. The CTA must be clear and specific (follow, comment, share, save — whichever fits the content).\n' +
    '2. It must feel natural and match the script\'s existing tone, not sound like an ad.\n' +
    'Do not change any other part of the script. Return the full script with only the ending updated.',

  tone:
    'Rewrite this script using warmer, more conversational, and emotionally engaging language, following these rules:\n' +
    '1. Use natural, spoken-style phrasing, not formal or written-style sentences.\n' +
    '2. Add emotional and engagement-driving words where it fits naturally.\n' +
    '3. Keep the same sentence structure and order as much as possible.\n' +
    'Do not change the original message, idea, or intent. Return only the revised script.',

  shorten:
    'Rewrite this script so that when spoken aloud at a natural pace (~150-160 words per minute, ' +
    'typical for short-form video), it runs approximately 2 to 2.5 minutes — roughly 300 to 400 words total. ' +
    'Follow these rules:\n' +
    '1. Keep the opening hook intact.\n' +
    '2. Keep the closing CTA intact.\n' +
    '3. Preserve every core idea, key point, and main message from the original script — do not drop or summarize away the substance.\n' +
    '4. Tighten wording and remove only truly redundant, repetitive, or filler lines to hit the target length.\n' +
    'Do not rewrite the sentences that remain — keep their original wording. Return only the shortened script, ' +
    'and stay within the 300-400 word range.',

  expand:
    'Expand this script by adding new sentences for context, examples, and smoother transitions, following these rules:\n' +
    '1. Do not remove or rewrite any existing sentence — only insert new material.\n' +
    '2. Keep the existing hook and CTA exactly as they are.\n' +
    '3. New material must match the existing tone and voice.\n' +
    'Return only the expanded script.',

  trend_idea:
    'Generate ONE new short-form script concept based on current trends for our target niche and language. ' +
    'The concept must follow these script-writing rules:\n' +
    '1. Hook — a strong attention-grabbing opener in the first line.\n' +
    '2. Engagement — emotional, relatable, conversational language throughout.\n' +
    '3. CTA — a clear call to action at the end.\n' +
    'Include:\n' +
    '1) 🔥 Viral Hooks (3 options, under 12 words each, in the target language)\n' +
    '2) 💡 Trend Analysis & Script Outline (why this works right now, with a beat-by-beat outline: hook → build → payoff → CTA)\n' +
    '3) 📢 Viral Captions & Hashtags tailored for our target audience reach (e.g., if language is Tamil, provide high-reach ' +
    'Tamil captions, slang, and cultural hashtags).\n\n' +
    'Output everything formatted cleanly in the target audience language.',
};