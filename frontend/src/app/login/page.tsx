'use client'

import { useRouter } from "next/navigation";
import { setCurrentUser, connectSocket } from "../global";

export default function Login() {
    const router = useRouter();
    async function handleSubmit(event:React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        console.log(event.currentTarget);
        try {
            const response = await fetch(
                '/api/auth/login',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',  // Cookieを送受信するために必要
                    body: JSON.stringify({
                        userName: formData.get('username'),
                        emailAddress: formData.get('emailaddress'),
                        password: formData.get('password')
                    })
                }
            );
            console.log(response);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = Array.isArray(body?.message) ? body.message.join('\n') : body?.message;
                throw new Error(message ?? '通信に失敗しました。');
            }
            const data = await response.json();
            console.log(`ログイン: ${data.success}`);

            setCurrentUser(data.userId, data.userName);
            if (!data.success)
                throw new Error('ユーザーが存在しない');

            // ログイン成功後にSocket接続を開始
            connectSocket();

            router.push(`/chat`);
        } catch(e) {
            if (e instanceof Error)
                alert(e.message);
        }
    }
    return (
     <div className="mx-auto w-full max-w-md px-4 py-10">
        <form className="card flex flex-col gap-4" onSubmit={handleSubmit}>
            <h1>ログイン画面</h1>
            <hr className="border-line"/>
            <label className="label">
                ユーザー名
                <input
                className="field"
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={20}
                />
            </label>
            <label className="label">
                メールアドレス
                <input
                className="field"
                type="email"
                name="emailaddress"
                required
                />
            </label>
            <label className="label">
                パスワード
                <input
                className="field"
                type="password"
                name="password"
                required
                minLength={8}
                maxLength={72}
                />
            </label>
            <input className="btn btn-primary" type="submit" value="ログイン"/>
        </form>
     </div>
    );
}