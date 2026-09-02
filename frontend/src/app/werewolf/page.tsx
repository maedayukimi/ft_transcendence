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
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-1">
        <Link className="navlink" href="/chat">Chat</Link>
        <Link className="navlink" href="/friends">Friends</Link>
        <button className="navlink" onClick={handleLogout}>Log Out</button>
      </nav>
      <h1 className="mb-4">人狼ゲーム</h1>
      <div className="card flex flex-col gap-4">
        <label className="label">
          ゲームID
          <input
            className="field"
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn btn-primary flex-1" onClick={() => enterGame('createGame')}>新しいゲームを作成</button>
          <button className="btn flex-1" onClick={() => enterGame('joinGame')}>既存のゲームに参加</button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
