import React from 'react';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { EmptyState } from '@/src/components/EmptyState';
import { useLanguage } from '@/src/context/LanguageContext';

interface Props {
  title?: string;
  message?: string;
}

export function PlaceholderScreen({ title, message }: Props) {
  const { t } = useLanguage();
  return (
    <ScreenContainer>
      <EmptyState
        title={title ?? t('common.loading')}
        message={message ?? ''}
      />
    </ScreenContainer>
  );
}
