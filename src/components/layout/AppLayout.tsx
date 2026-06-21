import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  onSignOut: () => void;
  userName: string;
}

export function AppLayout({ onSignOut, userName }: AppLayoutProps) {
  const location = useLocation();

  return (
    <div className="app-shell flex h-screen">
      <Sidebar onSignOut={onSignOut} userName={userName} />
      <main className="flex-1 overflow-hidden md:py-4 md:pr-4">
        <div className="h-full overflow-y-auto bg-white md:rounded-[24px] md:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_48px_rgba(16,24,40,0.08)] pb-24 lg:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
