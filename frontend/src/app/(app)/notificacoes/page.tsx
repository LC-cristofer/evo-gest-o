'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';


import Link from 'next/link';
import { notificationAPI } from '@/lib/api';
import { formatDateTimeSafe } from '@/utils/date';
import clsx from 'clsx';

export default function NotificacoesPage() {
  const qc = useQueryClient();
  const { data: notifs = [], isLoading } = useQuery({ queryKey:['notifications'], queryFn:()=>notificationAPI.list().then(r=>r.data) });
  const markAll = useMutation({ mutationFn:()=>notificationAPI.markAllRead(), onSuccess:()=>qc.invalidateQueries({queryKey:['notifications']}) });
  const markOne = useMutation({ mutationFn:(id:string)=>notificationAPI.markRead(id), onSuccess:()=>qc.invalidateQueries({queryKey:['notifications']}) });
  const unread  = (notifs as any[]).filter((n:any)=>!n.is_read).length;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-bold text-slate-800">Notificações</h1><p className="text-slate-400 text-sm mt-0.5">{unread>0?`${unread} não lida${unread!==1?'s':''}`:'Tudo em dia'}</p></div>
        {unread>0 && <button onClick={()=>markAll.mutate()} className="btn-secondary text-xs"><CheckCheck className="w-3.5 h-3.5" />Marcar todas como lidas</button>}
      </div>
      <div className="card overflow-hidden">
        {isLoading ? <div className="p-12 text-center text-slate-400">Carregando...</div>
        : (notifs as any[]).length===0 ? (
          <div className="text-center py-16 text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Sem notificações</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(notifs as any[]).map((n:any)=>(
              <div key={n.id} onClick={()=>!n.is_read&&markOne.mutate(n.id)}
                className={clsx('flex items-start gap-4 px-5 py-4 transition cursor-pointer', !n.is_read?'bg-blue-50/40 hover:bg-blue-50':'hover:bg-slate-50/50')}>
                <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', !n.is_read?'bg-blue-100':'bg-slate-100')}>
                  <Bell className={clsx('w-4 h-4', !n.is_read?'text-blue-600':'text-slate-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={clsx('text-sm font-medium', !n.is_read?'text-slate-800':'text-slate-600')}>
                      {n.title}{!n.is_read&&<span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full align-middle" />}
                    </p>
                    {n.link && <Link href={n.link} className="shrink-0 text-blue-500 hover:text-blue-700" onClick={e=>e.stopPropagation()}><ExternalLink className="w-4 h-4" /></Link>}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTimeSafe(n.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
