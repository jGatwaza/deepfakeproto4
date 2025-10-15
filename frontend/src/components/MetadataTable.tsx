import * as React from 'react';
import { DetailsList, IColumn, SelectionMode, Text } from '@fluentui/react';

export function MetadataTable({ data }: { data: Record<string, any> }) {
  const rows = React.useMemo(() => flattenMetadata(data), [data]);

  const columns: IColumn[] = [
    { key: 'key', name: 'Key', fieldName: 'key', minWidth: 120, isResizable: true },
    { key: 'value', name: 'Value', fieldName: 'value', minWidth: 200, isResizable: true }
  ];

  return (
    <div>
      <Text variant="large">Metadata</Text>
      <DetailsList
        items={rows}
        columns={columns}
        selectionMode={SelectionMode.none}
        styles={{ root: { marginTop: 8, border: '1px solid #e1e1e1', borderRadius: 6 } }}
      />
    </div>
  );
}

function flattenMetadata(data: Record<string, any>): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];

  function walk(prefix: string, obj: any) {
    if (obj == null) return;
    if (typeof obj !== 'object') {
      out.push({ key: prefix, value: String(obj) });
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    } else {
      Object.entries(obj).forEach(([k, v]) => {
        walk(prefix ? `${prefix}.${k}` : k, v);
      });
    }
  }

  walk('', data);
  return out;
}
