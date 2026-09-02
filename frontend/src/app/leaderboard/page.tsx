'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '../global';
import { useRequireAuth } from '../useRequireAuth';

interface LeaderboardEntry {
  rank: number;
  userId: number;
  userName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  level: number;
}

export default function LeaderboardPage() {
  const authorized = useRequireAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // SSR/ハイドレーション時は authorized が false なので localStorage を読まない。
  const myUserId = authorized ? Number(getCurrentUser().userId) : null;

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    fetch('/api/leaderboard', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('リーダーボードの取得に失敗しました。');
        return (await res.json()) as LeaderboardEntry[];
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'リーダーボードの取得に失敗しました。');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authorized]);

  if (!authorized) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">リーダーボード</h1>
      <p className="mt-1 text-sm text-slate-600">
        人狼ゲームの勝利数ランキング(上位20人)。同じ勝利数なら勝率、次に対戦数の多い順です。
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {!error && !loaded && <p className="mt-4 text-sm text-slate-500">読み込み中...</p>}
      {!error && loaded && entries.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">
          まだ対戦記録がありません。人狼ゲームを1戦遊ぶとここに表示されます。
        </p>
      )}

      {entries.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">順位</th>
                <th scope="col" className="px-4 py-3">プレイヤー</th>
                <th scope="col" className="px-4 py-3 text-right">Lv</th>
                <th scope="col" className="px-4 py-3 text-right">対戦</th>
                <th scope="col" className="px-4 py-3 text-right">勝</th>
                <th scope="col" className="px-4 py-3 text-right">負</th>
                <th scope="col" className="px-4 py-3 text-right">勝率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.map((entry) => {
                const isMe = entry.userId === myUserId;
                return (
                  <tr
                    key={entry.userId}
                    className={isMe ? 'bg-indigo-50 font-medium text-indigo-900' : 'text-slate-800'}
                  >
                    <td className="px-4 py-3">{entry.rank}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/profile/${entry.userId}`}
                        className="text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        {entry.userName}
                      </Link>
                      {isMe && <span className="ml-2 text-xs text-indigo-600">(あなた)</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{entry.level}</td>
                    <td className="px-4 py-3 text-right">{entry.gamesPlayed}</td>
                    <td className="px-4 py-3 text-right">{entry.wins}</td>
                    <td className="px-4 py-3 text-right">{entry.losses}</td>
                    <td className="px-4 py-3 text-right">{Math.round(entry.winRate * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/" className="text-indigo-600 hover:text-indigo-700 hover:underline">
          トップへ戻る
        </Link>
      </p>
    </div>
  );
}
