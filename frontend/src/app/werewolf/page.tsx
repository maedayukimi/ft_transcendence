'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { connectWerewolfSocket, getWerewolfSocket, logout } from '../global';
import { useRequireAuth } from '../useRequireAuth';
import { Ack } from './types';

export default function WerewolfLobby() {
  const authorized = useRequireAuth();
  const router = useRouter();
  const [gameId, setGameId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!authorized) return null;

  function enterGame(mode: 'createGame' | 'joinGame') {
    if (gameId.trim().length === 0) {
      setError('ゲームIDを入力してください。');
      return;
    }
    connectWerewolfSocket();
    const socket = getWerewolfSocket();
    socket.emit(mode, { gameId }, (ack: Ack) => {
      if (!ack.success) {
        setError(ack.message);
        return;
      }
      router.push(`/werewolf/${gameId}`);
    });
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/';
  }

  return (
    <div>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/chat">Chat</Link>
        <Link href="/friends">Friends</Link>
        <button onClick={handleLogout}>Log Out</button>
      </nav>
      <h1>人狼ゲーム</h1>
      <label>
        ゲームID
        <input
          type="text"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
      </label>
      <button onClick={() => enterGame('createGame')}>新しいゲームを作成</button>
      <button onClick={() => enterGame('joinGame')}>既存のゲームに参加</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
