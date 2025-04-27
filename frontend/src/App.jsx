import { useState } from 'react';
import useChat from './hooks/useChat';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import Error from './components/Error';

function App() {
  const { messages, input, isLoading, error, handleSend, handleKeyPress, handleClearChat } = useChat();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setIsDarkMode(prevMode => !prevMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`flex flex-col h-screen ${isDarkMode ? 'dark' : ''} bg-gray-100 dark:bg-gray-900`}>
      <ChatHeader 
        title="Groq チャットボット" 
        onClearChat={handleClearChat}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
      
      <main className="flex-1 overflow-y-auto p-4">
        <MessageList messages={messages} />
        {error && <Error message={error} />}
      </main>

      <ChatInput 
        input={input}
        onInputChange={(e) => handleKeyPress(e)}
        onSubmit={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
}

export default App;
