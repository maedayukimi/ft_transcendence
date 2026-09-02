'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './common/Sidebar';
import { socket, connectSocket, logout } from '../global';
import { ChatroomProps } from './types/chatroom';
import { getCurrentUser } from '../global';
import { useRequireAuth } from '../useRequireAuth';

export default function ChatLayout({
    children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    const authorized = useRequireAuth();
    const pathname = usePathname();
    const router = useRouter();
    const [groupUserNames, setGroupUserNames] = useState<string[]>([]);
    const [rooms, setRooms] = useState<ChatroomProps[]>([]);
    const [roomType, setRoomType] = useState('private');
    const [inviteError, setInviteError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);

    // ルーム一覧を取得
    useEffect(() => {
        if (!authorized) return;
        connectSocket();
        // joinRoomイベントリスナーを設定
        const handleJoinRoom = (response: ChatroomProps) => {
            console.log(`joinRoom received: userNames=${JSON.stringify(response.userNames)}, roomType=${response.roomType}`);
            // privateの場合は相手の名前をルーム名として使う
            if (response.roomType === 'private' && response.otherUserName) {
                response.roomName = response.otherUserName;
                console.log(`Set roomName to: ${response.roomName}`);
            }
            setRooms(prevRooms => [...prevRooms, response]);
        };

        // 相手が削除したルームを見続けて送信するたびエラーになる、を防ぐ。
        // 削除された瞬間に一覧から消し、今そのルームを見ていれば追い出す。
        const handleRoomDeleted = (payload: { roomId: string }) => {
            setRooms(prev => prev.filter(r => r.roomId !== payload.roomId));
            if (pathname.includes(payload.roomId)) {
                alert('このチャットルームは削除されました。');
                router.push('/chat');
            }
        };

        socket.on('joinRoom', handleJoinRoom);
        socket.on('roomDeleted', handleRoomDeleted);

        if (socket.connected) {
            socket.emit('getAllRoom', Number(getCurrentUser().userId), (response: ChatroomProps[]) => {
            console.log(`getAllRoom response: ${JSON.stringify(response)}`);
            // privateルームの場合、roomNameを相手の名前に設定
            const processedRooms = response.map(room => {
                if (room.roomType === 'private' && room.otherUserName) {
                    return { ...room, roomName: room.otherUserName };
                }
                return room;
            });
            setRooms(processedRooms);
            });
        } else {
            socket.once('connect', () => {
            socket.emit('getAllRoom', Number(getCurrentUser().userId), (response: ChatroomProps[]) => {
            console.log(`getAllRoom response: ${JSON.stringify(response)}`);
            // privateルームの場合、roomNameを相手の名前に設定
            const processedRooms = response.map(room => {
                if (room.roomType === 'private' && room.otherUserName) {
                    return { ...room, roomName: room.otherUserName };
                }
                return room;
            });
            setRooms(processedRooms);
            });
        });
    }
        console.log(`current_user is ${getCurrentUser().userId}`);

        // クリーンアップ: イベントリスナーを削除
        return () => {
            socket.off('joinRoom', handleJoinRoom);
            socket.off('roomDeleted', handleRoomDeleted);
        };
    }, [authorized, pathname, router]);

    const handleRoomChange = (newRoomType: string) => {
        setRoomType(newRoomType);
    };

    const handleDeleteRoom = (roomId: string) => {
      socket.emit('deleteRoom', roomId, (response: ChatroomProps & { save: boolean }) => {
        if (response.save) {
          setRooms(rooms.filter((r) => r.roomId !== roomId));
        } else {
          console.error('ルームの削除に失敗しました:', roomId);
        }
      });
    };

    if (!authorized) return null;

    async function handleLogout() {
      await logout();
      // 全ページ・全状態を確実にリセットするためフルリロードで遷移する
      window.location.href = '/';
    }

    return (
      <div className="flex h-[calc(100vh-8rem)] min-h-[32rem] flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3 shadow-sm">
          <h1 className="text-base font-bold sm:text-lg">Chat Application</h1>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            <Link className="navlink" href="/werewolf">Werewolf</Link>
            <Link className="navlink" href="/friends">Friends</Link>
            <button className="navlink" onClick={handleLogout}>Log Out</button>
          </nav>
          <button className="btn btn-primary btn-sm" onClick={ ()=> { setInviteError(null); dialogRef.current?.showModal(); } }>招待</button>
          <dialog className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-line p-5 backdrop:bg-black/40" ref={dialogRef}>
                <form onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const formData = new FormData(form);

                    // privateルームを作成して相手を招待(ユーザー名指定)
                    if (roomType === 'private') {
                        const targetUserName = String(formData.get('userName') ?? '').trim();
                        socket.emit('createRoom', { targetUserNames: [targetUserName], roomName: '', roomType: 'private' }, (response: ChatroomProps & { error?: string }) => {
                        console.log(`createRoom response: userNames=${JSON.stringify(response.userNames)}, roomType=${response.roomType}`);
                        if (response.save) {
                            //privateの場合は相手の名前をルーム名として使う
                            response.roomName = response.otherUserName ?? response.roomName;
                            console.log(`Set roomName to: ${response.roomName}`);
                            // 既に同じ相手とのprivateルームが一覧にあれば重複追加しない
                            setRooms(prev => prev.some(r => r.roomId === response.roomId) ? prev : [...prev, response]);
                            form.reset();
                            dialogRef.current?.close();
                        } else {
                            setInviteError(response.error ?? '指定したユーザーが見つかりません。');
                        }
                        });
                    } else {
                        // groupルームを作成して相手を招待(ユーザー名指定)
                        const groupName = String(formData.get('groupName'));
                        socket.emit('createRoom', { targetUserNames: groupUserNames, roomName: groupName, roomType: 'group' }, (response: ChatroomProps & { error?: string }) => {
                        console.log(`createRoom response: ${JSON.stringify(response)}`);
                        if (response.save) {
                            setRooms([...rooms, response]);
                            setGroupUserNames([]);
                            form.reset();
                            dialogRef.current?.close();
                        } else {
                            setInviteError(response.error ?? '指定したユーザーが見つかりません。');
                        }
                        });
                    }
                }} className="flex flex-col gap-3">
                {/* モーダルダイアログの表示内容をprivateかgroupで切り替える */}
                    {roomType === 'private' ? <input
                        className='field'
                        type='text'
                        name='userName'
                        placeholder='ユーザー名を入力'
                    />:
                    <div className='flex flex-col gap-3'>
                        <input
                            className='field'
                            type='text'
                            name='groupName'
                            placeholder='グループ名を入力'
                        />
                        <div className='flex flex-col gap-2'>
                            <input
                                className='field'
                                type='text'
                                id='tempUserName'
                                placeholder='ユーザー名を入力'
                            />
                            <button className='btn btn-sm self-start' type='button' onClick={(event) => {
                                const input = document.getElementById('tempUserName') as HTMLInputElement;
                                const name = input.value.trim();
                                if (name.length > 0 && !groupUserNames.includes(name)) {
                                    setGroupUserNames([...groupUserNames, name]);
                                    input.value = '';
                                }
                            }}>追加</button>
                            {groupUserNames.map((name, index) =>  (
                                <div className='flex items-center justify-between rounded-md bg-canvas px-3 py-2 text-sm' key={name}>
                                    <span>ユーザー名: {name}</span>
                                    <button className='btn btn-sm' type='button' onClick={() => {
                                        setGroupUserNames(groupUserNames.filter((_, i) => i !== index));
                                    }}>削除</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    }
                    <input className='btn btn-primary' type='submit' value='招待'/>
                    {inviteError && <p className='text-sm text-red-600'>{inviteError}</p>}
                </form>
                <button className='btn btn-sm mt-3 w-full' onClick={() => {dialogRef.current?.close();}}>Close</button>
            </dialog>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          {/* サイドバー */}
          <Sidebar rooms={rooms} onRoomSelect={handleRoomChange} onDeleteRoom={handleDeleteRoom}/>
          {/* メインコンテンツエリア */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    );
  }
