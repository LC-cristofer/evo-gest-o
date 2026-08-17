'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Users, Building2, ClipboardList, BarChart3, Gift,
  Bell, LogOut, Settings, FileUp, Menu, X, ChevronRight,
  Calendar, FileText, HelpCircle, MessageSquare, FolderOpen,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/stores/authStore';
import { notificationAPI } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ComponentType<{ className?: string }>;
  roles?: string[];
  badge?: number;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout, isHydrated } = useAuthStore();
  const [open,    setOpen]    = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (isHydrated && !user) router.replace('/login');
  }, [isHydrated, user, router]);

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => notificationAPI.list().then((r: any) => r.data),
    refetchInterval: 60_000,
    enabled: !!user,
  });

  const unread = ((notifs as any[]) || []).filter((n: any) => !n.is_read).length;

  const NAV: NavItem[] = [
    { label: 'Meu Portal',    href: '/meu-portal',   icon: Home,          roles: ['FUNCIONARIO'] },
    { label: 'Diário de Bordo', href: '/diario',     icon: ClipboardList, roles: ['FUNCIONARIO'] },
    { label: 'Relatório Mensal', href: '/relatorio', icon: FileText,      roles: ['FUNCIONARIO'] },
    { label: 'Dashboard',     href: '/dashboard',    icon: Home,          roles: ['TI','RH','DIRETORIA','SUPERVISOR'] },
    { label: 'Funcionários',  href: '/funcionarios', icon: Users,         roles: ['TI','RH','DIRETORIA','SUPERVISOR'] },
    { label: 'Minha Equipe',  href: '/minha-equipe', icon: Users,         roles: ['SUPERVISOR'] },
    { label: 'Unidades',      href: '/unidades',     icon: Building2,     roles: ['TI','RH','DIRETORIA'] },
    { label: 'Admissões',     href: '/admissoes',    icon: ClipboardList, roles: ['TI','RH'] },
    { label: 'Indicadores',   href: '/indicadores',  icon: BarChart3,     roles: ['TI','RH','DIRETORIA','SUPERVISOR'] },
    { label: 'Benefícios',    href: '/beneficios',   icon: Gift,          roles: ['TI','RH'] },
    { label: 'Calendário',    href: '/calendario',   icon: Calendar,      roles: ['TI','RH','DIRETORIA','SUPERVISOR'] },
    { label: 'Atas',          href: '/atas',         icon: FileText,      roles: ['TI','RH','DIRETORIA'] },
    { label: 'Mensagens',     href: '/mensagens',    icon: MessageSquare },
    { label: 'Documentos',    href: '/documentos',   icon: FolderOpen,    roles: ['TI','RH','DIRETORIA','SUPERVISOR'] },
    { label: 'FAQ',           href: '/faq',          icon: HelpCircle },
    { label: 'Importar',      href: '/importar',     icon: FileUp,        roles: ['TI','RH'] },
    { label: 'Configurações', href: '/configuracoes',icon: Settings,      roles: ['TI'] },
  ];

  const handleLogout = () => { logout(); router.push('/login'); };

  if (!isHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="space-y-3 text-center">
          <div className="w-12 h-12 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  const visible = NAV.filter(n => !n.roles || n.roles.includes(user.role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center">
              {mounted && (
                <Image src="/logo-casca.png" alt="CASCA" width={36} height={36} style={{ objectFit:'contain' }} />
              )}
            </div>
          </div>
          <div>
            <p className="text-white text-sm font-bold tracking-tight">C.A.S.C.A</p>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">Sistema RH</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visible.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}>
              <item.icon className={clsx('w-4 h-4 shrink-0', active ? 'text-white' : 'text-white/40')} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition">
          <Link href="/perfil" className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center hover:border-blue-400/60 transition shrink-0">
            <span className="text-blue-200 text-xs font-bold">{user.name.slice(0,2).toUpperCase()}</span>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">{user.name.split(' ')[0]}</p>
            <p className="text-[10px] text-white/40 capitalize">{user.role.toLowerCase()}</p>
          </div>
          <button onClick={handleLogout} className="text-white/30 hover:text-red-400 transition p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-56 flex-col shrink-0 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-64 flex flex-col shadow-2xl" style={{ animation:'slideInLeft 0.25s ease' }}>
            <style>{`@keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }`}</style>
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between shrink-0 shadow-sm">
          <button onClick={() => setOpen(true)} className="lg:hidden text-slate-400 hover:text-slate-600 transition">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <Image src="/logo-casca.png" alt="CASCA" width={28} height={28} style={{ objectFit:'contain' }} />
            <span className="font-bold text-slate-700 text-sm">C.A.S.C.A</span>
          </div>

          <div className="flex-1 hidden lg:block" />

          <div className="flex items-center gap-2">
            <Link href="/notificacoes" className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div style={{ animation:'fadeInPage 0.35s ease' }}>
            <style>{`@keyframes fadeInPage { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
