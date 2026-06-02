'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bell
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 text-zinc-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <p className="text-zinc-500 text-sm font-medium animate-pulse">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  // Prevent non-admins from rendering the layout content entirely.
  // The layout wrapper should technically handle the redirect, but this is a fail-safe.
  if (profile.role !== 'admin') {
    return null; 
  }

  const isActiveRoute = (routePath: string) => {
    if (routePath === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(routePath);
  };

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Subjects', href: '/admin/subjects', icon: BookOpen },
    { name: 'Courses', href: '/admin/courses', icon: Video },
    { name: 'Students', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const handleLogoutClick = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const sidebarContent = (mobile = false) => {
    const showFullText = mobile || !isCollapsed;

    return (
      <div className="flex flex-col h-full bg-zinc-950 text-zinc-300 select-none">
        {/* Brand header */}
        <div className={`p-6 border-b border-zinc-800 flex items-center ${showFullText ? 'gap-3' : 'justify-center'}`}>
          <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {showFullText && (
            <span className="font-bold text-lg text-white truncate tracking-tight">
              Alpha Admin
            </span>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActiveRoute(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center ${showFullText ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl transition-all duration-200 border ${
                  active
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-bold'
                    : 'bg-transparent border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50 font-medium'
                } text-sm`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {showFullText && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-zinc-800 space-y-3 bg-zinc-900/50">
          {showFullText ? (
            <div className="flex items-center gap-3 px-2">
              <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-semibold text-sm shrink-0">
                {profile.displayName ? profile.displayName[0].toUpperCase() : 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">
                  {profile.displayName || 'Administrator'}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center px-1">
              <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-semibold text-sm shrink-0">
                {profile.displayName ? profile.displayName[0].toUpperCase() : 'A'}
              </div>
            </div>
          )}

          <button
            onClick={handleLogoutClick}
            className={`flex w-full items-center ${showFullText ? 'gap-3 px-4 justify-start' : 'justify-center'} py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent transition-all cursor-pointer`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {showFullText && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-zinc-50 flex flex-col md:flex-row font-sans">
      
      {/* 1. Mobile Top Header Bar */}
      <header className="flex md:hidden items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-base text-white">
            Alpha Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* 2. Mobile Nav Drawer Slide-out */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm md:hidden transition-all duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col transform transition-transform duration-300 ease-out md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent(true)}
      </aside>

      {/* 3. Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full bg-zinc-950 border-r border-zinc-800 shrink-0 transition-all duration-300 relative shadow-sm z-20 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Toggle Collapse Arrow Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-7 h-6 w-6 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white shadow-sm cursor-pointer hover:scale-105 transition-all z-50"
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
        {sidebarContent(false)}
      </aside>

      {/* 4. Independent Scrolling Main Content Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {/* Global Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-zinc-200 shrink-0">
          <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest">
            Control Panel
          </span>
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors relative">
               <Bell className="h-5 w-5" />
               <span className="absolute top-1.5 right-2 h-2 w-2 bg-indigo-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto bg-zinc-50/50">
          {children}
        </div>
      </main>
    </div>
  );
}
