import { useState, useCallback, useContext } from 'react'
import { socket } from "../../global"
import { Message } from '../types/message';
import { roomIdContext } from './roomIdContext';

export default function MessageInput({ 
  onSendMessage
}: {
  onSendMessage: (text: string, roomId: string) => void
}) {
    const roomId = useContext(roomIdContext);
    const [inputText, setInputText] = useState('');
    // const onClickSubmit = useCallback(() => {
    // console.log(inputText);
    // socket.emit('message', inputText, (text:string) => {

    // });
    // }, [inputText]);
    return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (inputText.trim().length === 0) return;
            onSendMessage(inputText, roomId);
            setInputText('');
          }}
          className="mt-auto flex w-full gap-2 border-t border-line bg-surface p-3 sm:p-4"
        >
            <input
                id="inputText"
                type="text"
                value={inputText}
                onChange={(event) => {
                  setInputText(event.target.value);
                }}
                className="field flex-1"
              />
            <input
              id="sendButton"
              type="submit"
              value="送信"
              className="btn btn-primary"
            />
          </form>
    );
}