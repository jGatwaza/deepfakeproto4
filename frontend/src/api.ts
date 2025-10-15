export type AnalyzeResult = {
  score: number;
  label: string;
  reasons: string[];
  metadata: Record<string, any>;
  metrics: Record<string, number>;
};

export async function analyzeFile(file: File): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: form
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function analyzeUrl(url: string): Promise<AnalyzeResult> {
  const res = await fetch('/api/analyze-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
