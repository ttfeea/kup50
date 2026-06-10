import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen text-ink dark:text-slate-100">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuButton={
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md lg:hidden"
            style={{ border: '1px solid rgba(157,0,255,0.22)', background: 'transparent', color: 'rgba(199,160,255,0.7)', cursor: 'pointer' }}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        }
      />
      <div className="lg:pl-[220px]">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}