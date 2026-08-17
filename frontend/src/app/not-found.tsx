import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl font-black text-slate-200 select-none mb-4">404</div>
        <h1 className="text-2xl font-bold text-slate-800">Página não encontrada</h1>
        <p className="text-slate-500 mt-2 text-sm">A página que você tentou acessar não existe.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 mt-6 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition">
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
