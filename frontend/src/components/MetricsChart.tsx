import * as React from 'react';
import { Text, Stack } from '@fluentui/react';

// Simple horizontal bars without extra deps
export function MetricsChart({ metrics }: { metrics: Record<string, number> }) {
  const entries = Object.entries(metrics || {});
  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="large">Heuristic Metrics</Text>
      {entries.length === 0 && <Text variant="small" styles={{ root: { color: '#666' } }}>No metrics.</Text>}
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text variant="smallPlus">{k}</Text>
            <Text variant="smallPlus">{Math.round(v * 100)}%</Text>
          </div>
          <div style={{ background: '#f3f3f3', height: 8, borderRadius: 4 }}>
            <div style={{ width: `${Math.min(100, Math.max(0, v * 100))}%`, height: '100%', background: '#0078d4', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </Stack>
  );
}
