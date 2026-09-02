import Link from 'next/link';
import styles from './Sidebar.module.css';
import { useState } from 'react'
import { ChatroomProps } from '../types/chatroom';

interface SidebarProps {
  rooms: ChatroomProps[];
  onRoomSelect: (roomType: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export default function Sidebar({ rooms, onRoomSelect, onDeleteRoom }: SidebarProps) {
    const [isPrivate, setIsPrivate] = useState('private');

    console.log(`rooms are ${rooms.forEach((room) => console.log(room.roomName))} in sidebar.`);
    return (
        <aside className={styles.aside}>
          <div>
            <button value='private' onClick={() => {
              setIsPrivate('private');
              onRoomSelect('private');
            }}><strong>private</strong></button>
            <button value='group' onClick={() => {
              setIsPrivate('group');
              onRoomSelect('group');
            }}>group</button>
          </div>
          <h2 className={styles.heading}>Chat Rooms</h2>
          {rooms.filter((room) => {
            return isPrivate === room.roomType;
          }).map((room) =>
            <div
            key={room.roomId}
            className={styles.roomIDsContainer}
            >
              <Link href={`/chat/${room.roomType}/${room.roomId}`}
              className={styles.roomItem}
              >
                { room.roomName }
              </Link>
              <button
                className={styles.deleteButton}
                onClick={() => {
                  onDeleteRoom(room.roomId);
                }}>
                削除
              </button>
            </div>
          )}
        </aside>
    );
}