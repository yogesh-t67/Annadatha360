import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  UserRound,
  Volume2,
} from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Card, Text, TextField } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
type MicState = 'idle' | 'listening' | 'thinking' | 'speaking';
import { Notice } from '../../components/Notice';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { AskStackParamList } from '../../navigation/types';
import { useFarmStore } from '../../store/farmStore';
import { askAssistant, askAssistantVoice } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { AskOut } from '../../api/types';
import { speak, stopSpeaking, useVoicePhase } from '../../voice/speech';
import { AvatarMood, AvatarState, FarmerAvatar } from '../../components/FarmerAvatar';
import { SpeechInputError, useSpeechInput } from '../../voice/useSpeechInput';
import { RecorderError, useVoiceRecorder } from '../../voice/useVoiceRecorder';

const commonQuestions = [
  { key: 'yellowLeaves', icon: Leaf },
  { key: 'whenIrrigate', icon: Droplet },
  { key: 'insects', icon: Bug },
  { key: 'whenSell', icon: CalendarClock },
] as const;

const DEVICE_MIC_ERROR_KEYS: Record<SpeechInputError, string> = {
  unavailable: 'voice.micUnavailable',
  'not-allowed': 'voice.micDenied',
  'no-speech': 'voice.noSpeech',
  'language-not-supported': 'voice.languageNotSupported',
  other: 'errors.generic',
};

const RECORDER_ERROR_KEYS: Record<RecorderError, string> = {
  'not-allowed': 'voice.micDenied',
  'too-short': 'voice.tooShort',
  'no-speech': 'voice.noSpeech',
  failed: 'errors.generic',
};

export function VoiceAssistantScreen() {
  const { t, i18n } = useTranslation();
  const { navigation, open } = useAppNavigation();
  const route = useRoute<RouteProp<AskStackParamList, 'Voice'>>();
  const voiceEnabled = useFarmStore((s) => s.voiceEnabled);

  const [question, setQuestion] = useState('');
  /** What the AI heard / was asked, shown above the answer ("You asked: …"). */
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<number | undefined>();
  const [asking, setAsking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  /** The server can't hear audio (AI provider without voice): fall back to the phone's speech-to-text. */
  const [deviceSpeech, setDeviceSpeech] = useState(false);

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

  /** Last question that got an answer; re-asked when the farmer switches language. */
  const lastAsked = useRef<string | null>(null);
  /** Set when the question came from a "common question" chip, so it can be re-translated. */
  const [chipKey, setChipKey] = useState<string | null>(null);

  /** Shared by typed and spoken questions: send, show "You asked", show + read the answer. */
  const run = useCallback(
    async (send: () => Promise<AskOut>) => {
      if (!(await hasSession())) {
        setSignedIn(false);
        return;
      }
      stopSpeaking();
      setSpeaking(false);
      setAsking(true);
      setErrorKey(null);
      setAnswer(null);
      try {
        const res = await send();
        setThreadId(res.thread.id);
        lastAsked.current = res.message.content;
        setAsked(res.message.content);
        setAnswer(res.reply.content);
        if (voiceEnabled) readAloud(res.reply.content);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'voice_not_supported') {
          setDeviceSpeech(true);
          setErrorKey('voice.tryAgainMic');
        } else {
          setErrorKey(errorMessageKey(e));
        }
      } finally {
        setAsking(false);
      }
    },
    [voiceEnabled, readAloud],
  );

  const ask = useCallback(
    (text: string, opts: { newThread?: boolean } = {}) => {
      const q = text.trim();
      if (!q || asking) return;
      setAsked(q);
      return run(() => askAssistant(q, opts.newThread ? undefined : threadId));
    },
    [asking, threadId, run],
  );

  // Main path: record → the AI hears the audio directly (one step, good with Telugu).
  const recorder = useVoiceRecorder((uri) => {
    setAsked(null);
    setQuestion('');
    setChipKey(null);
    run(() => askAssistantVoice(uri, threadId));
  });

  // Fallback path: on-device speech-to-text, then a typed question.
  const speech = useSpeechInput(i18n.language, (transcript) => {
    setQuestion(transcript);
    setChipKey(null);
    ask(transcript);
  });

  const incoming = route.params?.question;
  useEffect(() => {
    if (incoming) {
      setQuestion(incoming);
      setChipKey(null);
      setAnswer(null);
      setAsked(null);
    }
  }, [incoming]);

  useEffect(() => () => stopSpeaking(), []);

  // Opened by tapping the farmer on Home: start listening straight away (one tap from Home to talking).
  const listenRequest = route.params?.listen;
  useEffect(() => {
    if (!listenRequest || recorder.recording || asking) return;
    stopSpeaking();
    setErrorKey(null);
    if (deviceSpeech) speech.start();
    else recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenRequest]);

  // Language switched: the AI answer on screen is in the old language. Re-translate a chip question and
  // ask again (fresh thread, so the reply is in the new language only).
  const prevLanguage = useRef(i18n.language);
  useEffect(() => {
    if (prevLanguage.current === i18n.language) return;
    prevLanguage.current = i18n.language;
    stopSpeaking();
    setSpeaking(false);
    setErrorKey(null);
    const q = chipKey ? t(`voice.questions.${chipKey}`) : question;
    if (chipKey) setQuestion(q);
    if (answer && lastAsked.current) {
      setThreadId(undefined);
      ask(chipKey ? q : lastAsked.current, { newThread: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const listening = deviceSpeech ? speech.listening : recorder.recording;
  const micState: MicState = listening ? 'listening' : asking ? 'thinking' : speaking ? 'speaking' : 'idle';
  // Avatar follows the same lifecycle; "speaking" comes from the actual audio (starts when the voice does).
  const voicePhase = useVoicePhase(); // 'preparing' while the Telugu server voice is generated
  const avatarState: AvatarState = listening
    ? 'listening'
    : asking || voicePhase === 'preparing'
      ? 'thinking'
      : voicePhase === 'playing'
        ? 'speaking'
        : 'idle';
  // Reaction after a turn: nothing heard → confused; error/busy → concerned; a normal answer → agree.
  const micErrorShown = deviceSpeech ? speech.error : recorder.error;
  const avatarMood: AvatarMood =
    errorKey === 'voice.noSpeech' || micErrorShown === 'no-speech' || micErrorShown === 'too-short'
      ? 'confused'
      : errorKey
        ? 'concerned'
        : 'agree';

  function onMicPress() {
    setErrorKey(null);
    if (micState === 'listening') {
      if (deviceSpeech) speech.stop();
      else recorder.stop(); // sends the recording
      return;
    }
    if (micState === 'speaking') {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (micState === 'thinking') return;
    if (deviceSpeech) speech.start();
    else recorder.start();
  }

  const status =
    micState === 'listening'
      ? t('voice.listening')
      : micState === 'thinking'
        ? t('voice.thinking')
        : micState === 'speaking'
          ? t('voice.speakingTapToStop')
          : t('voice.tapToSpeak');
  const hint =
    micState === 'listening'
      ? `${t('voice.tapAgainToSend')} · 0:${String(recorder.seconds).padStart(2, '0')}`
      : micState === 'idle'
        ? t('voice.speakHint')
        : null;

  const micErrorKey = deviceSpeech
    ? speech.error && DEVICE_MIC_ERROR_KEYS[speech.error]
    : recorder.error && RECORDER_ERROR_KEYS[recorder.error];

  return (
    <ScreenContainer>
      <Text variant="h1">{t('voice.title')}</Text>

      {/* The farmer is the voice button: green ring = tap to talk, red = listening (tap again to send). */}
      <FarmerAvatar
        state={avatarState}
        mood={avatarMood}
        size={150}
        onPress={onMicPress}
        disabled={asking}
        accessibilityLabel={status}
      />
      <View style={{ alignItems: 'center', gap: 2, marginTop: -theme.spacing.sm }} accessibilityLiveRegion="polite">
        <Text
          variant="h2"
          align="center"
          color={micState === 'listening' ? theme.color.status.dangerText : theme.color.text.primary}
        >
          {status}
        </Text>
        {hint ? (
          <Text variant="body" align="center" color={theme.color.text.muted}>
            {hint}
          </Text>
        ) : null}
      </View>
      {deviceSpeech && speech.listening && speech.partial ? (
        <Text variant="bodyStrong" align="center">
          {speech.partial}
        </Text>
      ) : null}
      {micErrorKey ? <Notice icon={Mic} message={t(micErrorKey)} /> : null}
      {errorKey ? <Notice icon={TriangleAlert} message={t(errorKey)} /> : null}

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

      {/* What was asked + the answer, right under the mic so the farmer sees it without scrolling. */}
      {asked && (asking || answer) ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'flex-start' }}>
          <UserRound size={18} color={theme.color.text.muted} strokeWidth={2.25} style={{ marginTop: 3 }} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={theme.color.text.muted}>
              {t('voice.youAsked')}
            </Text>
            <Text variant="bodyStrong">{asked}</Text>
          </View>
        </View>
      ) : null}

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

      {/* Typing is the secondary way in. */}
      <Text variant="h2" style={{ marginTop: theme.spacing.sm }}>
        {t('voice.orType')}
      </Text>
      <TextField
        value={question}
        onChangeText={(v) => {
          setQuestion(v);
          setChipKey(null);
        }}
        placeholder={t('voice.placeholder')}
        multiline
        editable={!asking}
      />
      <Button
        label={t('voice.getAnswer')}
        trailingIcon={Send}
        disabled={!question.trim() || asking || listening}
        onPress={() => ask(question)}
      />

      <Text variant="h2">{t('voice.commonQuestions')}</Text>
      <View style={{ gap: theme.spacing.xs }}>
        {commonQuestions.map((q) => (
          <Pressable
            key={q.key}
            accessibilityRole="button"
            disabled={asking || listening}
            onPress={() => {
              const text = t(`voice.questions.${q.key}`);
              setQuestion(text);
              setChipKey(q.key);
              ask(text); // one tap asks — no extra "Get answer" step
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
    </ScreenContainer>
  );
}
