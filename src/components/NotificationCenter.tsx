"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, Clock, UserPlus, FileText, CreditCard, Calendar, Activity, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  action: string;
  type: string;
  performed_by: string;
  created_at: string;
  application_id: string | null;
  customer_id: string | null;
  is_read: boolean;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Bildirimler yüklenemedi", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Her 1 dakikada bir yenile
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications?all=true', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'PATCH' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'document': return <FileText className="w-4 h-4 text-amber-500" />;
      case 'payment': return <CreditCard className="w-4 h-4 text-emerald-500" />;
      case 'appointment': return <Calendar className="w-4 h-4 text-purple-500" />;
      case 'status': return <Activity className="w-4 h-4 text-indigo-500" />;
      default: return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'customer': return 'bg-blue-500/10 border-blue-500/20';
      case 'document': return 'bg-amber-500/10 border-amber-500/20';
      case 'payment': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'appointment': return 'bg-purple-500/10 border-purple-500/20';
      case 'status': return 'bg-indigo-500/10 border-indigo-500/20';
      default: return 'bg-slate-500/10 border-slate-500/20';
    }
  };

  const timeAgo = (dateStr: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " yıl";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " ay";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gün";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " saat";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " dk";
    return "Az önce";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-all"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-[#060d1a] rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-[#1f2937] flex items-center justify-between bg-slate-50 dark:bg-[#0a101a]">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              Bildirimler
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px]">
                  {unreadCount} Yeni
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" /> Okundu İşaretle
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Henüz bildiriminiz yok.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={n.customer_id ? `/customers/${n.customer_id}` : "#"}
                    onClick={() => {
                      setIsOpen(false);
                      if (!n.is_read) handleMarkAsRead(n.id);
                    }}
                    className={`block px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${!n.is_read ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${getBgColor(n.type)}`}>
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${!n.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                          {n.action}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {timeAgo(n.created_at)}
                          </p>
                          {n.performed_by && (
                            <p className="text-[10px] text-slate-400 truncate">
                              • {n.performed_by}
                            </p>
                          )}
                        </div>
                      </div>
                      {!n.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-slate-100 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] text-center">
            <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              Tüm Aktiviteleri Gör
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
