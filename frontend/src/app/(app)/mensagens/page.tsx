'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatTimeSafe } from '@/utils/date';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

export default function MensagensPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn:  () => api.get('/messages').then(r => r.data),
    refetchInterval: 10_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn:  () => api.get('/users').then(r => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post('/messages', { receiver_id: selectedUser.id, content: text }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['messages'] }); setText(''); },
  });

  // Filtrar conversa com o usuário selecionado
  const conversation = (messages as any[]).filter((m: any) =>
    selectedUser && (
      (m.sender_id === user?.id && m.receiver_id === selectedUser.id) ||
      (m.receiver_id === user?.id && m.sender_id === selectedUser.id)
    )
  );

  // Usuários filtrados
  const filteredUsers = (users as any[]).filter((u: any) =>
    u.id !== user?.id && (
      !search || u.name.toLowerCase().includes(search.toLowerCase())
    )
  );

  // Mensagens não lidas por usuário
  const unreadMap: Record<string, number> = {};
  for (const m of messages as any[]) {
    if (m.receiver_id === user?.id && !m.is_read && m.sender_id) {
      unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1;
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.length]);

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Mensagens</h1>
        <p className="text-slate-400 text-sm mt-0.5">Comunicação interna da equipe</p>
      </div>

      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px', display: 'flex' }}>
        {/* Lista de usuários */}
        <div className="w-64 border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="input text-sm pl-8 py-2" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map((u: any) => (
              <button key={u.id} onClick={() => setSelectedUser(u)}
                className={clsx('w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-slate-50 transition',
                  selectedUser?.id === u.id && 'bg-blue-50 border-r-2 border-blue-600')}>
                <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  selectedUser?.id === u.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
                  {u.name.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{u.name.split(' ')[0]}</p>
                  <p className="text-xs text-slate-400 capitalize">{u.role.toLowerCase()}</p>
                </div>
                {unreadMap[u.id] > 0 && (
                  <span className="w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {unreadMap[u.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          {selectedUser ? (
            <>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-700 text-xs font-bold">{selectedUser.name.slice(0,2).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{selectedUser.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{selectedUser.role.toLowerCase()}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conversation.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Nenhuma mensagem. Diga olá! 👋
                  </div>
                ) : conversation.map((m: any) => {
                  const isMe = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={clsx('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div className={clsx(
                        'max-w-[70%] px-4 py-2.5 rounded-2xl text-sm',
                        isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                      )}>
                        <p>{m.content}</p>
                        <p className={clsx('text-[10px] mt-1', isMe ? 'text-blue-200' : 'text-slate-400')}>
                          {formatTimeSafe(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="p-4 border-t border-slate-100">
                <div className="flex items-end gap-3">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && text.trim()) { e.preventDefault(); sendMutation.mutate(); } }}
                    placeholder="Digite uma mensagem... (Enter para enviar)"
                    rows={1}
                    className="flex-1 input resize-none min-h-[42px] max-h-[120px]"
                    style={{ overflowY: 'auto' }}
                  />
                  <button
                    onClick={() => text.trim() && sendMutation.mutate()}
                    disabled={!text.trim() || sendMutation.isPending}
                    className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition shrink-0"
                  >
                    {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <span className="text-5xl block mb-4">💬</span>
                <p className="font-medium text-slate-600">Selecione um usuário</p>
                <p className="text-sm">para iniciar uma conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
