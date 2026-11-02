import { chapterAliases, chapters, retiredChapters } from './chapters.ts';

export const chapterUrl = (id: string) => `/docs?chapter=${encodeURIComponent(id)}`;

export function retiredChapter(id: string | null) {
  return retiredChapters.find((chapter) => chapter.id === id);
}

export function canonicalChapterId(id: string | null) {
  return id !== null && Object.hasOwn(chapterAliases, id) ? chapterAliases[id as keyof typeof chapterAliases] : id;
}

export function resolveChapter(id: string | null) {
  const requested = retiredChapter(id) ? 'legacy' : canonicalChapterId(id);
  return chapters.find((chapter) => chapter.id === requested) ?? chapters[0];
}
