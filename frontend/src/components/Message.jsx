import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, BrainCircuit } from 'lucide-react';

const Message = ({ message }) => {
  // hidden メッセージはレンダリングしない
  if (message.hidden) {
    return null;
  }

  return (
    <div>
      {/* ユーザーメッセージ */}
      {message.role === 'user' && (
        <div className="flex justify-end items-start mb-4 group">
          <div className="max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-blue-100 dark:bg-blue-900 dark:bg-opacity-80 mr-2 break-words">
            <p className="text-gray-800 dark:text-dark-text" style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}>{message.content}</p>
          </div>
          <User className="w-8 h-8 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </div>
      )}

      {/* AI メッセージ */}
      {message.role === 'assistant' && (
        <div className="mb-4">
          {/* 思考プロセス */}
          {message.reasoning && message.reasoning !== "（Reasoningなし）" && (
            <div className="flex justify-start items-start mb-2 group">
              <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              <div className="max-w-lg lg:max-w-xl px-3 py-2 rounded-lg shadow bg-gray-200 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 break-words">
                <pre className="whitespace-pre-wrap font-reasoning">{message.reasoning}</pre>
              </div>
            </div>
          )}

          {/* AI 回答本文 */}
          <div className="flex justify-start items-start group">
            <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 mr-2 flex-shrink-0 mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
            {/* prose-invert で typography プラグインのダークモードスタイルを適用 */}
            <div className="prose prose-sm max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-white dark:bg-dark-card dark:prose-invert break-words">
              <ReactMarkdown
                components={{
                  p: ({node, ...props}) => <p style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }} {...props} />
                }}
              >
                {message.content || "..."}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;
