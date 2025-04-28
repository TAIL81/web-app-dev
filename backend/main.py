# d:\Users\onisi\Documents\web-app-dev\backend\main.py
import os
import json
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq, GroqError, AuthenticationError, RateLimitError, APIConnectionError, BadRequestError
from pydantic import BaseModel
from typing import List, Dict, Any, Optional # Dict, Any, Optional をインポート (レスポンス用)

import uvicorn
import traceback # エラー詳細表示用

app = FastAPI(
    title="Groq Chat API Backend",
    description="Backend for the chat application using Groq API.",
    version="0.1.0",
)

# CORS 設定（React フロントエンド用）
# 環境変数 FRONTEND_ORIGIN があればそれを使い、なければデフォルトを設定
frontend_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins, # 環境変数またはデフォルトのオリジンを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 設定ファイルのパスを backend ディレクトリ内の config.json に変更
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

# ★ デフォルトのシステム指示 (config.json に system_prompt がない場合に使用)
DEFAULT_SYSTEM_PROMPT = "Respond in fluent Japanese" # 元のコードに合わせて修正

def load_config():
    """設定ファイルを読み込む関数"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
            print(f"設定ファイルを読み込みました: {CONFIG_FILE}")
            return config_data
    except FileNotFoundError:
        print(f"エラー: 設定ファイル '{CONFIG_FILE}' が見つかりません。")
        raise HTTPException(status_code=500, detail=f"設定ファイル '{CONFIG_FILE}' が見つかりません。")
    except json.JSONDecodeError as e:
        print(f"エラー: 設定ファイル '{CONFIG_FILE}' の形式が正しくありません。詳細: {e}")
        raise HTTPException(status_code=500, detail=f"設定ファイル '{CONFIG_FILE}' の形式が正しくありません。")
    except Exception as e:
        print(f"エラー: 設定ファイルの読み込み中に予期せぬエラーが発生しました: {type(e).__name__}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"設定ファイルの読み込み中にエラー: {e}")

# --- Pydantic Models ---
# フロントエンドから送られてくるメッセージの形式
class Message(BaseModel):
    role: str
    content: str # フロントエンドは常に文字列で送信してくる想定

# APIリクエスト全体の形式
class ChatRequest(BaseModel):
    messages: List[Message]

# APIレスポンスの形式 (フロントエンドの useChat.js が期待する形式に合わせる)
class ToolCallFunction(BaseModel):
    name: str
    arguments: str

class ToolCall(BaseModel):
    type: str = "function" # 現在は function のみ想定
    function: ToolCallFunction

class ChatResponse(BaseModel):
    content: str
    reasoning: Optional[Any] = None # Groqのreasoningは複雑な場合があるのでAny
    tool_calls: Optional[List[ToolCall]] = None

# ★ Reasoning 対応モデルのリストを定義 (元のコードの内容を維持)
REASONING_SUPPORTED_MODELS = [
    "qwen-qwq-32b",
    "deepseek-r1-distill-llama-70b",
]

# --- API Endpoint ---
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Handles chat requests from the frontend, interacts with Groq API,
    and returns the response.
    """
    print("\n--- New Chat Request Received ---")
    config = load_config()

    # システム指示の内容を取得
    system_prompt_content = config.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    print(f"System Prompt: '{system_prompt_content[:100]}...'")

    # API キー取得 (環境変数優先)
    api_key = os.environ.get("GROQ_API_KEY") or config.get("api_key")
    if not api_key or api_key == "YOUR_GROQ_API_KEY_HERE_OR_LEAVE_BLANK_TO_USE_ENV_VAR":
        print("エラー: 有効な Groq API キーが設定されていません。")
        raise HTTPException(status_code=401, detail="有効な Groq API キーが設定されていません。")

    try:
        client = Groq(api_key=api_key)
    except Exception as e:
        print(f"エラー: Groq クライアントの初期化に失敗しました: {e}")
        raise HTTPException(status_code=500, detail=f"Groq クライアント初期化エラー: {e}")

    model_name = config.get("model_name", "qwen-qwq-32b") # デフォルトモデルを設定 (元のコードに合わせる)
    print(f"Using Model: {model_name}")

    try:
        # API に送信するメッセージリストを構築
        messages_for_api = []

        # システム指示を追加
        if system_prompt_content: # 空でない場合のみ追加
            messages_for_api.append({"role": "system", "content": system_prompt_content})

        # --- ▼▼▼ ここから修正 ▼▼▼ ---
        # フロントエンドからのメッセージを処理 (content は常に文字列と想定)
        print("Processing messages from frontend:")
        for msg in request.messages:
            # content が文字列の場合のみ messages_for_api に追加
            if isinstance(msg.content, str):
                messages_for_api.append({"role": msg.role, "content": msg.content})
                print(f"  - Role: {msg.role}, Content (first 100 chars): '{msg.content[:100]}...'")
            else:
                # 文字列でない場合は警告を出し、スキップ (エラーにはしない)
                # このメッセージは API には送信されない
                print(f"  - Warning: Received non-string content (type: {type(msg.content)}). Skipping. Role: {msg.role}")
        # --- ▲▲▲ ここまで修正 ▲▲▲ ---

        # API 呼び出し用のパラメータを準備
        api_params = {
            "messages": messages_for_api,
            "model": model_name,
            "temperature": config.get("temperature", 0.6), # 元のコードに合わせる
            "max_tokens": config.get("max_completion_tokens", 8192), # Groq は max_tokens
            "top_p": config.get("top_p", 0.95), # 元のコードに合わせる
            "stream": config.get("stream", False), # 元のコードに合わせる
            # "stop": None, # 必要なら stop sequence を設定
            # "tool_choice": "auto", # Tool Use を使う場合
            # "tools": [...] # Tool Use を使う場合
        }
        print(f"API Parameters (excluding messages): { {k: v for k, v in api_params.items() if k != 'messages'} }")

        # モデルが Reasoning 対応リストに含まれていれば、reasoning_format を追加
        if model_name in REASONING_SUPPORTED_MODELS:
            reasoning_format_value = config.get("reasoning_format", "parsed") # デフォルトは 'parsed'
            if reasoning_format_value in ["parsed", "raw", "hidden"]:
                 api_params["reasoning_format"] = reasoning_format_value
                 print(f"Reasoning Format: {reasoning_format_value}")
            else:
                 api_params["reasoning_format"] = "parsed" # 不正な値の場合はデフォルト
                 print(f"Warning: Invalid reasoning_format ('{reasoning_format_value}') in config. Using 'parsed'.")

        # --- Groq API 呼び出し ---
        start_time = time.time()
        print("Calling Groq API...")
        completion = client.chat.completions.create(**api_params)
        end_time = time.time()
        print(f"Groq API call finished in {end_time - start_time:.2f} seconds.")
        # -------------------------

        response_message = completion.choices[0].message

        # reasoning 属性が存在するかチェックして取得
        reasoning_content = getattr(response_message, 'reasoning', None)

        # tool_calls 属性が存在するかチェックして取得
        tool_calls_content = getattr(response_message, 'tool_calls', None)

        # レスポンスデータを構築
        response_data = ChatResponse(
            content=response_message.content or "", # content が None の場合空文字に
            reasoning=reasoning_content if reasoning_content else "（Reasoningなし）", # None なら固定文字列
            # tool_calls があれば Pydantic モデルのリストに変換
            tool_calls=[ToolCall.model_validate(tc.model_dump()) for tc in tool_calls_content] if tool_calls_content else None
        )

        print("--- Response Sent ---")
        return response_data

    # --- エラーハンドリング (元のコードの内容を維持) ---
    except AuthenticationError as e:
        print(f"エラー: Groq API 認証エラー: {e}")
        raise HTTPException(status_code=401, detail="Groq API 認証エラー: API キーを確認してください。")
    except RateLimitError as e:
        print(f"エラー: レート制限に達しました: {e}")
        raise HTTPException(status_code=429, detail="Groq API のレート制限に達しました。しばらく待ってから再試行してください。")
    except APIConnectionError as e:
        print(f"エラー: Groq API 接続エラー: {e}")
        raise HTTPException(status_code=503, detail="Groq API 接続エラー: ネットワークを確認してください。")
    except BadRequestError as e:
        error_details = str(e)
        error_response = getattr(e, 'response', None)
        if error_response:
            try:
                error_body = error_response.json()
                error_details = error_body.get('error', {}).get('message', str(e))
            except Exception:
                pass
        print(f"エラー: Groq BadRequestError details: {error_details}")
        raise HTTPException(status_code=400, detail=f"リクエストエラー: {error_details}")
    except GroqError as e:
        print(f"エラー: Groq API エラー: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq API エラー: {str(e)}")
    except Exception as e:
        print(f"エラー: 予期せぬサーバーエラーが発生しました: {type(e).__name__}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"予期せぬサーバーエラーが発生しました。")

# --- Root Endpoint (for health check) ---
@app.get("/")
async def root():
    """ Health check endpoint """
    return {"message": "FastAPI backend for Groq Chat is running."} # 元のコードに合わせる

# --- Server Execution ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000)) # 環境変数 PORT を優先
    print(f"バックエンドサーバーを http://localhost:{port} で起動します...")
    # 開発中は reload=True が便利
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) # host を 0.0.0.0 に変更 (外部アクセス用)
