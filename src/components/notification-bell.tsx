// src/components/notification-bell.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Inbox, Loader2, Circle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: { seconds: number };
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/notifications');
      if (res.ok) {
        const data = await res.json();
        const list = data.notifications || [];
        setNotifications(list);
        setUnreadCount(list.filter((n: Notification) => !n.read).length);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [id] }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (seconds: number) => {
    if (!seconds) return 'Just now';
    return new Date(seconds * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white border border-[#DBE2EF] text-[#112D4E] hover:bg-[#F9F7F7] hover:text-[#3F72AF] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
        aria-label="View notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 md:w-96 bg-white border border-[#DBE2EF] rounded-2xl shadow-xl z-50 overflow-hidden transform origin-top-right transition-all">
          {/* Header */}
          <div className="px-4 py-3 bg-[#F9F7F7] border-b border-[#DBE2EF] flex items-center justify-between">
            <h4 className="font-bold text-xs text-[#112D4E]">Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] font-black text-[#3F72AF] hover:underline flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#DBE2EF]/60">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#3F72AF]" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center text-zinc-400 gap-2">
                <Inbox className="h-8 w-8 stroke-[1.5]" />
                <span className="text-xs">No notifications yet.</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                  className={`p-4 transition-colors text-left flex items-start gap-3 cursor-pointer ${
                    notif.read ? 'hover:bg-zinc-50/50' : 'bg-[#3F72AF]/5 hover:bg-[#3F72AF]/10'
                  }`}
                >
                  {/* Unread indicator */}
                  {!notif.read && (
                    <Circle className="h-2 w-2 fill-[#3F72AF] text-[#3F72AF] shrink-0 mt-1.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <h5 className="font-bold text-xs text-[#112D4E]">{notif.title}</h5>
                    <p className="text-[11px] text-zinc-650 leading-relaxed">{notif.body}</p>
                    <span className="text-[9px] text-zinc-400 block pt-0.5">
                      {formatDate(notif.createdAt?.seconds || 0)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
