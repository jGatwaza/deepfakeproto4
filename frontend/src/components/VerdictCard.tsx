import * as React from 'react';
import { Stack, Text, ProgressIndicator } from '@fluentui/react';

export function VerdictCard({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <Stack tokens={{ childrenGap: 8 }} styles={{ root: { padding: 12, border: '1px solid #e1e1e1', borderRadius: 8 } }}>
      <Text variant="xxLarge">{label}</Text>
      <Text variant="medium">Confidence: {pct}%</Text>
      <ProgressIndicator percentComplete={score} label="AI-likeness score" />
    </Stack>
  );
}
