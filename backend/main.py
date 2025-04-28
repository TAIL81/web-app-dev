# d:\Users\onisi\Documents\web-app-dev\backend\main.py
import os
import json
import time
import sys
# --- ▼▼▼ BackgroundTasks をインポート ▼▼▼ ---
from fastapi import FastAPI, HTTPException, BackgroundTasks
# --- ▲▲▲ BackgroundTasks をインポート ▲▲▲ ---
# 重複していた HTTPException のインポートを削除
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq, GroqError, AuthenticationError, RateLimitError, APIConnectionError, BadRequestError
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

import uvicorn
import traceback

app = FastAPI(
    title="Groq Chat API Backend",
    description="Backend for the chat application using Groq API.",
    version="0.1.0",
)

# CORS 設定
frontend_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")
DEFAULT_SYSTEM_PROMPT = "Respond in fluent Japanese"

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
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    # --- ▼▼▼ プロンプト拡張用にフロントエンドからパラメータを受け取れるように修正 ▼▼▼ ---
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_completion_tokens: Optional[int] = None
    # --- ▲▲▲ プロンプト拡張用にフロントエンドからパラメータを受け取れるように修正 ▲▲▲ ---


class ToolCallFunction(BaseModel):
    name: str
    arguments: str

class ToolCall(BaseModel):
    type: str = "function"
    function: ToolCallFunction

class ChatResponse(BaseModel):
    content: str
    reasoning: Optional[Any] = None
    tool_calls: Optional[List[ToolCall]] = None

REASONING_SUPPORTED_MODELS = [
    "qwen-qwq-32b",
    "deepseek-r1-distill-llama-70b",
]

# --- API Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest): # ChatRequest を使用
    """
    Handles chat requests from the frontend, interacts with Groq API,
    and returns the response.
    Accepts model_name, temperature, max_completion_tokens from request body.
    """
    print("\n--- New Chat Request Received ---")
    config = load_config()
    system_prompt_content = config.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    print(f"System Prompt: '{system_prompt_content[:100]}...'")
    api_key = os.environ.get("GROQ_API_KEY") or config.get("api_key")
    if not api_key or api_key == "YOUR_GROQ_API_KEY_HERE_OR_LEAVE_BLANK_TO_USE_ENV_VAR":
        print("エラー: 有効な Groq API キーが設定されていません。")
        raise HTTPException(status_code=401, detail="有効な Groq API キーが設定されていません。")

    try:
        client = Groq(api_key=api_key)
    except Exception as e:
        print(f"エラー: Groq クライアントの初期化に失敗しました: {e}")
        raise HTTPException(status_code=500, detail=f"Groq クライアント初期化エラー: {e}")

    # --- ▼▼▼ リクエストボディ > 設定ファイル の優先順位でパラメータを決定 ▼▼▼ ---
    model_name = request.model_name or config.get("model_name", "qwen-qwq-32b")
    temperature = request.temperature if request.temperature is not None else config.get("temperature", 0.6)
    max_tokens = request.max_completion_tokens or config.get("max_completion_tokens", 8192)
    # --- ▲▲▲ リクエストボディ > 設定ファイル の優先順位でパラメータを決定 ▲▲▲ ---

    print(f"Using Model: {model_name}")

    try:
        messages_for_api = []
        if system_prompt_content:
            # メタプロンプトの場合はシステムプロンプトを追加しないなどの制御が必要ならここで行う
            # 今回はシンプルに常にシステムプロンプトを追加する（メタプロンプトでも）
            messages_for_api.append({"role": "system", "content": system_prompt_content})

        print("Processing messages from frontend:")
        for msg in request.messages:
            if isinstance(msg.content, str):
                messages_for_api.append({"role": msg.role, "content": msg.content})
                print(f"  - Role: {msg.role}, Content (first 100 chars): '{msg.content[:100]}...'")
            else:
                print(f"  - Warning: Received non-string content (type: {type(msg.content)}). Skipping. Role: {msg.role}")

        api_params = {
            "messages": messages_for_api,
            "model": model_name,
            "temperature": temperature, # 決定した値を使用
            "max_tokens": max_tokens,   # 決定した値を使用
            "top_p": config.get("top_p", 0.95), # これは設定ファイルからのみ取得
            "stream": config.get("stream", False), # これは設定ファイルからのみ取得
        }
        print(f"API Parameters (excluding messages): { {k: v for k, v in api_params.items() if k != 'messages'} }")

        # Reasoning Format の設定 (変更なし)
        if model_name in REASONING_SUPPORTED_MODELS:
            reasoning_format_value = config.get("reasoning_format", "parsed")
            if reasoning_format_value in ["parsed", "raw", "hidden"]:
                 api_params["reasoning_format"] = reasoning_format_value
                 print(f"Reasoning Format: {reasoning_format_value}")
            else:
                 api_params["reasoning_format"] = "parsed"
                 print(f"Warning: Invalid reasoning_format ('{reasoning_format_value}') in config. Using 'parsed'.")

        start_time = time.time()
        print("Calling Groq API...")
        completion = client.chat.completions.create(**api_params)
        end_time = time.time()
        print(f"Groq API call finished in {end_time - start_time:.2f} seconds.")

        response_message = completion.choices[0].message
        reasoning_content = getattr(response_message, 'reasoning', None)
        tool_calls_content = getattr(response_message, 'tool_calls', None)

        response_data = ChatResponse(
            content=response_message.content or "",
            reasoning=reasoning_content if reasoning_content else "（Reasoningなし）",
            tool_calls=[ToolCall.model_validate(tc.model_dump()) for tc in tool_calls_content] if tool_calls_content else None
        )

        print("--- Response Sent ---")
        return response_data

    # --- エラーハンドリング (変更なし) ---
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

# --- ▼▼▼ /api/exit エンドポイントを修正 (BackgroundTasks を使用) ▼▼▼ ---
def shutdown_server():
    """サーバーをシャットダウンする関数 (バックグラウンドで実行)"""
    print("Shutting down server process...")
    # 応答が送信されるのを待つために少し遅延させる (任意)
    time.sleep(0.5)
    sys.exit(0) # プロセスを終了

@app.post("/api/exit")
async def request_exit(background_tasks: BackgroundTasks): # BackgroundTasks を引数に追加
    """
    フロントエンドからのリクエストを受けてサーバープロセスを終了するエンドポイント
    応答を返した後にバックグラウンドでシャットダウンを実行する
    """
    print("Received exit request from frontend. Scheduling shutdown...")
    # シャットダウン処理をバックグラウンドタスクとして登録
    background_tasks.add_task(shutdown_server)
    # 正常な応答 (JSON) を返し、CORSヘッダーが付与されるようにする
    return {"message": "Shutdown initiated"}
# --- ▲▲▲ /api/exit エンドポイントを修正 (BackgroundTasks を使用) ▲▲▲ ---


# --- Root Endpoint (for health check) ---
@app.get("/")
async def root():
    """ Health check endpoint """
    return {"message": "FastAPI backend for Groq Chat is running."}

# --- Server Execution ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"バックエンドサーバーを http://localhost:{port} で起動します...")
    # 開発中は reload=True が便利
    # host="0.0.0.0" は、コンテナ環境や他のマシンからのアクセスを許可する場合に必要
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

