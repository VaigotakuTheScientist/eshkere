import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content architecture
 * --------------------
 * Every collection lives in `src/content/<name>/`. Files whose names start
 * with an underscore (e.g. `_template.md`) are ignored by the loader — they
 * exist as authoring templates for future editors.
 *
 * The `prototype` flag marks sample content that demonstrates the editorial
 * system. Prototype entries are always rendered with a visible "sample"
 * label and must never be presented as real publications, projects or
 * announcements. Set `prototype: false` (or omit it) only for real content.
 */

const portfolio = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/portfolio' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** Portfolio is broader than investments: projects, programs, experiments and supported work. */
    category: z.enum(['project', 'program', 'experiment', 'supported-work']),
    status: z.enum(['exploring', 'in-progress', 'active', 'paused', 'completed']),
    date: z.coerce.date().optional(),
    /** Where the work itself lives, when it lives somewhere else. */
    url: z.string().url().optional(),
    tags: z.array(z.string()).default([]),
    prototype: z.boolean().default(false),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    type: z.enum(['research', 'news', 'announcement']),
    date: z.coerce.date(),
    author: z.string().default('Eshkere'),
    topics: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    prototype: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    date: z.coerce.date(),
    author: z.string().default('Eshkere'),
    topics: z.array(z.string()).default([]),
    prototype: z.boolean().default(false),
  }),
});

const staffWork = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/staff-work' }),
  schema: z.object({
    title: z.string(),
    excerpt: z.string(),
    kind: z.enum(['publication', 'research', 'tool', 'project', 'external']),
    date: z.coerce.date(),
    author: z.string().default('Eshkere'),
    url: z.string().url().optional(),
    topics: z.array(z.string()).default([]),
    prototype: z.boolean().default(false),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/team' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      focus: z.string().optional(),
      /** Optional portrait in `src/assets/team/`. Falls back to initials. */
      portrait: image().optional(),
      links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
      order: z.number().default(0),
    }),
});

export const collections = { portfolio, research, blog, staffWork, team };
