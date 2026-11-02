import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import styles from './manager-guide.module.css';

const components: Components = {
  a({ href, children }) {
    // La référence au cahier des charges appartient à la documentation du dépôt.
    if (href === '../TOURNIO_SPEC.md') return <>{children}</>;
    const destination = href?.replace(/^https:\/\/tourn\.rfonline\.be(?=\/|$)/, '') || href;
    return <a href={destination}>{children}</a>;
  },
  table({ children }) {
    return <div className={styles.tableScroll} role="region" aria-label="Tableau du guide" tabIndex={0}><table>{children}</table></div>;
  },
  li({ className, children }) {
    return <li className={className}>{className?.includes('task-list-item') ? <label>{children}</label> : children}</li>;
  },
};

/** Le document du dépôt reste la source unique ; son rendu Markdown s’effectue côté serveur. */
export function ManagerGuide({ content }: { content: string }) {
  return <article className={styles.guide}>
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components} skipHtml>{content}</Markdown>
  </article>;
}
