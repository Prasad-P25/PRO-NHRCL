import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Settings,
  ChevronDown,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useState } from 'react';

interface NavItem {
  title: string;
  href?: string;
  icon: React.ElementType;
  children?: { title: string; href: string }[];
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Audits',
    icon: ClipboardCheck,
    children: [
      { title: 'New Audit', href: '/audits/new' },
      { title: 'My Audits', href: '/audits/my' },
      { title: 'Pending Review', href: '/audits/pending' },
      { title: 'All Audits', href: '/audits' },
    ],
  },
  {
    title: 'KPI',
    icon: TrendingUp,
    children: [
      { title: 'Leading Indicators', href: '/kpi/leading' },
      { title: 'Lagging Indicators', href: '/kpi/lagging' },
      { title: 'Enter KPIs', href: '/kpi/entry' },
    ],
  },
  {
    title: 'CAPA',
    icon: AlertTriangle,
    children: [
      { title: 'All CAPAs', href: '/capa' },
      { title: 'Open CAPA', href: '/capa/open' },
      { title: 'My CAPA', href: '/capa/my' },
      { title: 'Overdue', href: '/capa/overdue' },
    ],
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: FileText,
  },
  {
    title: 'Maturity Assessment',
    icon: Gauge,
    children: [
      { title: 'New Assessment', href: '/maturity/new' },
      { title: 'Assessment History', href: '/maturity' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    roles: ['Super Admin'],
    children: [
      { title: 'Users', href: '/settings/users' },
      { title: 'Packages', href: '/settings/packages' },
      { title: 'Roles', href: '/settings/roles' },
      { title: 'Audit Checklist', href: '/settings/checklist' },
    ],
  },
];

export function Sidebar() {
  const { sidebarOpen } = useAppStore();
  const { user } = useAuthStore();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Audits']);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role?.name || '');
  });

  if (!sidebarOpen) {
    return null;
  }

  return (
    <aside className="fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-background">
      <nav className="h-full overflow-y-auto p-4">
        <ul className="space-y-2">
          {filteredNavItems.map((item) => (
            <li key={item.title}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleExpanded(item.title)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        expandedItems.includes(item.title) && 'rotate-180'
                      )}
                    />
                  </button>
                  {expandedItems.includes(item.title) && (
                    <ul className="ml-6 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <NavLink
                            to={child.href}
                            className={({ isActive }) =>
                              cn(
                                'block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                                isActive && 'bg-accent text-accent-foreground'
                              )
                            }
                          >
                            {child.title}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <NavLink
                  to={item.href!}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                      isActive && 'bg-accent text-accent-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
