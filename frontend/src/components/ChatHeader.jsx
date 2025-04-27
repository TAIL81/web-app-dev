import { Sun, Moon, Trash2 } from 'lucide-react';

const ChatHeader = ({ 
  title,
  onClearChat,
  isDarkMode,
  toggleDarkMode 
}) => {
  return (
    <header className="bg-white dark:bg-dark-card p-4 shadow-md dark:shadow-lg sticky top-0 z-10 flex justify-between items-center">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-dark-text">{title}</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">日本語でチャット！「quit」か「exit」で終了。</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClearChat}
          aria-label="チャット履歴をクリア"
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500 transition-colors"
          title="チャット履歴をクリア"
        >
          <Trash2 className="w-5 h-5 text-red-500 dark:text-red-400" />
        </button>

        <button
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:focus:ring-gray-500 transition-colors"
          title={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
};

export default ChatHeader;
