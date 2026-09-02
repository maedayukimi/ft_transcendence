'use client'
import { getCurrentUser, logout } from './global';
import Link from 'next/link';

export default function Home() {
  const currentUser = getCurrentUser();

  if (!currentUser.userId) {
    return (
      <div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <Link href='/login'>Log In</Link>
          <Link href='/signup'>Sign Up</Link>
        </nav>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    // 全ページ・全状態を確実にリセットするためフルリロードで遷移する
    window.location.href = '/';
  }

  return (
    <div>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link href='/chat'>Chat</Link>
        <Link href='/werewolf'>Werewolf</Link>
        <Link href='/friends'>Friends</Link>
        <Link href={`/profile/${currentUser.userId}`}>My Profile</Link>
        <button onClick={handleLogout}>Log Out</button>
      </nav>
    </div>
  );
}
