import * as React from 'react';
import { Stack, Text } from '@fluentui/react';

export function ReasonsList({ reasons }: { reasons: string[] }) {
  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Text variant="large">Reasons</Text>
      {reasons.length === 0 ? (
        <Text variant="small" styles={{ root: { color: '#666' } }}>No specific red flags detected.</Text>
      ) : (
        reasons.map((r, i) => (
          <Text key={i} variant="small">• {r}</Text>
        ))
      )}
    </Stack>
  );
}
