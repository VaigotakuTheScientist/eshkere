export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

/**
 * The complete site hierarchy. The header, the mobile menu, the contextual
 * secondary navigation and the footer all render from this single structure.
 */
export const primaryNav: NavItem[] = [
  { label: 'Portfolio', href: '/portfolio' },
  {
    label: 'Research & News',
    href: '/research-and-news',
    children: [
      { label: 'Research & News', href: '/research-and-news' },
      { label: 'Blog', href: '/research-and-news/blog' },
      {
        label: 'Staff Publications & Projects',
        href: '/research-and-news/staff-publications-and-projects',
      },
    ],
  },
  { label: 'Our Approach', href: '/our-approach' },
  {
    label: 'About Us',
    href: '/about-us',
    children: [
      { label: 'Who We Are', href: '/about-us' },
      { label: 'Our History', href: '/about-us/history' },
      { label: 'Partner With Us', href: '/about-us/partner-with-us' },
      { label: 'Team', href: '/about-us/team' },
      { label: 'Careers', href: '/about-us/careers' },
      { label: 'Media Center', href: '/about-us/media-center' },
    ],
  },
];
