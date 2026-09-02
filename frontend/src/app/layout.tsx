'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { socket } from './global';
import './globals.css';

interface WerewolfInvite {
  gameId: string;
  fromUserId: number;
  fromUserName: string;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [invite, setInvite] = useState<WerewolfInvite | null>(null);

  // ソケットはグローバルなsingletonなので、どのページを見ていても
  // 招待を受け取れるようlayoutで一括して購読する。
  useEffect(() => {
    const handleInvite = (payload: WerewolfInvite) => setInvite(payload);
    socket.on('werewolfInvite', handleInvite);
    return () => {
      socket.off('werewolfInvite', handleInvite);
    };
  }, []);

  return (
    <html
      lang="ja"
    >
      <body>
        <div className="flex min-h-screen flex-col">
          {invite && (
            <div className="flex flex-col gap-2 border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
              <span className="flex-1">{invite.fromUserName} さんが人狼ゲームに招待しています。</span>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    router.push(`/werewolf/${invite.gameId}`);
                    setInvite(null);
                  }}
                >
                  参加する
                </button>
                <button className="btn btn-sm" onClick={() => setInvite(null)}>閉じる</button>
              </div>
            </div>
          )}
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-line bg-surface px-4 py-4 text-sm text-ink-muted">
            <Link className="hover:text-ink hover:underline" href="/privacy">プライバシーポリシー</Link>
            <span className="px-2">|</span>
            <Link className="hover:text-ink hover:underline" href="/terms">利用規約</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
