// src/components/dashboard-layout.tsx
'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import NotificationBell from '@/components/notification-bell';
import {
  GraduationCap,
  BookOpen,
  Compass,
  Award,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading, logout } = useAuth();
  
  // Collapse/Expand state for desktop sidebar
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Mobile drawer slide-out state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          <p className="text-zinc-650 text-sm font-medium animate-pulse">Synchronizing secure session...</p>
        </div>
      </div>
    );
  }

  // Helper to determine if a route is active
  const isActiveRoute = (routePath: string) => {
    if (routePath === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(routePath);
  };

  const navItems = [
    {
      name: 'My Dashboard',
      href: '/dashboard',
      icon: BookOpen,
    },
    {
      name: 'Explore Courses',
      href: '/courses',
      icon: Compass,
    },
    {
      name: 'Certificates',
      href: '/certificates',
      icon: Award,
      disabled: false,
    },
    {
      name: 'Leaderboard',
      href: '/leaderboard',
      icon: Trophy,
      disabled: false,
    },
    {
      name: 'Security & Profile',
      href: '/settings',
      icon: Shield,
      disabled: false,
    },
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
      <div className="flex flex-col h-full bg-white select-none">
        {/* Brand header */}
        <div className={`p-6 border-b border-[#DBE2EF] flex items-center ${showFullText ? 'gap-3' : 'justify-center'}`}>
          <div className="h-9 w-9 rounded-xl bg-[#F9F7F7] border border-[#DBE2EF] flex items-center justify-center text-[#3F72AF] shadow-sm shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          {showFullText && (
            <span className="font-bold text-lg bg-gradient-to-r from-[#112D4E] to-[#3F72AF] bg-clip-text text-transparent truncate">
              Alpha Academy
            </span>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const active = isActiveRoute(item.href);
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.name}
                  className={`flex items-center ${showFullText ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl opacity-50 cursor-not-allowed text-zinc-400 text-sm font-medium`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {showFullText && <span>{item.name}</span>}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center ${showFullText ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-xl transition-all duration-200 border ${
                  active
                    ? 'bg-[#3F72AF]/10 border-[#3F72AF]/20 text-[#3F72AF] font-bold'
                    : 'bg-transparent border-transparent text-zinc-500 hover:text-[#112D4E] hover:bg-[#DBE2EF]/30 font-medium'
                } text-sm`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {showFullText && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-[#DBE2EF] space-y-3 bg-[#F9F7F7]">
          {showFullText ? (
            <div className="flex items-center gap-3 px-2">
              <div className="h-9 w-9 rounded-full bg-[#DBE2EF] border border-[#DBE2EF] flex items-center justify-center text-[#112D4E] font-semibold text-sm shrink-0">
                {profile.displayName ? profile.displayName[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-[#112D4E] truncate">
                    {profile.displayName || 'Student'}
                  </p>
                  {profile.subscription === 'active' && (
                    <Sparkles className="h-3 w-3 text-amber-500 fill-amber-400 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center px-1">
              <div className="h-9 w-9 rounded-full bg-[#DBE2EF] border border-[#DBE2EF] flex items-center justify-center text-[#112D4E] font-semibold text-sm shrink-0">
                {profile.displayName ? profile.displayName[0].toUpperCase() : 'U'}
              </div>
            </div>
          )}

          <button
            onClick={handleLogoutClick}
            className={`flex w-full items-center ${showFullText ? 'gap-3 px-4 justify-start' : 'justify-center'} py-2.5 rounded-xl text-xs font-semibold text-red-650 hover:text-red-550 hover:bg-red-50/50 border border-transparent hover:border-red-200/40 transition-all cursor-pointer`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {showFullText && <span>Sign Out Session</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F9F7F7] flex flex-col md:flex-row font-sans">
      
      {/* 1. Mobile Top Header Bar */}
      <header className="flex md:hidden items-center justify-between px-6 py-4 bg-white border-b border-[#DBE2EF] shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#F9F7F7] border border-[#DBE2EF] flex items-center justify-center text-[#3F72AF] shadow-sm">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-[#112D4E] to-[#3F72AF] bg-clip-text text-transparent">
            Alpha Academy
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="p-2 rounded-lg bg-[#F9F7F7] border border-[#DBE2EF] text-[#112D4E] hover:bg-[#DBE2EF]/30 transition-all"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* 2. Mobile Nav Drawer Slide-out (with overlay backdrop) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm md:hidden transition-all duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#DBE2EF] flex flex-col transform transition-transform duration-300 ease-out md:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent(true)}
      </aside>

      {/* 3. Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full bg-white border-r border-[#DBE2EF] shrink-0 transition-all duration-300 relative shadow-sm z-20 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Toggle Collapse Arrow Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-7 h-6 w-6 rounded-full border border-[#DBE2EF] bg-white flex items-center justify-center text-zinc-500 hover:text-[#112D4E] shadow-sm cursor-pointer hover:scale-105 transition-all"
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
        {sidebarContent(false)}
      </aside>

      {/* 4. Independent Scrolling Main Content Area */}
      <main className="flex-1 h-full overflow-hidden z-10 flex flex-col">
        {/* Global Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-[#DBE2EF] shrink-0">
          <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest">
            Alpha Student Hub
          </span>
          <div className="flex items-center gap-4">
            <NotificationBell />
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
