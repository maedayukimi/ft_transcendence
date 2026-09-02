import { useState, useCallback, useContext } from 'react'
import { socket } from "../../global"
import styles from './MessageInput.module.css';
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
          className={styles.form}
        >
            <input
                id="inputText"
                type="text"
                value={inputText}
                onChange={(event) => {
                  setInputText(event.target.value);
                }}
                className={styles.input}
              />
            <input
              id="sendButton"
              type="submit"
              value="送信"
              className={styles.submitButton}
            />
          </form>
    );
}