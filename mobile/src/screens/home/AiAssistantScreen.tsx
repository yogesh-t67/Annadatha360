import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Mic, Send } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../../theme';
import { Stack, Text } from '../../components/primitives';

export function AiAssistantScreen() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const suggestions = t('aiAssistant.suggestions', { returnObjects: true }) as string[];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.surface.sunken }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ padding: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
          <Text variant="h1">{t('aiAssistant.title')}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md, flexGrow: 1 }}>
          <Stack direction="row" gap="sm" align="flex-start" style={{ maxWidth: '85%' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: theme.radius.full,
                backgroundColor: theme.color.interactive.primaryBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={18} color={theme.color.text.inverse} strokeWidth={2} />
            </View>
            <View
              style={{
                backgroundColor: theme.color.surface.raised,
                borderRadius: theme.radius.md,
                borderTopLeftRadius: theme.radius.sm,
                padding: theme.spacing.sm,
                flex: 1,
                borderWidth: 1,
                borderColor: theme.color.border.default,
              }}
            >
              <Text variant="body">{t('aiAssistant.greeting')}</Text>
            </View>
          </Stack>

          <Stack gap="xs" style={{ marginTop: 'auto' }}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => setDraft(suggestion)}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  maxWidth: '92%',
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.full,
                  borderWidth: 1.5,
                  borderColor: theme.color.interactive.secondaryBorder,
                  backgroundColor: pressed ? theme.color.surface.sunken : theme.color.surface.raised,
                })}
              >
                <Text variant="caption" weight="medium" color={theme.color.interactive.secondaryText}>
                  {suggestion}
                </Text>
              </Pressable>
            ))}
          </Stack>
        </ScrollView>

        <Stack
          direction="row"
          gap="xs"
          align="center"
          style={{
            padding: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.color.border.default,
            backgroundColor: theme.color.surface.raised,
          }}
        >
          <View
            style={{
              flex: 1,
              height: theme.touchTarget.minimum,
              borderRadius: theme.radius.full,
              borderWidth: 1.5,
              borderColor: theme.color.border.default,
              paddingHorizontal: theme.spacing.md,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('aiAssistant.inputPlaceholder')}
              placeholderTextColor={theme.color.text.tertiary}
              accessibilityLabel={t('aiAssistant.inputPlaceholder')}
              style={{ fontSize: theme.typography.body.fontSize, color: theme.color.text.primary }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={draft ? 'Send' : t('aiAssistant.micHint')}
            style={({ pressed }) => ({
              width: theme.touchTarget.minimum,
              height: theme.touchTarget.minimum,
              borderRadius: theme.radius.full,
              backgroundColor: pressed ? theme.color.interactive.primaryBgPressed : theme.color.interactive.primaryBg,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            {draft ? (
              <Send size={20} color={theme.color.text.inverse} strokeWidth={2} />
            ) : (
              <Mic size={20} color={theme.color.text.inverse} strokeWidth={2} />
            )}
          </Pressable>
        </Stack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
