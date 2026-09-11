import remarkGfm from 'remark-gfm';
import type { Root, RootContent } from 'mdast';
import type { Plugin, PluggableList } from 'unified';

const codeLabels: Plugin<[], Root> = () => (tree) => {
  function visit(node: Root | RootContent) {
    if (node.type === 'code' && node.meta) {
      node.data = { ...node.data, hProperties: { 'data-label': node.meta } };
    }
    if ('children' in node) node.children.forEach(visit);
  }
  visit(tree);
};

export const markdownOptions: { remarkPlugins: PluggableList } = {
  remarkPlugins: [[remarkGfm, { singleTilde: false }], codeLabels],
};
