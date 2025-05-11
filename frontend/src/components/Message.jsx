import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, BrainCircuit, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
// LaTeXサポート用ライブラリ
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// const REASONING_OPEN_STORAGE_KEY = 'reasoningDefaultOpen'; // localStorageを使用しないため削除

const Message = ({ message }) => {
  // --- State and Hooks ---
  // 初期状態を閉じた状態に変更
  const [isReasoningOpen, setIsReasoningOpen] = useState(false); // デフォルトで閉じる

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
  const markdownComponents = { // コードブロックと段落のカスタムレンダリング
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
    // p: ({ node, ...props }) => <p style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }} {...props} />
    // <p> の代わりに <div> を使用してネストエラーを回避
    // prose クラスが適用されているため、スタイルは維持されるはず
    // 段落間のスペースを維持するために mb-4 (Tailwindのマージンクラス) を追加
    p: ({ node, children, ...props }) => <div className="mb-4 last:mb-0" {...props}>{children}</div> // クラスを最小限にし、枠関連のクラスを削除
  };

  // --- Component Rendering ---
  return (
    <div>
      {/* ユーザーメッセージ */}
      {message.role === 'user' && (
        <div className="flex justify-end items-start mb-4 group">
          <div className="max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-3 rounded-xl shadow-none bg-gray-100 dark:bg-dark-background mr-2 break-words"> {/* 影を削除、背景色を親に合わせる */}
            <p className="text-gray-800 dark:text-dark-text" style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }}>{message.content}</p> {/* 文字色をAIメッセージに合わせる */}
          </div>
          <User className="w-8 h-8 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </div>
      )}

      {/* AI メッセージ */}
      {message.role === 'assistant' && (
        <div className="mb-4">
          {/* 思考プロセス (Reasoning) */}
          {/* 思考プロセス (Reasoning, Plan, Criticism) */}
          {(message.reasoning || message.plan || message.criticism) && (
            <div className="flex items-start mb-2 group">
              <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
                <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </div>
              <div className="w-full max-w-lg lg:max-w-xl xl:max-w-3xl px-3 py-2 rounded-xl shadow-none bg-gray-100 dark:bg-dark-background text-xs text-gray-700 dark:text-dark-text break-words"> {/* 影を削除、背景色を親に合わせる、文字色を調整 */}
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
                  {/* 推論 */}
                  {message.reasoning && (
                    <div className="mb-3">
                      <div className="font-bold text-gray-600 dark:text-gray-400">推論:</div>
                      <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                        {message.reasoning}
                      </pre>
                    </div>
                  )}
                  {/* 行動計画 */}
                  {message.plan && (
                    <div className="mb-3">
                      <div className="font-bold text-gray-600 dark:text-gray-400">行動計画:</div>
                      <pre className="whitespace-pre-wrap font-reasoning border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                        {message.plan}
                      </pre>
                    </div>
                  )}
                  {/* 自己批判 */}
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
          <div className="flex items-start group"> {/* flex items-start を適用 */}
            {/* アイコン用コンテナ (固定幅 + 中央揃え) - Botアイコンは元々w-8なので中央揃え不要かもだが統一 */}
            <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
              <Bot className="w-8 h-8 text-blue-400 dark:text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
            </div>
            <div
              className="max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-3 shadow-none bg-gray-100 dark:bg-dark-background break-words w-full border border-transparent" // パディングを元に戻す (px-4 py-3)
              // 強制的に枠線、アウトライン、ボックスシャドウ、背景画像、パディング、マージンをリセット
              // style={{ border: 'none !important', outline: 'none !important', boxShadow: 'none !important', backgroundImage: 'none !important', padding: '0 !important', margin: '0 !important' }} // インラインスタイルは一旦コメントアウト
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
