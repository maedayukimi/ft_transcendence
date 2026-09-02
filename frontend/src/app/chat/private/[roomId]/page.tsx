'use client'
import { roomIdContext } from "../../common/roomIdContext";
import Chatroom from "../../common/Chatroom";
import { use } from "react";

export default function PrivateChat({
    params
}: {
    params: Promise<{ roomId: string }>
}) {
    const { roomId } = use(params);
    return (
        <roomIdContext.Provider value={roomId}>
        <Chatroom />
        </roomIdContext.Provider>
    );
}