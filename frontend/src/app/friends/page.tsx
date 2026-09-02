'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout, connectSocket, socket } from '../global';
import { useRequireAuth } from '../useRequireAuth';

interface FriendEntry {
  userId: number;
  userName: string;
}

export default function FriendsPage() {
  const authorized = useRequireAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendEntry[]>([]);
  const [friendUserName, setFriendUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const [friendsRes, requestsRes] = await Promise.all([
      fetch('/api/friends', { credentials: 'include' }),
      fetch('/api/friends/requests', { credentials: 'include' }),
    ]);
    if (friendsRes.ok) setFriends(await friendsRes.json());
    if (requestsRes.ok) setPendingRequests(await requestsRes.json());
  };

  useEffect(() => {
    if (!authorized) return;
    load();
    connectSocket();
  }, [authorized]);

  if (!authorized) return null;

  async function handleSendRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendUserName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? 'フレンド申請に失敗しました。');
      return;
    }
    const body = await res.json();
    setMessage(
      body.status === 'ACCEPTED'
        ? `${body.userName} と相互にフレンド申請していたため、フレンドになりました。`
        : `${body.userName} にフレンド申請を送りました。`,
    );
    setFriendUserName('');
    load();
  }

  async function handleAccept(requesterUserId: number) {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/friends/${requesterUserId}/accept`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setError('承認に失敗しました。');
      return;
    }
    load();
  }

  async function handleReject(requesterUserId: number) {
    await fetch(`/api/friends/${requesterUserId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    load();
  }

  async function handleRemove(friendUserId: number) {
    await fetch(`/api/friends/${friendUserId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    load();
  }

  function handleMessage(friendUserName: string) {
    setError(null);
    const emitCreateRoom = () => {
      socket.emit(
        'createRoom',
        { targetUserNames: [friendUserName], roomName: '', roomType: 'private' },
        (response: { save: boolean; roomId: string; error?: string }) => {
          if (response.save) {
            router.push(`/chat/private/${response.roomId}`);
          } else {
            setError(response.error ?? 'チャットの開始に失敗しました。');
          }
        },
      );
    };
    // このページ経由で来た場合、まだ default namespace のソケットが
    // 接続完了していないことがある(connectSocket()は非同期)ので、
    // 未接続なら接続完了を待ってから送信する。
    if (socket.connected) {
      emitCreateRoom();
    } else {
      socket.once('connect', emitCreateRoom);
    }
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/';
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-1">
        <Link className="navlink" href="/chat">Chat</Link>
        <Link className="navlink" href="/werewolf">Werewolf</Link>
        <Link className="navlink" href="/leaderboard">Leaderboard</Link>
        <button className="navlink" onClick={handleLogout}>Log Out</button>
      </nav>
      <h1 className="mb-4">フレンド一覧</h1>

      <form className="card flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSendRequest}>
        <label className="label flex-1">
          ユーザー名でフレンド申請
          <input
            className="field"
            type="text"
            value={friendUserName}
            onChange={(e) => setFriendUserName(e.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" type="submit">申請する</button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

      <h2 className="mt-8 mb-3">届いているフレンド申請</h2>
      <ul className="flex flex-col gap-2">
        {pendingRequests.map((r) => (
          <li className="card flex flex-wrap items-center gap-2 py-3" key={r.userId}>
            <Link className="flex-1 font-medium hover:underline" href={`/profile/${r.userId}`}>{r.userName}</Link>
            <button className="btn btn-sm btn-primary" onClick={() => handleAccept(r.userId)}>承認</button>
            <button className="btn btn-sm" onClick={() => handleReject(r.userId)}>拒否</button>
          </li>
        ))}
      </ul>
      {pendingRequests.length === 0 && <p className="text-sm text-ink-muted">届いている申請はありません。</p>}

      <h2 className="mt-8 mb-3">フレンド</h2>
      <ul className="flex flex-col gap-2">
        {friends.map((f) => (
          <li className="card flex flex-wrap items-center gap-2 py-3" key={f.userId}>
            <Link className="flex-1 font-medium hover:underline" href={`/profile/${f.userId}`}>{f.userName}</Link>
            <button className="btn btn-sm" onClick={() => handleMessage(f.userName)}>メッセージ</button>
            <button className="btn btn-sm" onClick={() => handleRemove(f.userId)}>解除</button>
          </li>
        ))}
      </ul>
      {friends.length === 0 && <p className="text-sm text-ink-muted">フレンドはまだいません。</p>}
    </div>
  );
}
