export interface ChatroomProps {
    save: boolean
    roomName: string
    roomId: string
    userNames: string[]
    otherUserName?: string | null
    roomType: string
}