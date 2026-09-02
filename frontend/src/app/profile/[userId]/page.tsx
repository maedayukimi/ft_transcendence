'use client'

import { use, useEffect, useState } from 'react';
import { useRequireAuth } from '../../useRequireAuth';

type FriendStatus = 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';

interface ProfileData {
  userId: number;
  userName: string;
  timeStamp: string;
  stats: { gamesPlayed: number; wins: number; losses: number };
  friendStatus: FriendStatus;
  isSelf: boolean;
}

interface HistoryEntry {
  gameId: string;
  finalRole: string;
  won: boolean;
  playerCount: number;
  timeStamp: string;
}

function roleLabel(role: string): string {
  switch (role) {
    case 'WEREWOLF': return '人狼';
    case 'VILLAGER': return '村人';
    case 'SEER': return '占い師';
    case 'ROBBER': return '怪盗';
    default: return role;
  }
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const authorized = useRequireAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch(`/api/users/${userId}`, { credentials: 'include' }),
        fetch(`/api/users/${userId}/history`, { credentials: 'include' }),
      ]);
      if (!profileRes.ok) throw new Error('プロフィールの取得に失敗しました。');
      setProfile(await profileRes.json());
      setHistory(historyRes.ok ? await historyRes.json() : []);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, authorized]);

  if (!authorized) return null;

  async function sendFriendRequest() {
    if (!profile) return;
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendUserName: profile.userName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? 'フレンド申請に失敗しました。');
      return;
    }
    load();
  }

  async function acceptFriendRequest() {
    if (!profile) return;
    const res = await fetch(`/api/friends/${profile.userId}/accept`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setError('承認に失敗しました。');
      return;
    }
    load();
  }

  async function removeFriend() {
    if (!profile) return;
    const res = await fetch(`/api/friends/${profile.userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      setError('操作に失敗しました。');
      return;
    }
    load();
  }

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!profile) return <p>読み込み中...</p>;

  return (
    <div>
      <h1>{profile.userName} のプロフィール</h1>
      <p>登録日: {new Date(profile.timeStamp).toLocaleDateString('ja-JP')}</p>

      <h2>戦績</h2>
      <p>
        対戦数: {profile.stats.gamesPlayed} / 勝ち: {profile.stats.wins} / 負け: {profile.stats.losses}
      </p>

      {!profile.isSelf && (
        <p>
          {profile.friendStatus === 'FRIENDS' && (
            <button onClick={removeFriend}>フレンド解除</button>
          )}
          {profile.friendStatus === 'NONE' && (
            <button onClick={sendFriendRequest}>フレンド申請を送る</button>
          )}
          {profile.friendStatus === 'REQUEST_SENT' && (
            <>
              <span>申請中です。相手の返事をお待ちください。</span>
              <button onClick={removeFriend}>申請を取り消す</button>
            </>
          )}
          {profile.friendStatus === 'REQUEST_RECEIVED' && (
            <>
              <span>このユーザーからフレンド申請が届いています。</span>
              <button onClick={acceptFriendRequest}>承認</button>
              <button onClick={removeFriend}>拒否</button>
            </>
          )}
        </p>
      )}

      <h2>対戦履歴</h2>
      {history.length === 0 && <p>まだ対戦記録がありません。</p>}
      <ul>
        {history.map((h, i) => (
          <li key={i}>
            {new Date(h.timeStamp).toLocaleString('ja-JP')} — {h.playerCount}人戦 — 役職: {roleLabel(h.finalRole)} — {h.won ? '勝利' : '敗北'}
          </li>
        ))}
      </ul>
    </div>
  );
}
