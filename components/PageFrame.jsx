import Link from 'next/link';

// Shared header/layout for login, account and admin pages.
export default function PageFrame({ title, children, wide = false }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-green-700 to-green-600 text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">FOJEC</Link>
          <span className="text-sm opacity-90">{title}</span>
        </div>
      </header>
      <main className={`mx-auto px-4 py-8 ${wide ? 'max-w-6xl' : 'max-w-md'}`}>
        {children}
      </main>
    </div>
  );
}
