'use client'
import { getCurrentUser, logout } from './global';
import Link from 'next/link';

export default function Home() {
  const currentUser = getCurrentUser();

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
      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link className="btn" href='/chat'>Chat</Link>
        <Link className="btn" href='/werewolf'>Werewolf</Link>
        <Link className="btn" href='/friends'>Friends</Link>
        <Link className="btn" href={`/profile/${currentUser.userId}`}>My Profile</Link>
      </nav>
      <button className="btn mt-6" onClick={handleLogout}>Log Out</button>
    </div>
  );
}
