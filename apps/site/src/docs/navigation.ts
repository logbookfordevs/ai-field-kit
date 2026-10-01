import { chapters, retiredChapters } from './chapters.ts';

export const chapterUrl = (id: string) => `/docs?chapter=${encodeURIComponent(id)}`;

export function retiredChapter(id: string | null) {
  return retiredChapters.find((chapter) => chapter.id === id);
}

export function resolveChapter(id: string | null) {
  const requested = retiredChapter(id) ? 'legacy' : id;
  return chapters.find((chapter) => chapter.id === requested) ?? chapters[0];
}
