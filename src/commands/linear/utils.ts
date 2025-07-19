export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString();

export const stripMarkdown = (text?: string) =>
  (text ?? '').trim() || '—'; 