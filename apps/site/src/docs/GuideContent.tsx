import type { MDXContent, MDXComponents } from 'mdx/types';
import type { ChapterId } from '@/docs/chapters.ts';

const documents = import.meta.glob<MDXContent>('./content/*.mdx', { eager: true, import: 'default' });

export default function GuideContent({ chapter, components }: { chapter: ChapterId; components: MDXComponents }) {
  const Content = documents[`./content/${chapter}.mdx`];
  return <Content components={components} />;
}
