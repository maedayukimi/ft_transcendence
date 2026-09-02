import Link from 'next/link';
import { useState } from 'react'
import { ChatroomProps } from '../types/chatroom';

interface SidebarProps {
  rooms: ChatroomProps[];
  onRoomSelect: (roomType: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export default function Sidebar({ rooms, onRoomSelect, onDeleteRoom }: SidebarProps) {
    const [isPrivate, setIsPrivate] = useState('private');

    return (
        <aside className="w-full shrink-0 overflow-y-auto border-b border-line bg-canvas p-4 md:max-h-none md:w-64 md:border-r md:border-b-0">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              className={`btn btn-sm ${isPrivate === 'private' ? 'btn-primary' : ''}`}
              value='private'
              onClick={() => {
                setIsPrivate('private');
                onRoomSelect('private');
              }}>private</button>
            <button
              className={`btn btn-sm ${isPrivate === 'group' ? 'btn-primary' : ''}`}
              value='group'
              onClick={() => {
                setIsPrivate('group');
                onRoomSelect('group');
              }}>group</button>
          </div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-muted uppercase">Chat Rooms</h2>
          <div className="flex flex-col gap-1">
            {rooms.filter((room) => {
              return isPrivate === room.roomType;
            }).map((room) =>
              <div
              key={room.roomId}
              className="flex items-center justify-between gap-2 rounded-md px-1 hover:bg-line/40"
              >
                <Link href={`/chat/${room.roomType}/${room.roomId}`}
                className="flex-1 truncate px-2 py-2 text-sm"
                >
                  { room.roomName }
                </Link>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    onDeleteRoom(room.roomId);
                  }}>
                  削除
                </button>
              </div>
            )}
          </div>
        </aside>
    );
}
