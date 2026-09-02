'use client'

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectWerewolfSocket, getWerewolfSocket, getCurrentUser, connectSocket, socket as chatSocket } from '../../global';
import { useRequireAuth } from '../../useRequireAuth';
import {
  Ack,
  PlayerInspection,
  PlayerView,
  PlayerViewPlayer,
  Role,
} from '../types';

type Act = (event: string, payload?: Record<string, unknown>) => void;

function roleLabel(role: Role | null): string {
  switch (role) {
    case 'WEREWOLF': return '人狼';
    case 'VILLAGER': return '村人';
    case 'SEER': return '占い師';
    case 'ROBBER': return '怪盗';
    default: return '不明';
  }
}

export default function WerewolfGame({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = use(params);
  const authorized = useRequireAuth();
  const router = useRouter();
  const currentUser = getCurrentUser();
  const myUserId = Number(currentUser.userId);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [friends, setFriends] = useState<{ userId: number; userName: string }[]>([]);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!authorized) return;
    connectSocket();
    fetch('/api/friends', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then(setFriends)
      .catch(() => setFriends([]));
  }, [authorized]);

  const inviteFriend = (targetUserId: number, targetUserName: string) => {
    setInviteFeedback(null);
    chatSocket.emit(
      'inviteToWerewolf',
      { targetUserId, gameId },
      (ack: { success: boolean; error?: string }) => {
        setInviteFeedback(
          ack.success
            ? `${targetUserName} さんに招待を送りました。`
            : (ack.error ?? '招待に失敗しました。'),
        );
      },
    );
  };

  useEffect(() => {
    if (!authorized) return;
    connectWerewolfSocket();
    const socket = getWerewolfSocket();

    const handleState = (state: PlayerView) => {
      setView(state);
      // 誰かの操作で状態が動いた=もう古いエラーなので消す
      setError(null);
    };

    // 切断→自動再接続の際、サーバー側のソケットは新しい接続として扱われ
    // ルームへの参加状態が失われる。'connect'のたびにjoinGameを送り直すことで
    // ネットワーク瞬断からの自動復帰(リロード不要)を成立させる。
    const rejoin = () => {
      socket.emit('joinGame', { gameId }, (ack: Ack) => {
        if (!ack.success) setError(ack.message);
      });
    };
    const handleConnect = () => {
      setConnected(true);
      rejoin();
    };
    const handleDisconnect = () => {
      setConnected(false);
    };

    socket.on('state', handleState);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      rejoin();
    }

    return () => {
      socket.off('state', handleState);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [gameId, authorized]);

  const act: Act = (event, payload = {}) => {
    const socket = getWerewolfSocket();
    socket.emit(event, { gameId, ...payload }, (ack: Ack) => {
      if (!ack.success) setError(ack.message);
    });
  };

  if (!authorized) return null;

  if (!view) {
    return <p>{error ?? '読み込み中...'}</p>;
  }

  const others = view.players.filter((p) => p.userId !== myUserId);
  const me = view.players.find((p) => p.userId === myUserId);
  // ROLE_REVEAL/NIGHT_ACTION/DISCUSSIONはドメイン側に必須アクターがいないため、
  // 全員が同時に「次へ」を押すと1クリックで複数フェーズ進んでしまうレースがある。
  // 誰か1人だけが進行操作をできるよう、先頭プレイヤー(ホスト)に限定する。
  const isHost = view.players[0]?.userId === myUserId;
  const allReady = view.players.length >= 3 && view.players.every((p) => p.ready);

  return (
    <div>
      <h1>人狼ゲーム: {gameId}</h1>
      {!connected && <p style={{ color: 'orange' }}>接続が切れました。再接続しています...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <ul>
        {view.players.map((p) => (
          <li key={p.userId}>
            {p.userName}
            {p.userId === myUserId ? '(あなた)' : ''}
            {view.phase === 'LOBBY' ? (p.ready ? ' - 準備完了' : ' - 未準備') : ''}
            {view.phase === 'VOTING' ? (p.hasVoted ? ' - 投票済み' : ' - 未投票') : ''}
          </li>
        ))}
      </ul>

      {view.phase === 'LOBBY' && (
        <div>
          <button onClick={() => act('setReady', { ready: !me?.ready })}>
            {me?.ready ? '準備解除' : '準備完了'}
          </button>
          {isHost ? (
            <button onClick={() => act('startGame')} disabled={!allReady}>
              ゲーム開始(3〜5人・全員準備完了で押せます)
            </button>
          ) : (
            <p>ホストがゲームを開始するのを待っています...</p>
          )}
          <button
            onClick={() => {
              act('leaveGame');
              router.push('/werewolf');
            }}
          >
            ロビーを離れる
          </button>

          <h2>フレンドを招待</h2>
          {friends.length === 0 && <p>招待できるフレンドがいません。</p>}
          <ul>
            {friends.map((f) => (
              <li key={f.userId}>
                {f.userName}
                <button onClick={() => inviteFriend(f.userId, f.userName)}>招待</button>
              </li>
            ))}
          </ul>
          {inviteFeedback && <p>{inviteFeedback}</p>}
        </div>
      )}

      {view.phase === 'ROLE_REVEAL' && (
        <div>
          <p>あなたの役職: {roleLabel(view.ownInitialRole)}</p>
          {isHost ? (
            <button onClick={() => act('advancePhase')}>次へ</button>
          ) : (
            <p>ホストが次に進めるのを待っています...</p>
          )}
        </div>
      )}

      {view.phase === 'NIGHT_ACTION' && (
        <div>
          {view.ownInitialRole === 'WEREWOLF' && (
            <p>
              仲間の人狼:{' '}
              {view.werewolfTeammateUserIds.length > 0
                ? view.werewolfTeammateUserIds
                    .map((id) => view.players.find((p) => p.userId === id)?.userName)
                    .join(', ')
                : 'いません(ひとり狼)'}
            </p>
          )}
          <SeerPanel view={view} others={others} act={act} />
          <RobberPanel view={view} others={others} act={act} />
          {isHost ? (
            <button onClick={() => act('advancePhase')}>次へ</button>
          ) : (
            <p>ホストが次に進めるのを待っています...</p>
          )}
        </div>
      )}

      {view.phase === 'DISCUSSION' && (
        <div>
          <p>議論タイム。話し合いが終わったら投票に進みましょう。</p>
          {isHost ? (
            <button onClick={() => act('advancePhase')}>投票へ進む</button>
          ) : (
            <p>ホストが投票を開始するのを待っています...</p>
          )}
        </div>
      )}

      {view.phase === 'VOTING' && (
        <div>
          <p>怪しいと思うプレイヤーに投票してください。</p>
          {!me?.hasVoted &&
            others.map((p) => (
              <button key={p.userId} onClick={() => act('vote', { targetUserId: p.userId })}>
                {p.userName} に投票
              </button>
            ))}
          {isHost ? (
            <button onClick={() => act('advancePhase')}>結果を見る</button>
          ) : (
            <p>ホストが結果を表示するのを待っています...</p>
          )}
        </div>
      )}

      {view.phase === 'RESULT' && view.result && (
        <div>
          <h2>{view.result.winner === 'VILLAGE' ? '村人陣営の勝利' : '人狼陣営の勝利'}</h2>
          <ul>
            {view.result.players.map((p) => (
              <li key={p.userId}>
                {p.userName}: {roleLabel(p.finalRole)}
                {p.executed ? '(処刑された)' : ''} - 得票数 {p.votesReceived}
              </li>
            ))}
          </ul>
          {isHost ? (
            <button onClick={() => act('restartGame')}>同じメンバーでもう一度あそぶ</button>
          ) : (
            <p>ホストがもう一度あそぶのを待っています...</p>
          )}
          <button
            onClick={() => {
              act('leaveGame');
              router.push('/werewolf');
            }}
          >
            ロビーを離れる
          </button>
        </div>
      )}
    </div>
  );
}

function SeerPanel({
  view,
  others,
  act,
}: {
  view: PlayerView;
  others: PlayerViewPlayer[];
  act: Act;
}) {
  const showActionUI = view.availableAction === 'SEER_INSPECT';
  const myInspection =
    view.privateInspection?.kind === 'SEER_PLAYER' ||
    view.privateInspection?.kind === 'SEER_CENTER'
      ? view.privateInspection
      : null;

  if (!showActionUI && !myInspection) return null;

  return (
    <div>
      {showActionUI && (
        <>
          <p>占い師: 他プレイヤーを1人のカードを見るか、中央のカードを2枚とも見るか選べます。</p>
          {others.map((p) => (
            <button
              key={p.userId}
              onClick={() =>
                act('seerAction', {
                  action: { kind: 'PLAYER', targetUserId: p.userId },
                })
              }
            >
              {p.userName} のカードを見る
            </button>
          ))}
          <button
            onClick={() =>
              act('seerAction', {
                action: { kind: 'CENTER', centerCardIds: ['center-0', 'center-1'] },
              })
            }
          >
            中央カードを2枚とも見る
          </button>
        </>
      )}
      {!showActionUI && myInspection && (
        <SeerInspectionResult inspection={myInspection} players={view.players} />
      )}
    </div>
  );
}

function SeerInspectionResult({
  inspection,
  players,
}: {
  inspection: PlayerInspection;
  players: PlayerViewPlayer[];
}) {
  if (inspection.kind === 'SEER_PLAYER') {
    const target = players.find((p) => p.userId === inspection.targetUserId);
    return (
      <p>
        {target?.userName} の役職: {roleLabel(inspection.role)}
      </p>
    );
  }
  if (inspection.kind === 'SEER_CENTER') {
    return (
      <p>
        中央カード:{' '}
        {inspection.centerCardIds
          .map((id, i) => `${id === 'center-0' ? '1' : '2'}枚目=${roleLabel(inspection.roles[i])}`)
          .join(', ')}
      </p>
    );
  }
  return null;
}

function RobberPanel({
  view,
  others,
  act,
}: {
  view: PlayerView;
  others: PlayerViewPlayer[];
  act: Act;
}) {
  const showActionUI = view.availableAction === 'ROBBER_SWAP';
  const myInspection =
    view.privateInspection?.kind === 'ROBBER_SWAP' ? view.privateInspection : null;

  if (!showActionUI && !myInspection) return null;

  return (
    <div>
      {showActionUI && (
        <>
          <p>怪盗: 他のプレイヤーと役職を交換できます。</p>
          {others.map((p) => (
            <button key={p.userId} onClick={() => act('robberAction', { targetUserId: p.userId })}>
              {p.userName} と交換する
            </button>
          ))}
        </>
      )}
      {!showActionUI && myInspection && (
        <p>あなたの新しい役職: {roleLabel(myInspection.newRole)}</p>
      )}
    </div>
  );
}
