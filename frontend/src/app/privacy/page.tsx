export default function PrivacyPolicy() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="mb-2">プライバシーポリシー</h1>
      <p className="text-sm text-ink-muted">最終更新日: 2026年9月2日</p>

      <p className="mt-3 text-sm text-ink-muted sm:text-base">
        本ポリシーは、Werewolf Transcendence(以下「本サービス」)が、利用者の個人情報をどのように収集・利用・保管するかを説明するものです。
        本サービスは42のCommon Coreカリキュラムの一環として開発された学習・課題用プロジェクトであり、商用サービスではありません。
      </p>

      <h2 className="mt-8 mb-2">収集する情報</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted sm:text-base">
        <li>アカウント情報: ユーザー名、メールアドレス、パスワード(ハッシュ化して保存)</li>
        <li>チャットメッセージ: 送受信したメッセージの内容とタイムスタンプ</li>
        <li>ゲームデータ: 人狼ゲームの対戦結果、役職、投票内容、対戦成績</li>
        <li>フレンド関係: 追加したフレンドのユーザーID</li>
        <li>認証用Cookie: ログイン状態を維持するためのJWTトークン(httpOnly、第三者には送信されません)</li>
      </ul>

      <h2 className="mt-8 mb-2">利用目的</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted sm:text-base">
        <li>アカウントの認証・ログイン状態の維持</li>
        <li>チャット・人狼ゲームなどのサービス機能の提供</li>
        <li>対戦成績・プロフィールの表示</li>
      </ul>

      <h2 className="mt-8 mb-2">第三者への提供</h2>
      <p className="mt-3 text-sm text-ink-muted sm:text-base">
        本サービスは広告配信や解析目的で第三者に個人情報を提供することはありません。
        収集した情報は本サービスの機能提供の目的以外には使用しません。
      </p>

      <h2 className="mt-8 mb-2">データの保管</h2>
      <p className="mt-3 text-sm text-ink-muted sm:text-base">
        収集した情報はアカウントが存在する限りデータベースに保管されます。
        アカウントの削除やデータの削除を希望する場合は、開発チームまで直接ご連絡ください。
      </p>

      <h2 className="mt-8 mb-2">お問い合わせ</h2>
      <p className="mt-3 text-sm text-ink-muted sm:text-base">本ポリシーに関するお問い合わせは、開発チーム(42 Tokyo)まで直接ご連絡ください。</p>
    </div>
  );
}
