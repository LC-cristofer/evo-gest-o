'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Upload, X,
  Loader2, Image as ImageIcon, Video, LogIn,
  Calendar, Newspaper, ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDateSafe } from '@/utils/date';
import toast from 'react-hot-toast';

const TYPE_LABELS: Record<string, string> = {
  NOTICIA: 'Notícia', EVENTO: 'Evento', CONQUISTA: 'Conquista',
};
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  NOTICIA:   { bg: '#dbeafe', text: '#1d4ed8' },
  EVENTO:    { bg: '#ede9fe', text: '#6d28d9' },
  CONQUISTA: { bg: '#fef3c7', text: '#b45309' },
};

// ─── PostModal (admin) ────────────────────────────────────────
function PostModal({ post, onClose }: { post: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title:        post?.title || '',
    content:      post?.content || '',
    summary:      post?.summary || '',
    type:         post?.type || 'NOTICIA',
    is_published: post?.is_published || false,
  });
  const [saving,        setSaving]        = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [postId, setPostId] = useState<string | null>(post?.id || null);
  const coverRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Título e conteúdo obrigatórios.'); return; }
    setSaving(true);
    try {
      if (!postId) {
        const r = await api.post('/home/admin/posts', form);
        setPostId(r.data.id);
        toast.success('Post criado!');
      } else {
        await api.put(`/home/admin/posts/${postId}`, form);
        toast.success('Post salvo!');
      }
      qc.invalidateQueries({ queryKey: ['home-posts'] });
      qc.invalidateQueries({ queryKey: ['home-admin-posts'] });
      onClose();
    } catch {}
    setSaving(false);
  };

  const uploadFile = async (file: File, type: 'cover' | 'media') => {
    if (!postId) { toast.error('Salve o post primeiro.'); return; }
    type === 'cover' ? setUploadingCover(true) : setUploadingMedia(true);
    const fd = new FormData();
    fd.append(type === 'cover' ? 'cover' : 'media', file);
    await api.post(`/home/admin/posts/${postId}/${type === 'cover' ? 'cover' : 'media'}`, fd);
    qc.invalidateQueries({ queryKey: ['home-admin-posts'] });
    toast.success(type === 'cover' ? 'Capa enviada!' : 'Mídia adicionada!');
    type === 'cover' ? setUploadingCover(false) : setUploadingMedia(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)' }} onClick={onClose} />
      <div style={{ position:'relative', background:'#fff', borderRadius:20, width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ position:'sticky', top:0, background:'#fff', borderBottom:'1px solid #f1f5f9', padding:'16px 24px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1e293b' }}>{post ? 'Editar post' : 'Novo post'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4, color:'#94a3b8' }}><X size={18} /></button>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:4 }}>Título *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:4 }}>Resumo (exibido na listagem)</label>
            <input value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:4 }}>Conteúdo *</label>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5}
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:'#64748b', display:'block', marginBottom:4 }}>Categoria</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ width:'100%', padding:'10px 14px', border:'1px solid #e2e8f0', borderRadius:10, fontSize:14, outline:'none' }}>
                <option value="NOTICIA">Notícia</option>
                <option value="EVENTO">Evento</option>
                <option value="CONQUISTA">Conquista</option>
              </select>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:2 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, color:'#334155' }}>
                <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} style={{ width:16, height:16 }} />
                Publicar agora
              </label>
            </div>
          </div>
          <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:14 }}>
            <p style={{ fontSize:12, fontWeight:600, color:'#64748b', marginBottom:8 }}>Mídia</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input ref={coverRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'cover')} />
              <input ref={mediaRef} type="file" accept="image/*,video/*" style={{ display:'none' }} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'media')} />
              <button onClick={() => coverRef.current?.click()} disabled={uploadingCover}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:13, cursor:'pointer' }}>
                {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Foto de capa
              </button>
              <button onClick={() => mediaRef.current?.click()} disabled={uploadingMedia}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid #e2e8f0', borderRadius:8, background:'#f8fafc', fontSize:13, cursor:'pointer' }}>
                {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />} Foto / Vídeo
              </button>
            </div>
            {!postId && <p style={{ fontSize:12, color:'#94a3b8', marginTop:6 }}>Salve o post primeiro para adicionar mídia.</p>}
          </div>
        </div>
        <div style={{ position:'sticky', bottom:0, background:'#fff', borderTop:'1px solid #f1f5f9', padding:'14px 24px', display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'9px 18px', border:'1px solid #e2e8f0', borderRadius:10, background:'#fff', fontSize:14, cursor:'pointer', color:'#64748b' }}>Cancelar</button>
          <button onClick={save} disabled={saving}
            style={{ padding:'9px 22px', background:'#2563eb', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            {saving && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────
function PostCard({ post, isAdmin, onEdit, onDelete }: any) {
  const colors = TYPE_COLORS[post.type] || { bg: '#f1f5f9', text: '#64748b' };
  return (
    <article style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9', transition:'box-shadow .2s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)')}>
      {post.cover_url && (
        <div style={{ height:180, overflow:'hidden' }}>
          <img src={`http://localhost:4000${post.cover_url}`} alt={post.title}
            style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .3s' }}
            onMouseEnter={e => ((e.target as HTMLImageElement).style.transform='scale(1.04)')}
            onMouseLeave={e => ((e.target as HTMLImageElement).style.transform='scale(1)')} />
        </div>
      )}
      <div style={{ padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:colors.bg, color:colors.text }}>
            {TYPE_LABELS[post.type] || post.type}
          </span>
          <span style={{ fontSize:11, color:'#94a3b8' }}>{formatDateSafe(post.published_at || post.created_at)}</span>
        </div>
        <h3 style={{ margin:'0 0 6px', fontSize:15, fontWeight:700, color:'#1e293b', lineHeight:'1.4' }}>{post.title}</h3>
        {post.summary && <p style={{ margin:'0 0 8px', fontSize:13, color:'#64748b', lineHeight:'1.6' }}>{post.summary}</p>}
        {post.author_name && <p style={{ margin:0, fontSize:11, color:'#94a3b8' }}>por {post.author_name}</p>}
        {(post.media_urls as any[])?.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, marginTop:10, borderRadius:10, overflow:'hidden' }}>
            {(post.media_urls as any[]).slice(0,3).map((m: any, i: number) =>
              m.type === 'video' ? (
                <video key={i} src={`http://localhost:4000${m.url}`} style={{ width:'100%', height:72, objectFit:'cover' }} muted />
              ) : (
                <img key={i} src={`http://localhost:4000${m.url}`} alt="" style={{ width:'100%', height:72, objectFit:'cover' }} />
              )
            )}
          </div>
        )}
        {isAdmin && (
          <div style={{ display:'flex', gap:8, marginTop:14, paddingTop:12, borderTop:'1px solid #f8fafc' }}>
            <button onClick={() => onEdit(post)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'6px', fontSize:12, color:'#2563eb', background:'none', border:'none', cursor:'pointer', borderRadius:8 }}
              onMouseEnter={e => (e.currentTarget.style.background='#eff6ff')}
              onMouseLeave={e => (e.currentTarget.style.background='none')}>
              <Pencil size={12} /> Editar
            </button>
            <button onClick={() => onDelete(post.id)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'6px', fontSize:12, color:'#ef4444', background:'none', border:'none', cursor:'pointer', borderRadius:8 }}
              onMouseEnter={e => (e.currentTarget.style.background='#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background='none')}>
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = user && ['DIRETORIA','TI','RH'].includes(user.role);
  const [adminMode, setAdminMode] = useState(false);
  const [editPost,  setEditPost]  = useState<any>(null);
  const [newPost,   setNewPost]   = useState(false);
  const [filter,    setFilter]    = useState('');
  const [section,   setSection]   = useState('posts'); // posts | quem-somos | eventos

  const { data: postsData } = useQuery({
    queryKey: ['home-posts', filter],
    queryFn:  () => api.get('/home/posts', { params: filter ? { type: filter } : undefined }).then(r => r.data),
  });

  const { data: adminPosts } = useQuery({
    queryKey: ['home-admin-posts'],
    queryFn:  () => api.get('/home/admin/posts').then(r => r.data),
    enabled:  !!isAdmin && adminMode,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/home/admin/posts/${id}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['home-posts'] });
      qc.invalidateQueries({ queryKey: ['home-admin-posts'] });
      toast.success('Post removido.');
    },
  });

  const posts = (adminMode ? adminPosts : postsData?.data) || [];

  const navItems = [
    { id: 'posts',       label: 'Notícias', icon: Newspaper },
    { id: 'eventos',     label: 'Eventos',  icon: Calendar },
    { id: 'quem-somos',  label: 'Quem Somos', icon: null },
  ];

  const displayPosts = filter
    ? (posts as any[]).filter((p: any) => p.type === filter)
    : section === 'eventos'
      ? (posts as any[]).filter((p: any) => p.type === 'EVENTO')
      : posts;

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui,sans-serif' }}>

      {/* Top bar sutil */}
      <div style={{ background:'#0f172a', padding:'6px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:11, color:'#475569' }}>C.A.S.C.A — Araucária, Paraná</span>
        <Link href="/login" style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#94a3b8', textDecoration:'none', padding:'4px 12px', border:'1px solid #1e293b', borderRadius:20, transition:'all .2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#fff'; (e.currentTarget as HTMLElement).style.borderColor='#334155'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#94a3b8'; (e.currentTarget as HTMLElement).style.borderColor='#1e293b'; }}>
          <LogIn size={12} /> Acessar sistema
        </Link>
      </div>

      {/* Hero */}
      <header style={{
        background:'linear-gradient(135deg,#0f172a 0%,#1e3a8a 55%,#2563eb 100%)',
        color:'#fff', padding:'clamp(48px,8vw,96px) clamp(24px,5vw,80px)',
        textAlign:'center', position:'relative', overflow:'hidden',
      }}>
        {/* Círculos decorativos */}
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:1, maxWidth:720, margin:'0 auto' }}>
          <div style={{ width:88, height:88, margin:'0 auto 20px', background:'rgba(255,255,255,0.1)', borderRadius:24, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.15)' }}>
            <Image src="/logo-casca.png" alt="C.A.S.C.A" width={64} height={64} style={{ objectFit:'contain' }} />
          </div>
          <h1 style={{ fontSize:'clamp(28px,5vw,48px)', fontWeight:900, margin:'0 0 10px', letterSpacing:'-1px', lineHeight:1.1 }}>
            Bem-vindo ao C.A.S.C.A
          </h1>
          <p style={{ fontSize:'clamp(15px,2vw,18px)', color:'#93c5fd', margin:'0 0 8px', fontWeight:400 }}>
            Centro de Apoio Sociocomunitário e Cultural de Araucária
          </p>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', margin:'0 0 36px', maxWidth:500, marginLeft:'auto', marginRight:'auto', lineHeight:1.7 }}>
            Trabalhamos para transformar vidas através de projetos sociais, culturais e educacionais em Araucária.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <a href="#posts" style={{ background:'#2563eb', color:'#fff', padding:'13px 28px', borderRadius:12, fontWeight:700, textDecoration:'none', fontSize:14, display:'inline-flex', alignItems:'center', gap:6 }}>
              Ver novidades <ChevronRight size={16} />
            </a>
            <a href="#quem-somos" style={{ background:'rgba(255,255,255,0.1)', color:'#fff', padding:'13px 28px', borderRadius:12, fontWeight:600, textDecoration:'none', fontSize:14, border:'1px solid rgba(255,255,255,0.15)' }}>
              Quem somos
            </a>
            <Link href="/login" style={{ background:'rgba(255,255,255,0.08)', color:'#a5b4fc', padding:'13px 28px', borderRadius:12, fontWeight:600, textDecoration:'none', fontSize:14, border:'1px solid rgba(165,180,252,0.2)', display:'inline-flex', alignItems:'center', gap:6 }}>
              <LogIn size={14} /> Sistema RH
            </Link>
          </div>
        </div>
      </header>

      {/* Admin toolbar */}
      {isAdmin && (
        <div style={{ background:'#1e293b', color:'#fff', padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <span style={{ fontSize:13, color:'#94a3b8' }}>Administrador: {user!.name}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setAdminMode(m => !m)}
              style={{ display:'flex', alignItems:'center', gap:6, background: adminMode ? '#3b82f6' : 'rgba(255,255,255,0.1)', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer' }}>
              {adminMode ? <><EyeOff size={13} /> Ver como público</> : <><Eye size={13} /> Gerenciar posts</>}
            </button>
            {adminMode && (
              <button onClick={() => setNewPost(true)}
                style={{ display:'flex', alignItems:'center', gap:6, background:'#10b981', color:'#fff', border:'none', borderRadius:8, padding:'6px 14px', fontSize:13, cursor:'pointer' }}>
                <Plus size={13} /> Novo post
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quem Somos */}
      <section id="quem-somos" style={{ background:'#fff', padding:'clamp(48px,6vw,80px) clamp(24px,5vw,80px)' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:40, alignItems:'center' }}>
            <div>
              <span style={{ fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:2, textTransform:'uppercase' }}>Sobre nós</span>
              <h2 style={{ fontSize:'clamp(24px,3vw,36px)', fontWeight:900, color:'#0f172a', margin:'8px 0 16px', lineHeight:1.2 }}>Quem é o C.A.S.C.A?</h2>
              <p style={{ fontSize:15, color:'#475569', lineHeight:1.8, margin:'0 0 16px' }}>
                O Centro de Apoio Sociocomunitário e Cultural de Araucária é uma organização sem fins lucrativos dedicada ao desenvolvimento social e cultural da comunidade de Araucária e região.
              </p>
              <p style={{ fontSize:15, color:'#475569', lineHeight:1.8, margin:0 }}>
                Atuamos com projetos voltados para a inclusão social, educação, cultura e apoio a famílias em situação de vulnerabilidade, conectando pessoas e recursos para gerar impacto real.
              </p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[
                { emoji:'🤝', title:'Inclusão Social', desc:'Projetos que conectam e acolhem' },
                { emoji:'📚', title:'Educação', desc:'Cursos, oficinas e formação' },
                { emoji:'🎭', title:'Cultura', desc:'Arte, música e expressão' },
                { emoji:'💙', title:'Apoio Familiar', desc:'Suporte a famílias vulneráveis' },
              ].map(card => (
                <div key={card.title} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:14, padding:'18px 16px', textAlign:'center' }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>{card.emoji}</div>
                  <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:13, color:'#1e293b' }}>{card.title}</p>
                  <p style={{ margin:0, fontSize:12, color:'#94a3b8' }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Publicações */}
      <section id="posts" style={{ padding:'clamp(48px,6vw,80px) clamp(24px,5vw,80px)', background:'#f8fafc' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:28 }}>
            <div>
              <span style={{ fontSize:12, fontWeight:700, color:'#2563eb', letterSpacing:2, textTransform:'uppercase' }}>Publicações</span>
              <h2 style={{ fontSize:'clamp(22px,3vw,30px)', fontWeight:900, color:'#0f172a', margin:'6px 0 0', lineHeight:1.2 }}>Novidades e Eventos</h2>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[{ v:'', l:'Tudo' },{ v:'NOTICIA', l:'Notícias' },{ v:'EVENTO', l:'Eventos' },{ v:'CONQUISTA', l:'Conquistas' }].map(f => (
                <button key={f.v} onClick={() => setFilter(f.v)}
                  style={{
                    padding:'7px 16px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
                    border: `1px solid ${filter===f.v ? '#2563eb' : '#e2e8f0'}`,
                    background: filter===f.v ? '#2563eb' : '#fff',
                    color: filter===f.v ? '#fff' : '#64748b',
                    transition:'all .15s',
                  }}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>

          {(displayPosts as any[]).length === 0 ? (
            <div style={{ textAlign:'center', padding:'64px 24px', color:'#94a3b8' }}>
              <p style={{ fontSize:40, margin:'0 0 10px' }}>📭</p>
              <p style={{ fontSize:15 }}>Nenhuma publicação ainda.</p>
              {isAdmin && adminMode && (
                <button onClick={() => setNewPost(true)}
                  style={{ marginTop:16, background:'#2563eb', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontWeight:700, cursor:'pointer', fontSize:14 }}>
                  Criar primeiro post
                </button>
              )}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20 }}>
              {(displayPosts as any[]).map((post: any) => (
                <PostCard key={post.id} post={post} isAdmin={!!isAdmin && adminMode}
                  onEdit={setEditPost}
                  onDelete={(id: string) => { if (confirm('Remover post?')) deleteMutation.mutate(id); }} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background:'#0f172a', color:'#475569', padding:'32px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          <Image src="/logo-casca.png" alt="C.A.S.C.A" width={40} height={40} style={{ objectFit:'contain', opacity:.7, marginBottom:12 }} />
          <p style={{ margin:'0 0 8px', fontSize:14, color:'#64748b' }}>C.A.S.C.A — Centro de Apoio Sociocomunitário e Cultural de Araucária</p>
          <p style={{ margin:'0 0 16px', fontSize:12 }}>© {new Date().getFullYear()} Todos os direitos reservados · Araucária, Paraná</p>
          <Link href="/login" style={{ fontSize:12, color:'#3b82f6', textDecoration:'none' }}>Acessar sistema →</Link>
        </div>
      </footer>

      {/* Modais */}
      {(newPost || editPost) && (
        <PostModal post={editPost} onClose={() => { setNewPost(false); setEditPost(null); }} />
      )}
    </div>
  );
}
