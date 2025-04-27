import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { Send } from 'lucide-react';

const ChatInput = ({ 
  input,
  onInputChange,
  onSubmit,
  isLoading,
  onKeyPress
}) => {
  return (
    <div className="flex items-end gap-2 p-4 bg-white dark:bg-dark-card shadow-inner">
      <TextareaAutosize
        value={input}
        onChange={onInputChange}
        onKeyPress={onKeyPress}
        placeholder="メッセージを入力..."
        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:bg-gray-700 dark:text-dark-text transition resize-none overflow-hidden"
        disabled={isLoading}
        minRows={1}
        maxRows={6}
      />
      <button
        onClick={onSubmit}
        disabled={isLoading || !input.trim()}
        className="p-2 rounded-lg text-white bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 transition"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ChatInput;
