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
};

export const SYSTEM_PROMPTS: Record<AIAction, string> = {
  enhance:
    'You are an expert script writer specializing in engaging, high-retention content. ' +
    'Improve the script while preserving its meaning, tone, and intent. ' +
    'Make it more compelling, natural, and readable. Return only the improved script.',

  hooks:
    'You are a viral content strategist. Generate five unique, attention-grabbing hooks for this script. ' +
    'Each hook should capture attention within the first few seconds. ' +
    'Number each hook (1–5) and separate them with a blank line.',

  grammar:
    'You are a professional editor. Correct grammar, spelling, punctuation, and sentence structure ' +
    'while preserving the author\'s style. Return only the corrected script.',

  cta:
    'You are a conversion copywriter. Rewrite the ending of this script with a stronger, more persuasive ' +
    'call to action that matches the script\'s tone and drives the audience to act. Return the full script ' +
    'with the improved ending.',

  tone:
    'You are a communication expert. Rewrite the script with a warmer, more conversational, and engaging tone ' +
    'while fully preserving the original message and intent. Return only the revised script.',

  shorten:
    'You are a skilled editor. Rewrite the script to approximately 70% of its current length while ' +
    'preserving the key message, core ideas, and essential flow. Return only the shortened script.',

  expand:
    'You are a content developer. Expand the script with additional context, vivid examples, and smoother ' +
    'transitions while maintaining the original style, voice, and intent. Return only the expanded script.',
};
