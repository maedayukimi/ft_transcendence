'use client'

import Chatroom from "../../common/Chatroom";
import { roomIdContext } from "../../common/roomIdContext";
import { use } from "react";

export default function GroupChat({
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