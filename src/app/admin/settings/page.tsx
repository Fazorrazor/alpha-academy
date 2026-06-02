'use client';

import React from 'react';
import AdminLayout from '@/components/admin-layout';

export default function AdminSettingsPage() {
  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            Platform Settings
          </h1>
        </div>
        
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-sm">
          <p className="text-zinc-500 font-medium">Global platform settings and API keys management coming soon.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
