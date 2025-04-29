/*
 * frontend/src/components/Message.jsx
 * 修正: フック呼び出しをトップレベルに移動
 */
import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, BrainCircuit, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

const REASONING_OPEN_STORAGE_KEY = 'reasoningDefaultOpen';

const Message = ({ message }) => {
  // --- ▼ フック呼び出しをコンポーネントのトップレベルに集約 ▼ ---
  const getInitialReasoningOpen = useCallback(() => { // useCallback を追加 (必須ではないが、関数定義をメモ化)
    const storedValue = localStorage.getItem(REASONING_OPEN_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : false;
  }, []); // 依存配列は空

  const [isReasoningOpen, setIsReasoningOpen] = useState(getInitialReasoningOpen);
  const [copiedStates, setCopiedStates] = useState({});

  useEffect(() => {
    localStorage.setItem(REASONING_OPEN_STORAGE_KEY, JSON.stringify(isReasoningOpen));
  }, [isReasoningOpen]);

  // コードブロックのコピー処理 (useCallback を早期リターンの前に移動)
  const handleCopy = useCallback((codeToCopy, index) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [index]: false }));
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  }, []); // 依存配列は空のまま
  // --- ▲ フック呼び出しをコンポーネントのトップレベルに集約 ▲ ---

  // --- ▼ 早期リターン: hidden メッセージはレンダリングしない ▼ ---
  if (message.hidden) {
    return null; // フック呼び出しの後なので問題ない
  }
  // --- ▲ 早期リターン ▲ ---

  // AIメッセージ本文用の背景色クラス
  const aiMessageBgColor = 'bg-sky-50 dark:bg-sky-900/60';

  // --- ▼ react-markdown のカスタムコンポーネント (変更なし) ▼ ---
  // handleCopy はトップレベルで定義されているため、ここで安全に使用できる
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const codeBlockIndex = node.position?.start.line ?? Math.random();

      return !inline ? (
        <div className="code-block relative group my-4 rounded-md bg-gray-800 dark:bg-gray-900 font-mono text-sm">
          <button
            onClick={() => handleCopy(codeString, codeBlockIndex)} // handleCopy を使用
            className="absolute top-2 right-2 p-1.5 bg-gray-600 dark:bg-gray-700 rounded-md text-gray-300 hover:text-white hover:bg-gray-500 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={copiedStates[codeBlockIndex] ? "コピーしました" : "コードをコピー"}
            title={copiedStates[codeBlockIndex] ? "コピーしました" : "コードをコピー"}
          >
            {copiedStates[codeBlockIndex] ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <SyntaxHighlighter
            style={document.documentElement.classList.contains('dark') ? vscDarkPlus : coy}
            language={match ? match[1] : undefined}
            PreTag="div"
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={`px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-red-600 dark:text-red-400 font-mono text-sm ${className || ''}`} {...props}>
          {children}
        </code>
      );
    },
    p: ({ node, ...props }) => <p style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }} {...props} />
  };
  // --- ▲ react-markdown のカスタムコンポーネント ▲ ---

  // --- ▼ JSX レンダリング部分 (変更なし) ▼ ---
  return (
    <div>
      {/* ユーザーメッセージ */}
      {message.role === 'user' && (
        <div className="flex justify-end items-start mb-4 group">
          <div className="max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-2 rounded-lg shadow bg-blue-100 dark:bg-blue-900 dark:bg-opacity-80 mr-2 break-words">
            <p className="text-gray-800 dark:text-dark-text" style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}>{message.content}</p>
          </div>
          <User className="w-8 h-8 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </div>
      )}

      {/* AI メッセージ */}
      {message.role === 'assistant' && (
        <div className="mb-4">
          {/* 思考プロセス (Reasoning) */}
          {message.reasoning && message.reasoning !== "（Reasoningなし）" && (
            <div className="flex justify-start items-start mb-2 group">
              <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0 mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              <div className="w-full max-w-lg lg:max-w-xl xl:max-w-3xl px-3 py-2 rounded-lg shadow bg-gray-200 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 break-words">
                <button
                  onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                  className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none w-full text-left mb-1"
                  aria-expanded={isReasoningOpen}
                >
                  {isReasoningOpen ? <ChevronUp size={16} className="mr-1 flex-shrink-0" /> : <ChevronDown size={16} className="mr-1 flex-shrink-0" />}
                  <span className="font-semibold">思考プロセス詳細</span>
                  <span className="ml-auto text-gray-400 dark:text-gray-500">({isReasoningOpen ? '閉じる' : '表示'})</span>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                    isReasoningOpen ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                    {message.reasoning}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Agentic Tooling (Tool Calls) */}
          {message.tool_calls && message.tool_calls.length > 0 && (
             <div className="flex justify-start items-start mb-2 group">
               <BrainCircuit className="w-6 h-6 text-yellow-500 dark:text-yellow-400 mr-2 flex-shrink-0 mt-1 group-hover:text-yellow-600 dark:group-hover:text-yellow-300 transition-colors" />
               <div className={`w-full max-w-lg lg:max-w-xl xl:max-w-3xl px-3 py-2 rounded-lg shadow bg-yellow-100 dark:bg-yellow-900/70 text-xs text-yellow-800 dark:text-yellow-200 break-words transition-colors duration-150 hover:bg-yellow-200 dark:hover:bg-yellow-800/80`}>
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
            <div className={`prose prose-sm max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-2 rounded-lg shadow ${aiMessageBgColor} dark:prose-invert break-words w-full`}>
              {message.content ? (
                <ReactMarkdown components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              ) : (
                !message.reasoning && (!message.tool_calls || message.tool_calls.length === 0) && "..."
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  // --- ▲ JSX レンダリング部分 ▲ ---
};

export default Message;
