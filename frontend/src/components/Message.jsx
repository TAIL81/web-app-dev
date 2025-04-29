/*
 * frontend/src/components/Message.jsx
 * AIメッセージ本文の背景色を薄い青系に変更
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, BrainCircuit, ChevronDown, ChevronUp } from 'lucide-react';

const Message = ({ message }) => {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  // hidden メッセージはレンダリングしない
  if (message.hidden) {
    return null;
  }

  // --- ▼ AIメッセージ本文用の背景色クラスを定義 ▼ ---
  // ユーザーメッセージ (bg-blue-100 dark:bg-blue-900) との区別を明確にするため、
  // 薄いスカイブルー系を選択 (Tailwind CSS v3 の色を使用)
  const aiMessageBgColor = 'bg-sky-50 dark:bg-sky-900/60';
  // --- ▲ AIメッセージ本文用の背景色クラスを定義 ▲ ---

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
          {/* 思考プロセス (Reasoning) - 背景色は変更しない */}
          {message.reasoning && message.reasoning !== "（Reasoningなし）" && (
            <div className="flex justify-start items-start mb-2 group">
              <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              <div className="w-full max-w-lg lg:max-w-xl px-3 py-2 rounded-lg shadow bg-gray-200 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 break-words">
                <button
                  onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                  className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none w-full text-left mb-1"
                  aria-expanded={isReasoningOpen} // アクセシビリティ属性
                >
                  {isReasoningOpen ? <ChevronUp size={16} className="mr-1 flex-shrink-0" /> : <ChevronDown size={16} className="mr-1 flex-shrink-0" />}
                  <span className="font-semibold">思考プロセス詳細</span>
                  <span className="ml-auto text-gray-400 dark:text-gray-500">({isReasoningOpen ? '閉じる' : '表示'})</span>
                </button>
                {isReasoningOpen && (
                  <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1">
                    {message.reasoning}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Agentic Tooling (Tool Calls) - 背景色は変更しない */}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="flex justify-start items-start mb-2 group">
              <BrainCircuit className="w-6 h-6 text-yellow-500 dark:text-yellow-400 mr-2 flex-shrink-0 mt-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-300 transition-colors" />
              <div className="w-full max-w-lg lg:max-w-xl px-3 py-2 rounded-lg shadow bg-yellow-100 dark:bg-yellow-900 text-xs text-yellow-800 dark:text-yellow-200 break-words">
                <p className="font-semibold mb-1">ツール呼び出し:</p>
                {message.tool_calls.map((toolCall, index) => (
                  <div key={index} className="mb-1 last:mb-0">
                    <p className="font-mono text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{toolCall.function.name}</span>({JSON.stringify(toolCall.function.arguments)})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI 回答本文 */}
          <div className="flex justify-start items-start group">
            <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 mr-2 flex-shrink-0 mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
            {/* --- ▼ 背景色クラスを aiMessageBgColor に変更 ▼ --- */}
            <div className={`prose prose-sm max-w-lg lg:max-w-xl px-4 py-2 rounded-lg shadow ${aiMessageBgColor} dark:prose-invert break-words w-full`}>
            {/* --- ▲ 背景色クラスを aiMessageBgColor に変更 ▲ --- */}
              {message.content ? (
                <ReactMarkdown components={{ p: ({node, ...props}) => <p style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }} {...props} /> }}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                // コンテンツがない場合のフォールバック
                !message.reasoning && (!message.tool_calls || message.tool_calls.length === 0) && "..."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;
