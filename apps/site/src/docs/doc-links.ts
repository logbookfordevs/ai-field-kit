export type AssistantProvider = 'chatgpt' | 'claude';

export const publicOrigin = 'https://ai-field-kit.logbookfordevs.com';
export const markdownPath = (id: string) => `/docs/${encodeURIComponent(id)}.md`;

export function assistantUrl(provider: AssistantProvider, { id, title }: { id: string; title: string }, origin = publicOrigin) {
  const url = new URL(provider === 'claude' ? 'https://claude.ai/new' : 'https://chatgpt.com/');
  const source = new URL(markdownPath(id), origin).href;
  url.searchParams.set('q', `Read the AI Field Kit documentation “${title}” at ${source} so you can help me with it. If you cannot access the page, ask me to paste its Markdown rather than guessing what it says.`);
  return url.href;
}

export function isPublicDocsHost(origin: string) {
  return new URL(origin).origin === publicOrigin;
}
