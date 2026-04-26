import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';

interface AppLayoutProps {
  onSignOut: () => void;
  userName: string;
}

export function AppLayout({ onSignOut, userName }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onSignOut={onSignOut} userName={userName} />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
