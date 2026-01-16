import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, List, Plus, Activity } from 'lucide-react';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: List, label: '沙箱列表' },
    { path: '/create', icon: Plus, label: '创建沙箱' },
  ];

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Box size={28} />
          <span>OpenSandbox</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`${styles.navItem} ${location.pathname === item.path ? styles.active : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.footer}>
          <Activity size={16} />
          <span>API: http://127.0.0.1:8080</span>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
