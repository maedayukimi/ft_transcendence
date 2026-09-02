'use client'
import { useSyncExternalStore } from 'react';
import { getCurrentUser, logout } from './global';
import Link from 'next/link';

// ログイン状態は変化を購読する仕組みがない(ログイン/ログアウト後はフルリロードする)ので、購読は no-op。
const subscribeNoop = () => () => {};
// サーバー側と hydration 中は null を返し、その間は何も描画しない。
const getServerSnapshot = () => null;

export default function Home() {
  // getCurrentUser() は localStorage を読むため、レンダー中にそのまま呼ぶとサーバー側(未ログイン)と
  // クライアント側(ログイン済み)の HTML が食い違って hydration error になる。
  // useSyncExternalStore でサーバー側のスナップショットを null にし、hydration 後にクライアントの値へ切り替える。
  const currentUser = useSyncExternalStore(subscribeNoop, getCurrentUser, getServerSnapshot);

  if (currentUser === null) return null;

  if (!currentUser.userId) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="card flex flex-col gap-6 text-center">
          <h1>Werewolf Transcendence</h1>
          <p className="text-sm text-ink-muted">ログインして、チャットと人狼ゲームを始めましょう。</p>
          <nav className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link className="btn btn-primary" href='/login'>Log In</Link>
            <Link className="btn" href='/signup'>Sign Up</Link>
          </nav>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    // 全ページ・全状態を確実にリセットするためフルリロードで遷移する
    window.location.href = '/';
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6">ようこそ、{currentUser.userName} さん</h1>
      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Link className="btn" href='/chat'>Chat</Link>
        <Link className="btn" href='/werewolf'>Werewolf</Link>
        <Link className="btn" href='/friends'>Friends</Link>
        <Link className="btn" href='/leaderboard'>Leaderboard</Link>
        <Link className="btn" href={`/profile/${currentUser.userId}`}>My Profile</Link>
      </nav>
      <button className="btn mt-6" onClick={handleLogout}>Log Out</button>
    </div>
  );
}
