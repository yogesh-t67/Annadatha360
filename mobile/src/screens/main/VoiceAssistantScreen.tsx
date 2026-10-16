import React, { useEffect, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteProp, useRoute } from '@react-navigation/native';
import * as Speech from 'expo-speech';

import { theme } from '../../theme';
import { Button, Card, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { MicButton } from '../../components/MicButton';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { AskStackParamList } from '../../navigation/types';

const commonQuestions = [
  { key: 'yellowLeaves', emoji: '🍂' },
  { key: 'whenIrrigate', emoji: '🚿' },
  { key: 'insects', emoji: '🐛' },
  { key: 'whenSell', emoji: '🏷️' },
] as const;

export function VoiceAssistantScreen() {
  const { t, i18n } = useTranslation();
  const { open } = useAppNavigation();
  const route = useRoute<RouteProp<AskStackParamList, 'Voice'>>();
  const [question, setQuestion] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [micMessage, setMicMessage] = useState(false);

  const incoming = route.params?.question;
  useEffect(() => {
    if (incoming) {
      setQuestion(incoming);
      setShowAnswer(false);
    }
  }, [incoming]);

  useEffect(() => () => void Speech.stop(), []);

  function listen() {
    Speech.stop();
    Speech.speak(t('voice.listenText'), { language: i18n.language === 'te' ? 'te-IN' : 'en-IN' });
  }

  return (
    <ScreenContainer>
      <Text variant="h1">{t('voice.title')}</Text>
      <MicButton accessibilityLabel={t('voice.prompt')} onPress={() => setMicMessage(true)} />
      <Text variant="body" align="center" color={theme.color.text.muted} style={{ marginTop: -theme.spacing.xs }}>
        {t('voice.prompt')}
      </Text>
      {micMessage ? <Notice emoji="🎙️" message={t('voice.micUnavailable')} /> : null}

      <TextField
        value={question}
        onChangeText={(v) => {
          setQuestion(v);
          setShowAnswer(false);
        }}
        placeholder={t('voice.placeholder')}
        multiline
      />

      <Text variant="h2">{t('voice.commonQuestions')}</Text>
      <View style={{ gap: theme.spacing.xs }}>
        {commonQuestions.map((q) => (
          <Pressable
            key={q.key}
            accessibilityRole="button"
            onPress={() => {
              setQuestion(t(`voice.questions.${q.key}`));
              setShowAnswer(false);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              minHeight: 54,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.color.border.default,
              backgroundColor: pressed ? theme.color.surface.brandSoft : theme.color.surface.base,
            })}
          >
            <RNText style={{ fontSize: 20 }}>{q.emoji}</RNText>
            <Text variant="bodyStrong" color={theme.color.text.secondary} style={{ flex: 1 }}>
              {t(`voice.questions.${q.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        label={t('voice.getAnswer')}
        trailing="➤"
        disabled={!question.trim()}
        onPress={() => setShowAnswer(true)}
      />

      {showAnswer ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="h2">{`💬 ${t('voice.sampleTitle')}`}</Text>
          <Text variant="body" color={theme.color.text.secondary}>
            {t('voice.sampleBody')}
          </Text>
          <Button label={t('voice.listen')} emoji="🔊" variant="soft" compact onPress={listen} />
          <Button label={t('voice.viewDiagnosis')} variant="secondary" compact trailing="→" onPress={() => open('Diagnosis')} />
        </Card>
      ) : null}

      <Notice />
    </ScreenContainer>
  );
}
