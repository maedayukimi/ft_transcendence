'use client'
import { useCallback, useContext, useEffect, useState } from "react";
import { socket, getCurrentUser } from "../../global";
import MessageInput from "./MessageInput";
import { Message } from "../types/message";
import { ChatroomProps } from "../types/chatroom";
import { roomIdContext } from "./roomIdContext";

export default function Chatroom() {
    const roomId = useContext(roomIdContext);
    const [chatLog, setChatLog] = useState<Message[] >([]);
    const [sendError, setSendError] = useState<string | null>(null);
    const currentUser = getCurrentUser();

    // ルームに参加。ルームを切り替えたとき/離れるときは前のルームを
    // ちゃんとleaveしないと、そのルーム宛のブロードキャストを受信し続けてしまう。
    useEffect(() => {
        if (roomId) {
            socket.emit('joinRoom', roomId);
        }
        return () => {
            if (roomId) {
                socket.emit('leaveRoom', roomId);
            }
        };
    }, [roomId]);
    // const msgData: Message[] = [{
    //     msgId: '1',
    //     userId: '1',
    //     userName: 'あなた',
    //     roomId: 'room1',
    //     text: 'こんにちは！',
    //     timeStamp: new Date('2024-01-01T10:00:00')
    // },
    // {
    //     msgId: '2',
    //     userId: '2',
    //     userName: '太郎',
    //     roomId: 'room1',
    //     text: 'やあ、元気？',
    //     timeStamp: new Date('2024-01-01T10:01:00')
    // },
    // {
    //     msgId: '3',
    //     userId: '1',
    //     userName: 'あなた',
    //     roomId: 'room1',
    //     text: '元気だよ！',
    //     timeStamp: new Date('2024-01-01T10:02:00')
    // },
    // {
    //     msgId: '4',
    //     userId: '3',
    //     userName: '花子',
    //     roomId: 'room1',
    //     text: 'こんにちは〜',
    //     timeStamp: new Date('2024-01-01T10:03:00')
    // }]; //backendからroomIDのメッセージデータを個別取得した定
    // const currentUser_id: string = '1'; //backendからloginしているユーザーidを取得した定
    useEffect(() => {
        const handleMessage = (message: Message) => {
            // 過去にjoinしたまま残っている別ルーム宛のイベントを拾わないよう、
            // 表示中のルーム宛のメッセージだけ反映する。
            if (String(message.roomId) !== roomId) return;
            setChatLog(prev => [...prev, message]);  // 関数型更新
        };

        socket.on('receivedMessage', handleMessage);

        // クリーンアップ
        return () => {
            socket.off('receivedMessage', handleMessage);
        };
    }, [roomId]);
    useEffect(() => {
        if (!roomId) return;
        setChatLog([]); // ルーム切り替え時に前のルームの履歴が一瞬混ざるのを防ぐ
        setSendError(null);
        socket.emit('getAllMessage', roomId, (response:Message[]) => {
            setChatLog(response);
        })
    }, [roomId]);
    const handleSendMessage = useCallback((text: string, roomId: string): void => {
        socket.emit('sendMessage', { roomId: roomId, text: text }, (response: any) => {
            if (response.error) {
                setSendError(response.error);
            } else {
                setSendError(null);
                // receivedMessageイベントでchatLogが更新されるので、ここでは何もしない
            }
        });
    }, []);
    return (
        <div className="flex h-full flex-col bg-surface">
            <div className="flex-1 overflow-y-auto p-4">
                {chatLog.map((msg) => {
                    const isMyMessage = currentUser.userId === msg.userId;
                    return (
                    <div
                        className={`mb-2 flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                        key={msg.msgId}
                    >
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm break-words sm:max-w-[70%] ${isMyMessage ? 'bg-brand text-white' : 'bg-canvas text-ink'}`}>
                            {!isMyMessage && <span className="mr-1 font-bold">{msg.userName}:</span>}
                            {msg.text}
                        </div>
                    </div>
                    )})
                }
            </div>
            {sendError && <p className="px-4 pb-2 text-sm text-red-600">{sendError}</p>}
            <MessageInput onSendMessage={handleSendMessage}/>
        </div>
    );
}