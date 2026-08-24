import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { url } from '../lib/url';

interface SearchDoc {
  title: string;
  href: string;
  /** Section label shown on the result and used for filtering. */
  section: string;
  excerpt: string;
  /** Lower-cased haystack: title + tags + body text. */
  text: string;
  prototype?: boolean;
}

/** Reduce markdown to plain text for indexing. */
function plain(markdown: string | undefined): string {
  return (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

const staticPages: SearchDoc[] = [
  {
    title: 'Maximize Health, Play Games',
    href: '/',
    section: 'Pages',
    excerpt: 'The Eshkere homepage: health is non-optional, everything else is a game.',
    text: 'eshkere home maximize health play games health is non-optional everything else is a game hyperpop planet foundation flourishing',
  },
  {
    title: 'Portfolio',
    href: '/portfolio',
    section: 'Pages',
    excerpt: 'Projects, programs, experiments and supported work — published only when real.',
    text: 'portfolio projects programs experiments supported work filters categories status',
  },
  {
    title: 'Research & News',
    href: '/research-and-news',
    section: 'Pages',
    excerpt: 'Research, working notes and announcements from Eshkere.',
    text: 'research news announcements editorial publications filters topics authors',
  },
  {
    title: 'Blog',
    href: '/research-and-news/blog',
    section: 'Pages',
    excerpt: 'Shorter, looser writing from Eshkere.',
    text: 'blog posts notes writing topics',
  },
  {
    title: 'Staff Publications & Projects',
    href: '/research-and-news/staff-publications-and-projects',
    section: 'Pages',
    excerpt: 'Publications, research, tools, projects and external work by the people of Eshkere.',
    text: 'staff publications projects tools research external work',
  },
  {
    title: 'Our Approach',
    href: '/our-approach',
    section: 'Pages',
    excerpt: 'The Maximize Health, Play Games thesis in full — including the undecided parts.',
    text: 'approach philosophy thesis health games non-optional foundation evaluation criteria open questions wellbeing public good exploration play',
  },
  {
    title: 'Who We Are',
    href: '/about-us',
    section: 'Pages',
    excerpt: 'Eshkere is an early-stage exploratory organization concept.',
    text: 'about who we are early-stage exploratory organization concept honesty',
  },
  {
    title: 'Our History',
    href: '/about-us/history',
    section: 'Pages',
    excerpt: 'The Eshkere timeline — confirmed events only.',
    text: 'history timeline milestones confirmed events',
  },
  {
    title: 'Partner With Us',
    href: '/about-us/partner-with-us',
    section: 'Pages',
    excerpt: 'How collaboration with Eshkere could work.',
    text: 'partner collaborate builders researchers funders creative partners contact',
  },
  {
    title: 'Team',
    href: '/about-us/team',
    section: 'Pages',
    excerpt: 'The people of Eshkere — real, confirmed people only.',
    text: 'team people profiles roster',
  },
  {
    title: 'Careers',
    href: '/about-us/careers',
    section: 'Pages',
    excerpt: 'Open roles at Eshkere — none are currently published.',
    text: 'careers jobs roles vacancies hiring open positions',
  },
  {
    title: 'Media Center',
    href: '/about-us/media-center',
    section: 'Pages',
    excerpt: 'Organization description, logo assets and brand colors.',
    text: 'media center press kit logo brand colors boilerplate announcements coverage contact',
  },
];

export const GET: APIRoute = async () => {
  const [research, blog, staffWork, portfolio, team] = await Promise.all([
    getCollection('research'),
    getCollection('blog'),
    getCollection('staffWork'),
    getCollection('portfolio'),
    getCollection('team'),
  ]);

  const docs: SearchDoc[] = [
    ...staticPages.map((page) => ({ ...page, href: url(page.href) })),
    ...research.map((entry) => ({
      title: entry.data.title,
      href: url(`/research-and-news/${entry.id}`),
      section: 'Research & News',
      excerpt: entry.data.excerpt,
      text: [entry.data.title, entry.data.author, entry.data.topics.join(' '), plain(entry.body)]
        .join(' ')
        .toLowerCase(),
      prototype: entry.data.prototype,
    })),
    ...blog.map((entry) => ({
      title: entry.data.title,
      href: url(`/research-and-news/blog/${entry.id}`),
      section: 'Blog',
      excerpt: entry.data.excerpt,
      text: [entry.data.title, entry.data.author, entry.data.topics.join(' '), plain(entry.body)]
        .join(' ')
        .toLowerCase(),
      prototype: entry.data.prototype,
    })),
    ...staffWork.map((entry) => ({
      title: entry.data.title,
      href: entry.data.url ?? url(`/research-and-news/staff-publications-and-projects/${entry.id}`),
      section: 'Staff Publications & Projects',
      excerpt: entry.data.excerpt,
      text: [entry.data.title, entry.data.kind, entry.data.topics.join(' '), plain(entry.body)]
        .join(' ')
        .toLowerCase(),
      prototype: entry.data.prototype,
    })),
    ...portfolio.map((entry) => ({
      title: entry.data.title,
      href: entry.data.url ?? url(`/portfolio/${entry.id}`),
      section: 'Portfolio',
      excerpt: entry.data.summary,
      text: [entry.data.title, entry.data.category, entry.data.tags.join(' '), plain(entry.body)]
        .join(' ')
        .toLowerCase(),
      prototype: entry.data.prototype,
    })),
    ...team.map((entry) => ({
      title: entry.data.name,
      href: url(`/about-us/team/${entry.id}`),
      section: 'People',
      excerpt: `${entry.data.role}${entry.data.focus ? ` — ${entry.data.focus}` : ''}`,
      text: [entry.data.name, entry.data.role, entry.data.focus ?? '', plain(entry.body)]
        .join(' ')
        .toLowerCase(),
    })),
  ];

  return new Response(JSON.stringify({ docs }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
