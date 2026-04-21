'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Mobile bottom navigation bar — shown only on screens ≤ 768px via CSS.
 * Three tabs: Home (dashboard), Studio, Piano
 */
export default function MobileNav() {
  const pathname = usePathname();

  const tabs = [
    { label: 'Home', icon: 'home', href: '/dashboard' },
    { label: 'Studio', icon: 'music_note', href: '/studio' },
    { label: 'Piano', icon: 'piano', href: '/piano' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {tabs.map((tab) => {
        const isActive =
          tab.href === '/dashboard'
            ? pathname === '/dashboard' || pathname === '/'
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={isActive ? 'active' : ''}
          >
            <span
              className="material-symbols-rounded"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
