'use client'

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '../../useRequireAuth';

type FriendStatus = 'NONE' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED';

interface Progression {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  current: number;
  target: number;
}

interface ProfileData {
  userId: number;
  userName: string;
  timeStamp: string;
  stats: { gamesPlayed: number; wins: number; losses: number };
  /** 全プレイヤー中の順位。0 戦なら null。 */
  rank: number | null;
  progression: Progression;
  achievements: Achievement[];
  friendStatus: FriendStatus;
  isSelf: boolean;
}

interface HistoryOpponent {
  userId: number;
  userName: string;
  finalRole: string;
  won: boolean;
}

interface HistoryEntry {
  matchId: string;
  gameId: string;
  finalRole: string;
  won: boolean;
  playerCount: number;
  timeStamp: string;
  opponents: HistoryOpponent[];
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

  if (error) return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-red-600">{error}</p>;
  if (!profile) return <p className="mx-auto max-w-3xl px-4 py-8 text-sm text-ink-muted">読み込み中...</p>;

  const { stats, progression, achievements } = profile;
  const winRate = stats.gamesPlayed === 0 ? 0 : Math.round((stats.wins / stats.gamesPlayed) * 100);
  const xpPercent = Math.round((progression.xpIntoLevel / progression.xpForNextLevel) * 100);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-1">
        <Link className="navlink" href="/">Home</Link>
        <Link className="navlink" href="/chat">Chat</Link>
        <Link className="navlink" href="/werewolf">Werewolf</Link>
        <Link className="navlink" href="/friends">Friends</Link>
        <Link className="navlink" href="/leaderboard">Leaderboard</Link>
      </nav>

      <h1 className="mb-1">{profile.userName} のプロフィール</h1>
      <p className="text-sm text-ink-muted">登録日: {new Date(profile.timeStamp).toLocaleDateString('ja-JP')}</p>

      <h2 className="mt-8 mb-3">戦績</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card text-center">
          <dt className="text-xs text-ink-muted">順位</dt>
          <dd className="text-2xl font-bold">{profile.rank === null ? '-' : `${profile.rank}位`}</dd>
        </div>
        <div className="card text-center">
          <dt className="text-xs text-ink-muted">対戦数</dt>
          <dd className="text-2xl font-bold">{stats.gamesPlayed}</dd>
        </div>
        <div className="card text-center">
          <dt className="text-xs text-ink-muted">勝ち</dt>
          <dd className="text-2xl font-bold">{stats.wins}</dd>
        </div>
        <div className="card text-center">
          <dt className="text-xs text-ink-muted">負け</dt>
          <dd className="text-2xl font-bold">{stats.losses}</dd>
        </div>
        <div className="card text-center">
          <dt className="text-xs text-ink-muted">勝率</dt>
          <dd className="text-2xl font-bold">{winRate}%</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm">
        {profile.rank === null ? (
          <span className="text-ink-muted">まだ対戦記録がないため、リーダーボードには載っていません。</span>
        ) : (
          <Link href="/leaderboard" className="text-indigo-600 hover:text-indigo-700 hover:underline">
            リーダーボードで全体の順位を見る
          </Link>
        )}
      </p>

      <h2 className="mt-8 mb-3">レベル</h2>
      <div className="card">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">Lv. {progression.level}</span>
          <span className="text-sm text-ink-muted">
            {progression.xpIntoLevel} / {progression.xpForNextLevel} XP(累計 {progression.xp} XP)
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="次のレベルまでの進捗"
          aria-valuemin={0}
          aria-valuemax={progression.xpForNextLevel}
          aria-valuenow={progression.xpIntoLevel}
        >
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${xpPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">1戦ごとに 10 XP、勝利でさらに 15 XP。100 XP ごとにレベルが上がります。</p>
      </div>

      <h2 className="mt-8 mb-3">実績({unlockedCount} / {achievements.length})</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {achievements.map((a) => (
          <li
            key={a.id}
            className={`card py-3 text-sm ${a.unlocked ? 'border-amber-300 bg-amber-50' : 'opacity-70'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">
                {a.unlocked ? '🏆 ' : '🔒 '}
                {a.title}
              </span>
              <span className="text-xs text-ink-muted">{a.current} / {a.target}</span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{a.description}</p>
          </li>
        ))}
      </ul>

      {!profile.isSelf && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {profile.friendStatus === 'FRIENDS' && (
            <button className="btn" onClick={removeFriend}>フレンド解除</button>
          )}
          {profile.friendStatus === 'NONE' && (
            <button className="btn btn-primary" onClick={sendFriendRequest}>フレンド申請を送る</button>
          )}
          {profile.friendStatus === 'REQUEST_SENT' && (
            <>
              <span className="text-sm text-ink-muted">申請中です。相手の返事をお待ちください。</span>
              <button className="btn btn-sm" onClick={removeFriend}>申請を取り消す</button>
            </>
          )}
          {profile.friendStatus === 'REQUEST_RECEIVED' && (
            <>
              <span className="text-sm text-ink-muted">このユーザーからフレンド申請が届いています。</span>
              <button className="btn btn-sm btn-primary" onClick={acceptFriendRequest}>承認</button>
              <button className="btn btn-sm" onClick={removeFriend}>拒否</button>
            </>
          )}
        </div>
      )}

      <h2 className="mt-8 mb-3">対戦履歴</h2>
      {history.length === 0 && <p className="text-sm text-ink-muted">まだ対戦記録がありません。</p>}
      <ul className="flex flex-col gap-2">
        {history.map((h) => (
          <li className="card py-3 text-sm" key={h.matchId ?? `${h.gameId}-${h.timeStamp}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {new Date(h.timeStamp).toLocaleString('ja-JP')} — {h.playerCount}人戦 — 役職: {roleLabel(h.finalRole)}
              </span>
              <span className={`font-semibold ${h.won ? 'text-emerald-600' : 'text-red-600'}`}>
                {h.won ? '勝利' : '敗北'}
              </span>
            </div>
            <div className="mt-2 text-xs text-ink-muted">
              対戦相手:{' '}
              {h.opponents.length === 0 ? (
                <span>(記録なし)</span>
              ) : (
                h.opponents.map((o, i) => (
                  <span key={o.userId}>
                    {i > 0 && '、'}
                    <Link
                      href={`/profile/${o.userId}`}
                      className="text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {o.userName}
                    </Link>
                    ({roleLabel(o.finalRole)}・{o.won ? '勝' : '負'})
                  </span>
                ))
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
