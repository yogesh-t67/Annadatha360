import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import {
  ArrowRight,
  Bug,
  CalendarClock,
  Droplet,
  Leaf,
  MessageCircle,
  Mic,
  Send,
  Smartphone,
  Square,
  TriangleAlert,
  Volume2,
} from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { MicButton } from '../../components/MicButton';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { AskStackParamList } from '../../navigation/types';
import { useFarmStore } from '../../store/farmStore';
import { askAssistant } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import { speak, stopSpeaking } from '../../voice/speech';
import { SpeechInputError, useSpeechInput } from '../../voice/useSpeechInput';

const commonQuestions = [
  { key: 'yellowLeaves', icon: Leaf },
  { key: 'whenIrrigate', icon: Droplet },
  { key: 'insects', icon: Bug },
  { key: 'whenSell', icon: CalendarClock },
] as const;

const MIC_ERROR_KEYS: Record<SpeechInputError, string> = {
  unavailable: 'voice.micUnavailable',
  'not-allowed': 'voice.micDenied',
  'no-speech': 'voice.noSpeech',
  'language-not-supported': 'voice.languageNotSupported',
  other: 'errors.generic',
};

export function VoiceAssistantScreen() {
  const { t, i18n } = useTranslation();
  const { navigation, open } = useAppNavigation();
  const route = useRoute<RouteProp<AskStackParamList, 'Voice'>>();
  const voiceEnabled = useFarmStore((s) => s.voiceEnabled);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<number | undefined>();
  const [asking, setAsking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // Re-check on focus: the farmer may have just come back from verifying their phone.
  useFocusEffect(
    useCallback(() => {
      hasSession().then(setSignedIn);
    }, []),
  );

  const readAloud = useCallback(
    (text: string) => {
      setSpeaking(true);
      speak(text, i18n.language, () => setSpeaking(false));
    },
    [i18n.language],
  );

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || asking) return;
      if (!(await hasSession())) {
        setSignedIn(false);
        return;
      }
      stopSpeaking();
      setAsking(true);
      setErrorKey(null);
      setAnswer(null);
      try {
        const res = await askAssistant(q, threadId);
        setThreadId(res.thread.id);
        setAnswer(res.reply.content);
        if (voiceEnabled) readAloud(res.reply.content);
      } catch (e) {
        setErrorKey(errorMessageKey(e));
      } finally {
        setAsking(false);
      }
    },
    [asking, threadId, voiceEnabled, readAloud],
  );

  const speech = useSpeechInput(i18n.language, (transcript) => {
    setQuestion(transcript);
    ask(transcript);
  });

  const incoming = route.params?.question;
  useEffect(() => {
    if (incoming) {
      setQuestion(incoming);
      setAnswer(null);
    }
  }, [incoming]);

  useEffect(() => () => stopSpeaking(), []);

  function onMicPress() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    stopSpeaking();
    setErrorKey(null);
    speech.start();
  }

  return (
    <ScreenContainer>
      <Text variant="h1">{t('voice.title')}</Text>
      <MicButton
        accessibilityLabel={speech.listening ? t('voice.tapToStop') : t('voice.prompt')}
        onPress={onMicPress}
      />
      <Text variant="body" align="center" color={theme.color.text.muted} style={{ marginTop: -theme.spacing.xs }}>
        {speech.listening ? t('voice.listening') : t('voice.prompt')}
      </Text>
      {speech.listening && speech.partial ? (
        <Text variant="bodyStrong" align="center">
          {speech.partial}
        </Text>
      ) : null}
      {speech.error ? <Notice icon={Mic} message={t(MIC_ERROR_KEYS[speech.error])} /> : null}

      {signedIn === false ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('voice.signInNeeded')}</Text>
          <Button
            label={t('voice.verifyNow')}
            icon={Smartphone}
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      ) : null}

      <TextField
        value={question}
        onChangeText={(v) => {
          setQuestion(v);
          setAnswer(null);
        }}
        placeholder={t('voice.placeholder')}
        multiline
        editable={!asking}
      />

      <Text variant="h2">{t('voice.commonQuestions')}</Text>
      <View style={{ gap: theme.spacing.xs }}>
        {commonQuestions.map((q) => (
          <Pressable
            key={q.key}
            accessibilityRole="button"
            onPress={() => {
              setQuestion(t(`voice.questions.${q.key}`));
              setAnswer(null);
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
            <q.icon size={20} color={theme.color.surface.brandDeep} strokeWidth={2} />
            <Text variant="bodyStrong" color={theme.color.text.secondary} style={{ flex: 1 }}>
              {t(`voice.questions.${q.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        label={asking ? t('voice.thinking') : t('voice.getAnswer')}
        trailingIcon={Send}
        loading={asking}
        disabled={!question.trim() || asking}
        onPress={() => ask(question)}
      />

      {errorKey ? <Notice icon={TriangleAlert} message={t(errorKey)} /> : null}

      {answer ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <MessageCircle size={20} color={theme.color.surface.brandDeep} strokeWidth={2.25} />
            <Text variant="h2">{t('voice.answerTitle')}</Text>
          </View>
          <Text variant="body" color={theme.color.text.secondary}>
            {answer}
          </Text>
          <Button
            label={speaking ? t('voice.stopSpeaking') : t('voice.listen')}
            icon={speaking ? Square : Volume2}
            variant="soft"
            compact
            onPress={() => {
              if (speaking) {
                stopSpeaking();
                setSpeaking(false);
              } else {
                readAloud(answer);
              }
            }}
          />
          <Button label={t('voice.viewDiagnosis')} variant="secondary" compact trailingIcon={ArrowRight} onPress={() => open('Diagnosis')} />
        </Card>
      ) : null}
    </ScreenContainer>
  );
}
