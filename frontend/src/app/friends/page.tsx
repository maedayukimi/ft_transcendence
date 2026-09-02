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
    <div>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/chat">Chat</Link>
        <Link href="/werewolf">Werewolf</Link>
        <button onClick={handleLogout}>Log Out</button>
      </nav>
      <h1>フレンド一覧</h1>

      <form onSubmit={handleSendRequest}>
        <label>
          ユーザー名でフレンド申請
          <input
            type="text"
            value={friendUserName}
            onChange={(e) => setFriendUserName(e.target.value)}
            required
          />
        </label>
        <button type="submit">申請する</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {message && <p style={{ color: 'green' }}>{message}</p>}

      <h2>届いているフレンド申請</h2>
      <ul>
        {pendingRequests.map((r) => (
          <li key={r.userId}>
            <Link href={`/profile/${r.userId}`}>{r.userName}</Link>
            <button onClick={() => handleAccept(r.userId)}>承認</button>
            <button onClick={() => handleReject(r.userId)}>拒否</button>
          </li>
        ))}
      </ul>
      {pendingRequests.length === 0 && <p>届いている申請はありません。</p>}

      <h2>フレンド</h2>
      <ul>
        {friends.map((f) => (
          <li key={f.userId}>
            <Link href={`/profile/${f.userId}`}>{f.userName}</Link>
            <button onClick={() => handleMessage(f.userName)}>メッセージ</button>
            <button onClick={() => handleRemove(f.userId)}>解除</button>
          </li>
        ))}
      </ul>
      {friends.length === 0 && <p>フレンドはまだいません。</p>}
    </div>
  );
}
