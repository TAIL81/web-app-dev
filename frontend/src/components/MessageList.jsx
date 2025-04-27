import React from 'react';

const MessageList = ({ messages }) => {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div key={index} className="p-4 rounded-lg shadow">
          <div className="font-bold">{message.role === 'user' ? 'You' : 'Assistant'}</div>
          <div className="mt-2">{message.content}</div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;
