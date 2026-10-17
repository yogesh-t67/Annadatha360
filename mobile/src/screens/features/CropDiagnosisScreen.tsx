import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  Bug,
  Camera,
  CircleCheck,
  CircleHelp,
  Eye,
  Flower2,
  Images,
  Leaf,
  Lock,
  Phone,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sprout,
  Square,
  TriangleAlert,
  Volume2,
  Wrench,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { theme, Tint } from '../../theme';
import { Button, Card, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero } from '../../components/Blocks';
import { CropImage } from '../../components/CropImage';
import { Notice } from '../../components/Notice';
import { useFarmStore } from '../../store/farmStore';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { createDiagnosis } from '../../api/endpoints';
import { errorMessageKey } from '../../api/errorMessage';
import { hasSession } from '../../api/tokens';
import type { ActionType, DiagnosisOut, DiagnosisResult } from '../../api/types';
import { speak, stopSpeaking } from '../../voice/speech';

/** Tap-to-add symptoms: farmers who can't type still tell the AI what they noticed. */
const symptoms: { key: string; icon: LucideIcon; tint: Tint }[] = [
  { key: 'yellowLeaves', icon: Leaf, tint: 'sun' },
  { key: 'brownSpots', icon: Leaf, tint: 'clay' },
  { key: 'insects', icon: Bug, tint: 'leaf' },
  { key: 'wilting', icon: Flower2, tint: 'stone' },
];

const ACTION_ICON: Record<ActionType, LucideIcon> = {
  cultural: Wrench,
  organic: Sprout,
  chemical: ShieldAlert,
  monitor: Eye,
};

/** Longest side sent to the server (docs/api/diagnosis.md): enough detail, small upload on rural networks. */
const MAX_SIDE = 1500;

type TFn = (key: string, params?: Record<string, string>) => string;

/** First thing the farmer hears/sees: is this photo of their crop? null when the photo can't tell. */
function cropCheck(r: DiagnosisResult, cropName: string, t: TFn): { ok: boolean; text: string } | null {
  if (!r.is_plant_image) return { ok: false, text: t('diagnosis.cropCheck.notPlant') };
  if (r.matches_expected_crop) return { ok: true, text: t('diagnosis.cropCheck.yours', { crop: cropName }) };
  if (r.crop_identified) {
    return { ok: false, text: t('diagnosis.cropCheck.other', { seen: r.crop_identified, crop: cropName }) };
  }
  return { ok: false, text: t('diagnosis.cropCheck.unclear', { crop: cropName }) };
}

/** What gets read aloud: crop check, the problem, the summary, then the steps. */
function spokenText(r: DiagnosisResult, cropName: string, t: TFn): string {
  const badPhoto = !r.is_plant_image || r.image_quality === 'poor';
  return [
    cropCheck(r, cropName, t)?.text ?? '',
    r.issue.category !== 'none' && !badPhoto ? r.issue.name : '',
    r.summary,
    ...(badPhoto ? [] : r.actions.map((a) => a.step)),
  ]
    .filter(Boolean)
    .join('. ');
}

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const { width, height } = asset;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return saved.uri;
}

export function CropDiagnosisScreen() {
  const { t, i18n } = useTranslation();
  const { navigation, open } = useAppNavigation();
  const crop = useFarmStore((s) => s.crop);
  const voiceEnabled = useFarmStore((s) => s.voiceEnabled);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisOut | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      hasSession().then(setSignedIn);
      return () => stopSpeaking();
    }, []),
  );
  useEffect(() => () => stopSpeaking(), []);

  // Language switched while a result is showing: the AI text is in the old language, so check the same
  // photo again and get the result in the new one.
  const prevLanguage = useRef(i18n.language);
  useEffect(() => {
    if (prevLanguage.current === i18n.language) return;
    prevLanguage.current = i18n.language;
    stopSpeaking();
    setSpeaking(false);
    setErrorKey(null);
    if (diagnosis && photoUri && !busy) check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  async function getPhoto(source: 'camera' | 'gallery') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setDenied(true);
      return;
    }
    setDenied(false);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    try {
      setPhotoUri(await shrink(result.assets[0]));
    } catch {
      setPhotoUri(result.assets[0].uri); // resizing failed: send the original, the server still accepts ≤ 5 MB
    }
    setDiagnosis(null);
    setErrorKey(null);
  }

  async function check() {
    if (!photoUri) return;
    setBusy(true);
    setErrorKey(null);
    setDiagnosis(null);
    stopSpeaking();
    setSpeaking(false);
    try {
      // Notes go to the AI in English-or-Telugu as the farmer sees them.
      const notes = picked.map((k) => t(`diagnosis.symptoms.${k}`)).join(', ');
      const result = await createDiagnosis({ uri: photoUri }, { cropCode: crop, notes });
      setDiagnosis(result);
      // Read the answer aloud straight away (unless the farmer turned voice off in Settings).
      if (voiceEnabled) {
        setSpeaking(true);
        speak(spokenText(result.result, t(`crops.${crop}`), t), i18n.language, () => setSpeaking(false));
      }
    } catch (e) {
      setErrorKey(errorMessageKey(e));
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    stopSpeaking();
    setSpeaking(false);
    setPhotoUri(null);
    setPicked([]);
    setDiagnosis(null);
    setErrorKey(null);
  }

  function toggleSymptom(key: string) {
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  function listen(text: string) {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, i18n.language, () => setSpeaking(false));
  }

  if (signedIn === false) {
    return (
      <ScreenContainer showBack>
        <Text variant="h1">{t('diagnosis.title')}</Text>
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{t('diagnosis.signInNeeded')}</Text>
          <Button
            label={t('voice.verifyNow')}
            icon={Smartphone}
            compact
            onPress={() => navigation.navigate('VerifyPhone', { returnTo: 'back' })}
          />
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('diagnosis.title')}</Text>

      {/* 1. Photo */}
      <Hero icon={photoUri ? undefined : Camera}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            accessibilityIgnoresInvertColors
            style={{ width: '100%', height: 240, borderRadius: theme.radius.md }}
            resizeMode="cover"
          />
        ) : (
          <Text variant="bodyStrong" align="center" color={theme.color.text.secondary}>
            {t('diagnosis.photoPrompt')}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <Button
              label={photoUri ? t('diagnosis.retake') : t('diagnosis.openCamera')}
              icon={Camera}
              compact
              disabled={busy}
              onPress={() => getPhoto('camera')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={t('diagnosis.gallery')}
              icon={Images}
              variant="secondary"
              compact
              disabled={busy}
              onPress={() => getPhoto('gallery')}
            />
          </View>
        </View>
        {!photoUri ? (
          <Text variant="caption" align="center" color={theme.color.text.muted}>
            {t('diagnosis.photoTip')}
          </Text>
        ) : null}
      </Hero>
      {denied ? <Notice icon={Lock} message={t('diagnosis.cameraDenied')} /> : null}

      {/* 2. What the farmer noticed (optional) + check */}
      {photoUri && !diagnosis ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <CropImage code={crop} size={44} />
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {t('diagnosis.forCrop', { crop: t(`crops.${crop}`) })}
            </Text>
          </View>
          <Text variant="h2">{t('diagnosis.chooseSymptom')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {symptoms.map((s) => {
              const on = picked.includes(s.key);
              const Icon = s.icon;
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  disabled={busy}
                  onPress={() => toggleSymptom(s.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 48,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.full,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? theme.color.surface.brand : theme.color.tint[s.tint].border,
                    backgroundColor: on ? theme.color.surface.brandSoft : theme.color.tint[s.tint].bg,
                  }}
                >
                  <Icon size={18} color={theme.color.surface.brandDeep} strokeWidth={2.25} />
                  <Text variant="bodyStrong">{t(`diagnosis.symptoms.${s.key}`)}</Text>
                  {on ? <CircleCheck size={18} color={theme.color.surface.brand} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>

          {busy ? (
            <Card style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg }}>
              <ActivityIndicator size="large" color={theme.color.surface.brand} />
              <Text variant="bodyStrong" align="center">
                {t('diagnosis.checking')}
              </Text>
              <Text variant="caption" align="center" color={theme.color.text.muted}>
                {t('diagnosis.checkingHint')}
              </Text>
            </Card>
          ) : (
            <Button label={t('diagnosis.check')} icon={ScanSearch} onPress={check} />
          )}
        </>
      ) : null}

      {errorKey ? <Notice icon={TriangleAlert} message={t(errorKey)} /> : null}

      {/* 3. Result */}
      {diagnosis ? (
        <DiagnosisResultView
          diagnosis={diagnosis}
          crop={crop}
          speaking={speaking}
          onListen={listen}
          onRetake={startOver}
          onExpert={() => open('Expert')}
        />
      ) : null}
    </ScreenContainer>
  );
}

function DiagnosisResultView({
  diagnosis,
  crop,
  speaking,
  onListen,
  onRetake,
  onExpert,
}: {
  diagnosis: DiagnosisOut;
  crop: string;
  speaking: boolean;
  onListen: (text: string) => void;
  onRetake: () => void;
  onExpert: () => void;
}) {
  const { t } = useTranslation();
  const r = diagnosis.result;
  const badPhoto = !r.is_plant_image || r.image_quality === 'poor';

  const status = badPhoto
    ? { icon: Camera, label: t('diagnosis.status.retake'), fg: theme.color.status.warningText, bg: theme.color.status.warningBg }
    : r.health_status === 'healthy'
      ? { icon: ShieldCheck, label: t('diagnosis.status.healthy'), fg: theme.color.status.successText, bg: theme.color.status.successBg }
      : r.health_status === 'problem_found'
        ? { icon: TriangleAlert, label: t('diagnosis.status.problem'), fg: theme.color.status.dangerText, bg: theme.color.status.dangerBg }
        : { icon: CircleHelp, label: t('diagnosis.status.uncertain'), fg: theme.color.status.infoText, bg: theme.color.status.infoBg };
  const StatusIcon = status.icon;

  const cropName = t(`crops.${crop}`);
  const check = cropCheck(r, cropName, t);
  const spoken = spokenText(r, cropName, t);

  return (
    <View style={{ gap: theme.spacing.md }}>
      {/* 1. Is this the farmer's crop? */}
      {check ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            borderRadius: theme.radius.lg,
            borderWidth: 2,
            borderColor: check.ok ? theme.color.tint.leaf.border : theme.color.status.warningBorder,
            backgroundColor: check.ok ? theme.color.status.successBg : theme.color.status.warningBg,
          }}
        >
          <CropImage code={crop} size={48} />
          <Text variant="bodyStrong" color={check.ok ? theme.color.status.successText : theme.color.status.warningText} style={{ flex: 1 }}>
            {check.text}
          </Text>
          {check.ok ? (
            <CircleCheck size={26} color={theme.color.status.successText} strokeWidth={2.5} />
          ) : (
            <TriangleAlert size={26} color={theme.color.status.warningText} strokeWidth={2.5} />
          )}
        </View>
      ) : null}

      <Card style={{ gap: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            alignSelf: 'flex-start',
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: theme.radius.full,
            backgroundColor: status.bg,
          }}
        >
          <StatusIcon size={18} color={status.fg} strokeWidth={2.5} />
          <Text variant="bodyStrong" color={status.fg}>
            {status.label}
          </Text>
        </View>

        {!badPhoto && r.issue.category !== 'none' ? (
          <View style={{ gap: 2 }}>
            <Text variant="h2">{r.issue.name}</Text>
            <Text variant="caption" color={theme.color.text.muted}>
              {`${t(`diagnosis.category.${r.issue.category}`)} · ${t(`diagnosis.confidence.${r.issue.confidence}`)}`}
            </Text>
          </View>
        ) : null}

        <Text variant="body">{r.summary}</Text>

        <Button
          label={speaking ? t('voice.stopSpeaking') : t('voice.listen')}
          icon={speaking ? Square : Volume2}
          variant="soft"
          compact
          onPress={() => onListen(spoken)}
        />
      </Card>

      {!badPhoto && r.actions.length > 0 ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="h2">{t('diagnosis.whatToDo')}</Text>
          {r.actions.map((a, i) => {
            const Icon = ACTION_ICON[a.type];
            const chemical = a.type === 'chemical';
            return (
              <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: chemical ? theme.color.status.warningBg : theme.color.surface.brandSoft,
                  }}
                >
                  <Icon
                    size={18}
                    color={chemical ? theme.color.status.warningText : theme.color.surface.brandDeep}
                    strokeWidth={2.25}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="caption" weight="bold" color={theme.color.text.muted}>
                    {t(`diagnosis.actionType.${a.type}`)}
                  </Text>
                  <Text variant="body">{a.step}</Text>
                </View>
              </View>
            );
          })}
          {r.actions.some((a) => a.type === 'chemical') ? (
            <Notice icon={ShieldAlert} message={t('diagnosis.chemicalSafety')} />
          ) : null}
        </Card>
      ) : null}

      {!badPhoto && r.symptoms.length > 0 ? (
        <BulletCard title={t('diagnosis.seenInPhoto')} items={r.symptoms} />
      ) : null}
      {!badPhoto && r.prevention.length > 0 ? (
        <BulletCard title={t('diagnosis.prevention')} items={r.prevention} />
      ) : null}

      {r.consult_expert ? (
        <Card tone="soft" style={{ gap: theme.spacing.sm }}>
          <Text variant="bodyStrong">{t('diagnosis.consultExpert')}</Text>
          <Button label={t('services.expert')} icon={Phone} compact onPress={onExpert} />
        </Card>
      ) : null}

      <Button label={t('diagnosis.newCheck')} icon={RotateCcw} variant="secondary" onPress={onRetake} />
      <Notice message={t('diagnosis.disclaimer')} />
    </View>
  );
}

function BulletCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <Text variant="h2">{title}</Text>
      {items.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          <Text variant="body" color={theme.color.surface.brand}>
            •
          </Text>
          <Text variant="body" style={{ flex: 1 }}>
            {s}
          </Text>
        </View>
      ))}
    </Card>
  );
}
