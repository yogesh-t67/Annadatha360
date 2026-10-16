import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, FlaskConical, Phone, TrendingUp, UserRound, Droplet } from 'lucide-react-native';

import { theme } from '../../theme';
import { Button, Text } from '../../components/primitives';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Hero } from '../../components/Blocks';
import { SelectField } from '../../components/SelectField';
import { Notice } from '../../components/Notice';

const topics = [
  { value: 'cropDisease', icon: Bug },
  { value: 'fertilizer', icon: FlaskConical },
  { value: 'irrigation', icon: Droplet },
  { value: 'market', icon: TrendingUp },
] as const;
type TopicKey = (typeof topics)[number]['value'];

export function ExpertHelpScreen() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState<TopicKey>('cropDisease');
  const [requested, setRequested] = useState(false);

  return (
    <ScreenContainer showBack>
      <Text variant="h1">{t('expert.title')}</Text>
      <Hero icon={UserRound}>
        <Text variant="bodyStrong" align="center" color={theme.color.text.secondary}>
          {t('expert.notConnected')}
        </Text>
      </Hero>
      <SelectField
        label={t('expert.topic')}
        value={topic}
        options={topics.map((tp) => ({ value: tp.value, label: t(`expert.topics.${tp.value}`), icon: tp.icon }))}
        onChange={setTopic}
      />
      <Button label={t('expert.requestCallback')} icon={Phone} onPress={() => setRequested(true)} />
      {requested ? <Notice message={t('expert.noCallback')} /> : null}
    </ScreenContainer>
  );
}
