import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, BrainCircuit, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const Message = ({ message }) => {
  // --- State and Hooks ---
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const [copiedStates, setCopiedStates] = useState({});

  // コードブロックのコピー処理
  const handleCopy = useCallback((codeToCopy, index) => {
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopiedStates(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [index]: false }));
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
  }, []);

  // 早期リターン: hidden プロパティを持つメッセージはレンダリングしない
  if (message.hidden) {
    return null;
  }

  // --- Markdown Components for ReactMarkdown ---
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const codeBlockIndex = node.position?.start.line ?? Math.random();

      return !inline ? (
        <div className="code-block relative group my-4 rounded-md bg-gray-800 dark:bg-gray-900 font-mono text-sm">
          <button
            onClick={() => handleCopy(codeString, codeBlockIndex)}
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
    p: ({ node, children, ...props }) => <div className="mb-4 last:mb-0" {...props}>{children}</div>,
  };

  // --- Component Rendering ---
  return (
    <div className="relative">
      <style jsx>{`
        /* KaTeX 数式用のカスタムスタイル */
        .katex {
          font-size: 1em; /* フォントサイズを調整 */
          margin: 0; /* 余分なマージンを削除 */
          padding: 0; /* 余分なパディングを削除 */
        }
        .katex-display {
          display: block; /* ブロック数式を適切に配置 */
          margin: 0.5em 0; /* 上下のマージンを制御 */
          overflow-x: auto; /* 横スクロールを許可 */
          overflow-y: hidden; /* 縦スクロールを防止 */
          max-width: 100%; /* 親コンテナの幅に制限 */
        }
        .katex-html {
          overflow: hidden; /* 数式内の余分なスクロールを防止 */
        }
        .message-container {
          overflow-y: hidden; /* メッセージ全体の縦スクロールを防止 */
        }
      `}</style>

      {/* ユーザーメッセージ */}
      {message.role === 'user' && (
        <div className="flex justify-end items-start mb-4 group message-container">
          <div className="max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-3 rounded-xl shadow-none bg-gray-100 dark:bg-dark-background mr-2 break-words">
            <p className="text-gray-800 dark:text-dark-text" style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}>{message.content}</p>
          </div>
          <User className="w-8 h-8 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </div>
      )}

      {/* AI メッセージ */}
      {message.role === 'assistant' && (
        <div className="mb-4 message-container">
          {/* 思考プロセス (Reasoning, Plan, Criticism) */}
          {(message.reasoning || message.plan || message.criticism) && (
            <div className="flex items-start mb-2 group">
              <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
                <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </div>
              <div className="w-full max-w-lg lg:max-w-xl xl:max-w-3xl px-3 py-2 rounded-xl shadow-none bg-gray-100 dark:bg-dark-background text-xs text-gray-700 dark:text-dark-text break-words">
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
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isReasoningOpen ? 'max-h-[20rem] overflow-y-auto' : 'max-h-0'}`}
                >
                  {message.reasoning && (
                    <div className="mb-3">
                      <div className="font-bold text-gray-600 dark:text-gray-400">推論:</div>
                      <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                        {message.reasoning}
                      </pre>
                    </div>
                  )}
                  {message.plan && (
                    <div className="mb-3">
                      <div className="font-bold text-gray-600 dark:text-gray-400">行動計画:</div>
                      <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                        {message.plan}
                      </pre>
                    </div>
                  )}
                  {message.criticism && (
                    <div className="mb-3">
                      <div className="font-bold text-gray-600 dark:text-gray-400">自己批判:</div>
                      <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                        {message.criticism}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI 回答本文 */}
          <div className="flex items-start group">
            <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
              <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
            </div>
            <div
              className="max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-3 shadow-none bg-gray-100 dark:bg-dark-background break-words w-full border border-transparent"
            >
              <div className="prose prose-sm sm:prose dark:prose-invert max-w-none text-gray-800 dark:text-dark-text">
                {message.content ? (
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  !message.reasoning && (!message.tool_calls || message.tool_calls.length === 0) && "..."
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;