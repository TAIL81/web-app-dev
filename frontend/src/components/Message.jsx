import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';

const Message = ({ message }) => {
  // --- ▼ 思考プロセス (Reasoning) の開閉状態を管理 ▼ ---
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  // --- ▲ 思考プロセス (Reasoning) の開閉状態を管理 ▲ ---

  // hidden メッセージはレンダリングしない
  if (message.hidden) {
    return null;
  }

  // --- ▼ message.content に対する <output> 処理は不要なので削除 ▼ ---
  // let beforeOutput = '';
  // let outputContent = null;
  // let afterOutput = '';
  // let hasOutput = false;
  //
  // if (message.role === 'assistant' && message.content) {
  //   console.log('AI Content:', message.content);
  //   const outputRegex = /(<tool>[\s\S]*?<\/tool>\s*)?<output>([\s\S]*?)<\/output>/s;
  //   const match = message.content.match(outputRegex);
  //   console.log('Regex Match Result:', match);
  //
  //   if (match) {
  //     // ... (省略) ...
  //   } else {
  //     beforeOutput = message.content;
  //   }
  // }
  // --- ▲ message.content に対する <output> 処理は不要なので削除 ▲ ---


  return (
    <div>
      {/* ユーザーメッセージ (変更なし) */}
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
          {/* --- ▼ 思考プロセス (Reasoning) の折りたたみ表示に変更 ▼ --- */}
          {message.reasoning && message.reasoning !== "（Reasoningなし）" && (
            <div className="flex justify-start items-start mb-2 group">
              <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              <div className="w-full max-w-lg lg:max-w-xl px-3 py-2 rounded-lg shadow bg-gray-200 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 break-words">
                <button
                  onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                  className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none w-full text-left mb-1" // mb-1 を追加
                >
                  {isReasoningOpen ? <ChevronUp size={16} className="mr-1 flex-shrink-0" /> : <ChevronDown size={16} className="mr-1 flex-shrink-0" />}
                  <span className="font-semibold">思考プロセス詳細</span>
                  <span className="ml-auto text-gray-400 dark:text-gray-500">({isReasoningOpen ? '閉じる' : '表示'})</span>
                </button>
                {/* isReasoningOpen が true の場合のみ内容を表示 */}
                {isReasoningOpen && (
                  <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1"> {/* 区切り線とパディング */}
                    {message.reasoning}
                  </pre>
                )}
              </div>
            </div>
          )}
          {/* --- ▲ 思考プロセス (Reasoning) の折りたたみ表示に変更 ▲ --- */}


          {/* AI 回答本文 (message.content をそのまま表示) */}
          <div className="flex justify-start items-start group">
            <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 mr-2 flex-shrink-0 mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
            <div className="prose prose-sm max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow bg-white dark:bg-dark-card dark:prose-invert break-words w-full">
              {/* message.content を ReactMarkdown で表示 */}
              {message.content ? (
                <ReactMarkdown components={{ p: ({node, ...props}) => <p style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }} {...props} /> }}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                // コンテンツがない場合のフォールバック
                !message.reasoning && "..."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;
