import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getHelpTopic, helpTopics } from '@/lib/help-content';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return helpTopics.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = getHelpTopic(params.slug);
  if (!topic) return { title: 'Help Centre' };
  return { title: topic.title, description: topic.description };
}

export default function HelpTopicPage({ params }: Props) {
  const topic = getHelpTopic(params.slug);
  if (!topic) notFound();

  return (
    <article className="max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{topic.title}</h1>
        <p className="text-sm text-muted-foreground">
          {topic.description} · Updated {new Date(topic.updated).toLocaleDateString()}
        </p>
      </header>
      <div className="space-y-6">
        {topic.sections.map((s) => (
          <section key={s.heading} className="space-y-2">
            <h2 className="text-lg font-semibold">{s.heading}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
