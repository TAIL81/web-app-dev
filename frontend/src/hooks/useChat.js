import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid'; // uuid をインポート

// --- 定数 ---
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'; // バックエンドAPIのURL

// --- 初期状態 ---
const initialMessages = [
  { id: uuidv4(), role: 'assistant', content: '本日はどのようなお手伝いをさせていただけますか？' }
]; // チャットの初期メッセージ

// --- ヘルパー関数 (ファイル内容読み込み) ---
/**
 * Fileオブジェクトの内容をテキストとして非同期で読み込みます。
 * @param {File} file - 読み込むFileオブジェクト
 * @returns {Promise<string>} ファイルのテキスト内容
 */
const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
};


// --- メインフック ---
const useChat = () => {
  // --- StateとRef ---
  const [messages, setMessages] = useState(initialMessages); // チャットメッセージ配列
  const [input, setInput] = useState(''); // テキスト入力欄
  const [isLoading, setIsLoading] = useState(false); // ローディング状態 (API通信など)
  const [error, setError] = useState(null); // エラーメッセージ表示用
  const messagesEndRef = useRef(null); // チャット末尾への自動スクロール用Ref
  const [availableModels, setAvailableModels] = useState([]); // 利用可能なモデルIDリスト
  const [selectedModel, setSelectedModel] = useState(''); // 選択中のモデルID
  const [isModelsLoading, setIsModelsLoading] = useState(true); // モデルリスト取得中のローディング状態

  // --- Effect ---
  // 自動スクロール無効化
  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  // };
  // useEffect(() => {
  //   scrollToBottom();
  // }, [messages]);

  // コンポーネントマウント時に利用可能なモデルリストを取得
  useEffect(() => {
    const fetchModels = async () => {
      setIsModelsLoading(true); // ローディング開始
      setError(null); // 既存のエラーをクリア
      try {
        const response = await fetch(`${BACKEND_URL}/api/models`); // 新しいエンドポイントを叩く
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models); // 取得したモデルIDリストをセット
          setSelectedModel(data.models[0]); // リストの最初のモデルをデフォルト選択
        } else { // モデルリストが空の場合
          console.warn("No available models received from backend or list is empty.");
          setAvailableModels([]); // 利用可能なモデルがない場合は空リスト
          setSelectedModel(''); // 選択も空に
        }
      } catch (err) {
        console.error("Error fetching available models:", err);
        setError("利用可能なAIモデルの取得中にエラーが発生しました。");
        setAvailableModels([]); // エラー時も空リスト
        setSelectedModel(''); // エラー時は選択なし
      } finally {
        setIsModelsLoading(false); // ローディング終了
      }
    };
    fetchModels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // マウント時に一度だけ実行

  // --- ヘルパー関数 (メッセージ送信ロジック) ---

  /**
   * テキスト入力とファイル内容からAPI送信用コンテンツ文字列を構築します。
   * @param {string} textInput - 現在のテキスト入力値
   * @param {Array<{fileName: string, text: string}>} fileContents - 読み込まれたファイル内容の配列
   * @returns {string} API送信用コンテンツ文字列
   */
  const buildCombinedContent = (textInput, fileContents) => {
    let combinedContent = textInput;
    if (fileContents && fileContents.length > 0) {
      const fileDescriptions = fileContents.map(fc =>
        `\n[添付ファイル: ${fc.fileName || '名称不明'}]\n\`\`\`\n${fc.text}\n\`\`\``
      ).join('');
      combinedContent += fileDescriptions;
    }
    return combinedContent;
  };

  /**
   * API送信直前にUIを更新します (テキストメッセージのみ追加)。
   * @param {string} textInput - 現在のテキスト入力値
   * @param {Array<object>} currentMessages - 現在のメッセージ配列
   * @param {Function} setMessages - messages state 更新関数
   * @returns {{ updatedMessages: Array<object>, newUserTextMessage: object|null }} UI更新後のメッセージ配列と追加されたユーザーテキストメッセージ
   */
  const updateUiBeforeSend = (textInput, currentMessages, setMessages) => {
    let newUserTextMessage = null;
    let updatedMessages = [...currentMessages];

    if (textInput) {
      newUserTextMessage = { id: uuidv4(), role: 'user', content: textInput, sentToApi: true }; // 送信フラグを立てて追加
      updatedMessages.push(newUserTextMessage);
      setMessages(updatedMessages); // UIを即時更新
    }
    // ファイル添付のUIメッセージはここでは追加しない (ChatInput側でプレビュー表示)
    return { updatedMessages, newUserTextMessage };
  };


  /**
   * APIに送信するためのメッセージ履歴配列を準備します (履歴件数制限あり)。
   * @param {Array<object>} allMessages - 全てのメッセージ履歴 (今回追加したユーザーテキスト含む)
   * @param {object|null} currentTextMessage - 今回追加されたユーザーテキストメッセージオブジェクト
   * @param {string} combinedContent - buildCombinedContentで生成された今回のユーザー入力コンテンツ (ファイル含む)
   * @returns {Array<object>} API送信用に整形されたメッセージ配列 (role, content のみ)
   */
  const prepareApiMessages = (allMessages, currentTextMessage, combinedContent) => {
    const MAX_HISTORY_PAIRS = 5; // 保持する会話の往復数
    const MAX_API_MESSAGES = MAX_HISTORY_PAIRS * 2; // APIに含める最大メッセージ数 (過去分)

    // API履歴に含める過去メッセージをフィルタリング (今回追加したテキストメッセージは除外)
    const pastMessagesOnly = currentTextMessage
        ? allMessages.filter(msg => msg.id !== currentTextMessage.id)
        : allMessages;

    const relevantPastMessages = pastMessagesOnly.filter(msg => {
      if (msg.hidden) return false;
      // ファイル添付を示す情報は messages 配列にはもう無いため、単純にroleで判断
      return msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string');
    });

    // 最新のメッセージから指定件数分を取得
    const limitedPastMessages = relevantPastMessages.slice(-MAX_API_MESSAGES);
    // APIに必要な形式 (role, content) にマッピング
    const pastMessagesForApi = limitedPastMessages.map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // 今回のユーザー入力をAPI形式で作成 (ファイル内容含む)
    const currentMessageForApi = { role: 'user', content: combinedContent };

    // 過去の履歴と今回の入力を結合
    const messagesForApi = [...pastMessagesForApi, currentMessageForApi];

    if (process.env.NODE_ENV === 'development') {
        console.log(`prepareApiMessages: Sending ${messagesForApi.length} messages (Limit: ${MAX_API_MESSAGES} past + 1 current max)`);
        // console.log("Messages for API:", JSON.stringify(messagesForApi, null, 2));
    }

    return messagesForApi;
  };

  /**
   * API呼び出しでエラーが発生した場合の処理。
   * @param {Error} error - 発生したエラーオブジェクト
   * @param {Function} setError - error state 更新関数
   * @param {Function} setMessages - messages state 更新関数
   * @param {object|null} failedTextMessage - 送信試行したテキストメッセージオブジェクト
   */
  const handleApiError = (error, setError, setMessages, failedTextMessage) => {
    console.error("API処理エラー:", error);
    let userFriendlyError = `メッセージの送信に失敗しました。`;
    if (error.message) {
        userFriendlyError += ` 詳細: ${error.message}`;
    }
    setError(userFriendlyError); // エラーメッセージをUIに表示

    // 送信に失敗したテキストメッセージの sentToApi フラグを false に戻す (再試行可能にするため)
    if (failedTextMessage) {
        setMessages(prev => prev.map(msg =>
            msg.id === failedTextMessage.id ? { ...msg, sentToApi: false } : msg
        ));
    }
    // ファイルのUI状態は ChatInput 側で管理されているため、ここでは何もしない
  };


  // --- コア関数 ---

  /**
   * メッセージ送信処理のメイン関数。
   * @param {Array<object>} [uploadedFilesData=[]] - useFileUploadから渡されるファイル情報配列 [{id, file, preview, error, type}, ...]
   */
  const handleSend = useCallback(async (uploadedFilesData = []) => {
    const currentInput = input.trim();
    // 送信する有効なファイルのみをフィルタリング (テキストファイルでエラーがないもの)
    const validFilesToUpload = uploadedFilesData.filter(f => f.type === 'text' && !f.error);

    // 送信条件チェック
    if ((!currentInput && validFilesToUpload.length === 0) || isLoading || isModelsLoading || !selectedModel) { // isExpanding を削除
      if (process.env.NODE_ENV === 'development') {
        console.log("送信条件未達:", { currentInput, validFiles: validFilesToUpload.length, isLoading, isModelsLoading, selectedModel });
      }
      if (!isLoading && (isModelsLoading || !selectedModel)) {
          setError("送信前にモデルを選択してください (ロード中または利用不可)。");
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    let newUserTextMessage = null; // スコープ内で参照するため

    try {
      // 1. ファイル内容の読み込み (非同期)
      const fileReadPromises = validFilesToUpload.map(fileData =>
        readFileContent(fileData.file).then(text => ({ fileName: fileData.file.name, text }))
      );
      const fileContents = await Promise.all(fileReadPromises);

      // 2. API送信用コンテンツ作成 (テキスト + 読み込んだファイル内容)
      const combinedContent = buildCombinedContent(currentInput, fileContents);

      // 3. UI更新 (テキストメッセージ追加、送信済みフラグ更新)
      const { updatedMessages, newUserTextMessage: createdMessage } = updateUiBeforeSend(currentInput, messages, setMessages);
      newUserTextMessage = createdMessage; // エラーハンドリング用に保持
      setInput(''); // 入力欄をクリア (ファイルプレビューはChatInput側でクリアされる想定)

      // 4. API送信準備 (API用のメッセージ履歴作成)
      const messagesForApi = prepareApiMessages(updatedMessages, newUserTextMessage, combinedContent);

      // 送信するユーザーコンテンツがない場合は異常系 (通常発生しないはず)
      if (!messagesForApi.some(m => m.role === 'user')) {
         console.warn("送信するユーザーコンテンツがありません。UIをロールバックします。");
         setIsLoading(false);
         // UIロールバック (テキストメッセージ削除、入力復元)
         if (newUserTextMessage) {
             setMessages(prev => prev.filter(msg => msg.id !== newUserTextMessage.id));
         }
         setInput(currentInput);
         // ファイルは ChatInput 側でクリアされているはずなので、ここでは何もしない
         return;
      }

      // 5. API呼び出し & 応答処理
      const requestBody = {
        messages: messagesForApi,
        purpose: 'main_chat',
        model_name: selectedModel,
      };

      if (process.env.NODE_ENV === 'development') {
        console.log("Sending to API:", JSON.stringify(requestBody, null, 2));
      }

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorDetail = `HTTP error! status: ${response.status}`;
        let errorData = null;
        try {
          errorData = await response.json();
          if (errorData && errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorDetail = errorData.detail.map(d => `[${d.loc?.join('->') || 'N/A'}]: ${d.msg || 'No message'}`).join('; ');
            } else if (typeof errorData.detail === 'string') {
              errorDetail = errorData.detail;
            } else {
              errorDetail = JSON.stringify(errorData.detail);
            }
          } else if (errorData) {
            errorDetail = JSON.stringify(errorData);
          }
        } catch (jsonError) {
          console.error("Error parsing error response:", jsonError);
          errorDetail = `APIエラー (${response.status}): ${response.statusText || '応答解析不可'}`;
        }
        const error = new Error(errorDetail);
        error.responseDetails = errorData;
        throw error;
      }

      // 6. API成功時のUI更新 (アシスタントの応答を追加)
      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: data.content,
          reasoning: data.reasoning,
          tool_calls: data.tool_calls,
          executed_tools: data.executed_tools // ★ executed_tools をメッセージに追加
        },
      ]);

    } catch (err) {
      // 7. APIエラー時の処理 (エラー表示、UIロールバックの一部)
      handleApiError(err, setError, setMessages, newUserTextMessage);
      // エラー発生時は入力欄の内容を戻さない（ユーザーが再編集できるように）
      // ファイルのプレビューもクリアしない（ユーザーが再試行できるように）
    } finally {
      setIsLoading(false); // ローディング終了
    } // isExpanding の依存を削除
  // 依存配列: messages は直接使わないが、履歴更新のトリガーとして含める場合がある
  }, [input, isLoading, selectedModel, isModelsLoading, messages, setMessages, setError, setInput]);

  /**
   * チャット履歴をクリアする関数 (フロントエンドの状態のみクリア)。
   */
  const handleClearChat = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
        console.log('useChat: handleClearChat called');
    }
    setMessages(initialMessages); // 初期メッセージの状態に戻す
    setError(null);
    setIsLoading(false);
    setInput('');
    // ファイルプレビューのクリアは ChatInput 側で行う必要がある (clearFiles を呼ぶ)
  }, [setMessages, setError, setIsLoading, setInput]);


  // --- フックの戻り値 ---
  return {
    messages,
    input,
    setInput,
    isLoading,
    error,
    setError,
    messagesEndRef,
    handleSend,
    handleClearChat,
    selectedModel,
    setSelectedModel,
    availableModels,
    isModelsLoading,
  };
};

export default useChat; // フックをエクスポート
