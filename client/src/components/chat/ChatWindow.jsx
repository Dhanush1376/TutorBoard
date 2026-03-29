import React, { useRef, useEffect } from 'react';
import Message from './Message';

const ChatWindow = ({ messages }) => {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="flex-1 flex flex-col no-scrollbar pointer-events-auto">
      <div className="flex flex-col gap-1 w-full pb-6 pt-10">
        {messages.map((msg, index) => (
          <Message 
            key={msg.id || index}
            role={msg.role}
            content={msg.content}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default ChatWindow;
