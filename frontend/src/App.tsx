import * as React from 'react';
import { useState } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  Pivot,
  PivotItem,
  TextField,
  Separator,
  Image as FluentImage,
  ImageFit,
  Spinner
} from '@fluentui/react';
import { analyzeFile, analyzeUrl, AnalyzeResult } from './api';
import { VerdictCard } from './components/VerdictCard';
import { ReasonsList } from './components/ReasonsList';
import { MetadataTable } from './components/MetadataTable';
import { MetricsChart } from './components/MetricsChart';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function onAnalyzeFile() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeFile(file);
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze file');
    } finally {
      setLoading(false);
    }
  }

  async function onAnalyzeUrl() {
    if (!imageUrl) return;
    setLoading(true);
    setError(null);
    setPreviewUrl(imageUrl);
    try {
      const res = await analyzeUrl(imageUrl);
      setResult(res);
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze URL');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack tokens={{ childrenGap: 16 }} styles={{ root: { maxWidth: 1200, margin: '0 auto', padding: 16 } }}>
      <Text variant="xxLarge">AI Image Generation Detector</Text>
      <Text variant="medium" styles={{ root: { color: '#666' } }}>
        Prototype dashboard using metadata and simple heuristics (entropy, noise, blockiness) to flag possible AI generation.
      </Text>

      <Pivot>
        <PivotItem headerText="Upload">
          <Stack horizontal wrap tokens={{ childrenGap: 24 }} styles={{ root: { marginTop: 12 } }}>
            <Stack tokens={{ childrenGap: 8 }} styles={{ root: { minWidth: 260, maxWidth: 420, flex: 1 } }}>
              <input type="file" accept="image/*" onChange={onPickFile} />
              <PrimaryButton text="Analyze File" onClick={onAnalyzeFile} disabled={!file || loading} />
              {error && <Text styles={{ root: { color: 'crimson' } }}>{error}</Text>}
            </Stack>
            <PreviewPanel previewUrl={previewUrl} loading={loading} />
          </Stack>
        </PivotItem>

        <PivotItem headerText="From URL">
          <Stack horizontal wrap tokens={{ childrenGap: 24 }} styles={{ root: { marginTop: 12 } }}>
            <Stack tokens={{ childrenGap: 8 }} styles={{ root: { minWidth: 260, maxWidth: 420, flex: 1 } }}>
              <TextField
                label="Image URL"
                value={imageUrl}
                onChange={(_, v) => setImageUrl(v || '')}
                placeholder="https://..."
              />
              <PrimaryButton text="Analyze URL" onClick={onAnalyzeUrl} disabled={!imageUrl || loading} />
              {error && <Text styles={{ root: { color: 'crimson' } }}>{error}</Text>}
            </Stack>
            <PreviewPanel previewUrl={previewUrl} loading={loading} />
          </Stack>
        </PivotItem>

        <PivotItem headerText="Results">
          <ResultsSection result={result} />
        </PivotItem>
      </Pivot>

      <Separator />
      <Footer />
    </Stack>
  );
}

function PreviewPanel({ previewUrl, loading }: { previewUrl: string | null; loading: boolean }) {
  return (
    <Stack tokens={{ childrenGap: 8 }} styles={{ root: { minWidth: 260, maxWidth: 600, flex: 2 } }}>
      <Text variant="large">Preview</Text>
      <div style={{ position: 'relative', border: '1px solid #e1e1e1', borderRadius: 8, minHeight: 200 }}>
        {previewUrl ? (
          <FluentImage src={previewUrl} imageFit={ImageFit.contain} maximizeFrame styles={{ root: { height: 320 } }} />
        ) : (
          <Text styles={{ root: { color: '#666', padding: 12, display: 'block' } }}>No image selected.</Text>
        )}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)' }}>
            <Spinner label="Analyzing..." />
          </div>
        )}
      </div>
    </Stack>
  );
}

function ResultsSection({ result }: { result: AnalyzeResult | null }) {
  if (!result) {
    return <Text styles={{ root: { color: '#666' } }}>Upload an image or enter a URL, then run analysis to see results.</Text>;
  }
  return (
    <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 12 } }}>
      <VerdictCard label={result.label} score={result.score} />
      <Stack horizontal wrap horizontalAlign="space-between" tokens={{ childrenGap: 16 }}>
        <Stack styles={{ root: { minWidth: 280, flex: 1 } }}>
          <ReasonsList reasons={result.reasons || []} />
        </Stack>
        <Stack styles={{ root: { minWidth: 280, flex: 1 } }}>
          <MetricsChart metrics={result.metrics || {}} />
        </Stack>
      </Stack>
      <MetadataTable data={result.metadata || {}} />
    </Stack>
  );
}

function Footer() {
  return (
    <Text variant="xSmall" styles={{ root: { color: '#999' } }}>
      This prototype uses simple heuristics and metadata cues. Results are best-effort and not definitive.
    </Text>
  );
}
