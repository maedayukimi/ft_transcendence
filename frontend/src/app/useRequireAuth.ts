import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from './global';

// ログイン(サインアップ)済みでないユーザーを/loginへ弾く。
// authorizedがtrueになるまで、呼び出し側はデータ取得やsocket接続を行わないこと。
export function useRequireAuth(): boolean {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user.userId) {
      // pushだと履歴に「保護ページ→/login」の2つが積まれ、戻るボタンで
      // 保護ページに戻る→即座にまた弾かれる、を繰り返すループになる。
      // replaceで現在の履歴エントリを置き換えることでこれを避ける。
      router.replace('/login');
      return;
    }
    setAuthorized(true);
  }, [router]);

  return authorized;
}
