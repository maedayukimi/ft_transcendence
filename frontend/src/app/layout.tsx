'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { socket } from './global';

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
        <div>
          {invite && (
            <div style={{ padding: '0.75rem', background: '#fff3cd', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span>{invite.fromUserName} さんが人狼ゲームに招待しています。</span>
              <button
                onClick={() => {
                  router.push(`/werewolf/${invite.gameId}`);
                  setInvite(null);
                }}
              >
                参加する
              </button>
              <button onClick={() => setInvite(null)}>閉じる</button>
            </div>
          )}
          <main>
            {children}
          </main>
          <footer style={{ padding: '1rem', borderTop: '1px solid #ccc', marginTop: '2rem' }}>
            <Link href="/privacy">プライバシーポリシー</Link>
            {' | '}
            <Link href="/terms">利用規約</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
