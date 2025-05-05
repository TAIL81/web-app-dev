import React, { useState, useEffect, useCallback } from 'react'; // useCallback を追加
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, BrainCircuit, ChevronDown, ChevronUp, Copy, Check, Search, Code } from 'lucide-react'; // Search, Code を追加// LaTeXサポート用ライブラリ
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// import 'katex/dist/katex.min.css'; // KaTeXのCSSを一時的に無効化

const REASONING_OPEN_STORAGE_KEY = 'reasoningDefaultOpen';

// --- ヘルパー関数: JSON文字列を安全にパース ---
const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null; // パース失敗時は null を返す
  }
};

// --- ヘルパー関数: ツールタイプに応じたアイコンを返す ---
const getToolIcon = (type) => {
  if (type === 'search') return <Search className="w-4 h-4 mr-1 inline-block text-blue-500 dark:text-blue-400 flex-shrink-0" />;
  if (type === 'python') return <Code className="w-4 h-4 mr-1 inline-block text-green-500 dark:text-green-400 flex-shrink-0" />;
  return <BrainCircuit className="w-4 h-4 mr-1 inline-block text-gray-500 dark:text-gray-400 flex-shrink-0" />; // デフォルトアイコン
};

const Message = ({ message }) => {
  // --- State and Hooks ---
  const getInitialReasoningOpen = useCallback(() => { // 初期表示状態をlocalStorageから取得
    const storedValue = localStorage.getItem(REASONING_OPEN_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : false;
  }, []);

  const [isReasoningOpen, setIsReasoningOpen] = useState(getInitialReasoningOpen);
  // ★ Executed Tools の開閉状態を追加
  const [isExecutedToolsOpen, setIsExecutedToolsOpen] = useState(false); // デフォルトは閉じる
  // ★ Tool Calls の開閉状態を追加 (同様のUIにするため)
  const [isToolCallsOpen, setIsToolCallsOpen] = useState(false); // デフォルトは閉じる

  const [copiedStates, setCopiedStates] = useState({});

  useEffect(() => {
    localStorage.setItem(REASONING_OPEN_STORAGE_KEY, JSON.stringify(isReasoningOpen));
  }, [isReasoningOpen]);

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

  // AIメッセージ本文用の背景色クラス
  const aiMessageBgColor = 'bg-sky-50 dark:bg-sky-900/60';

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
    p: ({ node, ...props }) => <p style={{ fontFamily: "'Meiryo', 'メイリオ', sans-serif" }} {...props} />
  };

  // --- Component Rendering ---
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
            <div className="flex items-start mb-2 group"> {/* flex items-start を適用 */}
              {/* アイコン用コンテナ (固定幅 + 中央揃え) */}
              <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
                <BrainCircuit className="w-6 h-6 text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
              </div>
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
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isReasoningOpen ? 'max-h-96' : 'max-h-0'
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
            <div className="flex items-start mb-2 group"> {/* flex items-start を適用 */}
              {/* アイコン用コンテナ (固定幅 + 中央揃え) */}
              <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
                <BrainCircuit className="w-6 h-6 text-yellow-500 dark:text-yellow-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-300 transition-colors" />
              </div>
              <div className={`w-full max-w-lg lg:max-w-xl xl:max-w-3xl px-3 py-2 rounded-lg shadow bg-yellow-100 dark:bg-yellow-900/70 text-xs text-yellow-800 dark:text-yellow-200 break-words`}>
                {/* ★ Tool Calls ヘッダーをボタンに変更 */}
                <button
                  onClick={() => setIsToolCallsOpen(!isToolCallsOpen)}
                  className="flex items-center text-xs text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-100 focus:outline-none w-full text-left mb-1"
                  aria-expanded={isToolCallsOpen}
                >
                  {isToolCallsOpen ? <ChevronUp size={16} className="mr-1 flex-shrink-0" /> : <ChevronDown size={16} className="mr-1 flex-shrink-0" />}
                  <span className="font-semibold">ツール呼び出し</span>
                  <span className="ml-auto text-yellow-600 dark:text-yellow-400">({isToolCallsOpen ? '閉じる' : '表示'})</span>
                </button>
                {/* ★ Tool Calls コンテンツ部分 */}
                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isToolCallsOpen ? 'max-h-96' : 'max-h-0' // 必要に応じて max-h を調整
                    }`}
                >
                  <div className="border-t border-yellow-300 dark:border-yellow-700 pt-1 mt-1">
                    {message.tool_calls.map((toolCall, index) => (
                      <pre key={index} className="whitespace-pre-wrap font-mono text-xs mb-1 last:mb-0">{toolCall.function.name}({toolCall.function.arguments})</pre>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ★ Executed Tools の表示 */}
          {message.executed_tools && message.executed_tools.length > 0 && (
            <div className="flex items-start mb-2 group"> {/* flex items-start を適用 */}
              {/* アイコン用コンテナ (固定幅 + 中央揃え) */}
              <div className="w-8 h-8 mr-2 flex-shrink-0 flex justify-center items-center mt-1">
                {getToolIcon(message.executed_tools[0].type)} {/* getToolIcon はアイコン要素を返す */}
              </div>
              <div className={`w-full max-w-lg lg:max-w-xl xl:max-w-3xl px-3 py-2 rounded-lg shadow bg-teal-50 dark:bg-teal-900/70 text-xs text-teal-800 dark:text-teal-200 break-words`}>
                {/* ★ Executed Tools ヘッダーをボタンに変更 */}
                <button
                  onClick={() => setIsExecutedToolsOpen(!isExecutedToolsOpen)}
                  className="flex items-center text-xs text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-100 focus:outline-none w-full text-left mb-1"
                  aria-expanded={isExecutedToolsOpen}
                >
                  {isExecutedToolsOpen ? <ChevronUp size={16} className="mr-1 flex-shrink-0" /> : <ChevronDown size={16} className="mr-1 flex-shrink-0" />}
                  <span className="font-semibold">実行されたツール</span>
                  <span className="ml-auto text-teal-600 dark:text-teal-400">({isExecutedToolsOpen ? '閉じる' : '表示'})</span>
                </button>
                {/* ★ Executed Tools コンテンツ部分 */}
                <div
                  className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isExecutedToolsOpen ? 'max-h-[40rem]' : 'max-h-0' // 必要に応じて max-h を調整 (コード表示用に大きめに)
                    }`}
                >
                  <div className="border-t border-teal-300 dark:border-teal-700 pt-1 mt-1">
                    <ul className="list-none pl-0 mt-1 space-y-2"> {/* space-y を少し増やす */}
                      {message.executed_tools.map((tool, index) => {
                        const args = safeJsonParse(tool.arguments);
                        const codeToDisplay = args && typeof args === 'object' && args.code;
                        const codeBlockIndex = `executed-${index}`; // コピー用の一意なID

                        return (
                          <li key={index} className="border-b border-teal-200 dark:border-teal-800 pb-2 last:border-b-0 last:pb-0">
                            <div className="flex items-center mb-1">
                              {getToolIcon(tool.type)}
                              <span className="capitalize font-medium">{tool.type || '不明'}</span>
                            </div>
                            {codeToDisplay ? (
                              // Pythonコードなどを SyntaxHighlighter で表示
                              <div className="code-block relative group rounded-md bg-gray-800 dark:bg-gray-900 font-mono text-xs"> {/* text-xs に変更 */}
                                <button
                                  onClick={() => handleCopy(codeToDisplay, codeBlockIndex)}
                                  className="absolute top-1 right-1 p-1 bg-gray-600 dark:bg-gray-700 rounded-md text-gray-300 hover:text-white hover:bg-gray-500 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  aria-label={copiedStates[codeBlockIndex] ? "コピーしました" : "コードをコピー"}
                                  title={copiedStates[codeBlockIndex] ? "コピーしました" : "コードをコピー"}
                                >
                                  {copiedStates[codeBlockIndex] ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                <SyntaxHighlighter style={document.documentElement.classList.contains('dark') ? vscDarkPlus : coy} language="python" PreTag="div">
                                  {String(codeToDisplay).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              // JSONでない場合やcodeキーがない場合は pre で表示
                              <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">{tool.arguments ? JSON.stringify(args || tool.arguments, null, 2) : '(引数なし)'}</pre>
                            )}
                            {tool.output && (
                              <div className="mt-1">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Output:</p>
                                <pre className="whitespace-pre-wrap font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">{tool.output}</pre>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
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
            <div className={`prose prose-sm max-w-lg lg:max-w-xl xl:max-w-3xl px-4 py-2 rounded-lg shadow ${aiMessageBgColor} dark:prose-invert break-words w-full`}>
              <div className="markdown-content">
                {message.content ? (
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkMath]} // remark-math プラグインを追加
                    rehypePlugins={[rehypeKatex]} // rehype-katex プラグインを追加
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
