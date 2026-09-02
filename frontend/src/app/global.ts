import io from "socket.io-client";

// Next.jsのHMR（Fast Refresh）対策
// グローバルオブジェクトに保存してモジュール再評価時も接続を維持
declare global {
  var socketInstance: ReturnType<typeof io> | undefined;
  var werewolfSocketInstance: ReturnType<typeof io> | undefined;
  var currentUser :{ userId: string, userName: string };
}

export const getSocket = () => {
  if (!global.socketInstance) {
    console.log('🔌 Socket.IO接続を作成');
    global.socketInstance = io({
      transports: ['websocket', 'polling'],
      autoConnect: false,  // 自動接続を無効化
      withCredentials: true,
    });

    // 接続イベントのデバッグ
    global.socketInstance.on('connect', () => {
      console.log('✅ 接続成功! Socket ID:', global.socketInstance?.id);
    });

    global.socketInstance.on('disconnect', () => {
      console.log('❌ 切断されました');
    });

    global.socketInstance.on('reconnect', () => {
      console.log('🔄 再接続しました! Socket ID:', global.socketInstance?.id);
    });
  } else {
    console.log('♻️  既存のSocket.IO接続を再利用 Socket ID:', global.socketInstance?.id);
  }
  return global.socketInstance;
};

// Socket接続を手動で開始する関数
export const connectSocket = () => {
  const socket = getSocket();
  if (!socket.connected) {
    console.log('🔌 Socket接続を開始します');
    socket.connect();
  }
};

// Socket切断
export const disconnectSocket = () => {
  const socket = getSocket();
  if (socket.connected) {
    console.log('🔌 Socket接続を切断します');
    socket.disconnect();
  }
};

// 後方互換性のため
export const socket = getSocket();

export const getWerewolfSocket = () => {
  if (!global.werewolfSocketInstance) {
    global.werewolfSocketInstance = io("/werewolf", {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      withCredentials: true,
    });
  }
  return global.werewolfSocketInstance;
};

export const connectWerewolfSocket = () => {
  const socket = getWerewolfSocket();
  if (!socket.connected) {
    socket.connect();
  }
};

export const setCurrentUser = (userId: string, userName: string) => {
  const user = { userId, userName };
  global.currentUser = user;
  // localStorageに永続化（リロード対策）
  if (typeof window !== 'undefined') {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
}

export const getCurrentUser = () => {
  // メモリにあればそれを返す
  if (global.currentUser) {
    return global.currentUser;
  }

  // なければlocalStorageから復元
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      global.currentUser = JSON.parse(stored);
      return global.currentUser;
    }
  }

  return { userId: '', userName: '' };
}

export const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // サーバーへの通知が失敗しても、クライアント側の状態は必ずクリアする
  }

  disconnectSocket();
  if (global.werewolfSocketInstance?.connected) {
    global.werewolfSocketInstance.disconnect();
  }

  global.currentUser = { userId: '', userName: '' };
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentUser');
  }
}
