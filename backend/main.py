# d:\Users\onisi\Documents\web-app-dev\backend\main.py
import os
import json
import time
import sys
from fastapi import FastAPI, HTTPException, BackgroundTasks
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
DEFAULT_SYSTEM_PROMPT = "Respond in fluent Japanese" # フォールバック用

def load_config():
    """設定ファイルを読み込む関数"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
            print(f"設定ファイルを読み込みました: {CONFIG_FILE}")
            # --- ▼▼▼ 主要な設定セクションの存在確認を追加 ▼▼▼ ---
            if "main_chat" not in config_data:
                print(f"警告: 設定ファイルに 'main_chat' セクションが見つかりません。")
                # 必要に応じてデフォルト値で補完するか、エラーにする
                config_data["main_chat"] = {}
            if "prompt_expansion" not in config_data:
                print(f"警告: 設定ファイルに 'prompt_expansion' セクションが見つかりません。")
                # 必要に応じてデフォルト値で補完するか、エラーにする
                config_data["prompt_expansion"] = {}
            # --- ▲▲▲ 主要な設定セクションの存在確認を追加 ▲▲▲ ---
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
    # --- ▼▼▼ purpose フィールドを追加 ▼▼▼ ---
    purpose: Optional[str] = "main_chat" # デフォルトはメインチャット
    # --- ▲▲▲ purpose フィールドを追加 ▲▲▲ ---
    # フロントエンドからのパラメータ上書き用 (メインチャットでのみ使用)
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_completion_tokens: Optional[int] = None

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
    Selects configuration based on the 'purpose' field in the request.
    Allows overriding parameters from the request body only for 'main_chat' purpose.
    """
    print(f"\n--- New Request Received (Purpose: {request.purpose}) ---")
    config = load_config()

    # --- ▼▼▼ purpose に基づいて設定を選択 ▼▼▼ ---
    if request.purpose == "expand_prompt":
        settings_key = "prompt_expansion"
        print("Using 'prompt_expansion' settings from config.json")
    elif request.purpose == "main_chat":
        settings_key = "main_chat"
        print("Using 'main_chat' settings from config.json")
    else:
        print(f"警告: 不明な purpose '{request.purpose}' が指定されました。'main_chat' 設定を使用します。")
        settings_key = "main_chat" # 不明な場合はメインチャット設定を使用

    if settings_key not in config or not isinstance(config[settings_key], dict):
         raise HTTPException(status_code=500, detail=f"設定ファイルに有効な '{settings_key}' セクションが見つかりません。")

    current_settings = config[settings_key]
    # --- ▲▲▲ purpose に基づいて設定を選択 ▲▲▲ ---

    # --- APIキーの取得 (main_chat セクションまたは環境変数から) ---
    # プロンプト拡張でも同じAPIキーを使う想定
    api_key = os.environ.get("GROQ_API_KEY") or config.get("main_chat", {}).get("api_key")
    if not api_key or api_key == "YOUR_GROQ_API_KEY_HERE_OR_LEAVE_BLANK_TO_USE_ENV_VAR":
        print("エラー: 有効な Groq API キーが設定されていません。")
        raise HTTPException(status_code=401, detail="有効な Groq API キーが設定されていません。")

    try:
        client = Groq(api_key=api_key)
    except Exception as e:
        print(f"エラー: Groq クライアントの初期化に失敗しました: {e}")
        raise HTTPException(status_code=500, detail=f"Groq クライアント初期化エラー: {e}")

    # --- ▼▼▼ パラメータの決定 (purpose によって上書きロジックを変更) ▼▼▼ ---
    # 1. 設定ファイルからデフォルト値を取得
    model_name = current_settings.get("model_name", "llama-3.1-8b-instant") # デフォルトモデルを設定
    temperature = current_settings.get("temperature", 0.7)
    max_tokens = current_settings.get("max_completion_tokens", 1024) # デフォルト最大トークンを設定
    system_prompt_content = current_settings.get("system_prompt", DEFAULT_SYSTEM_PROMPT)
    top_p = current_settings.get("top_p", 0.95)
    stream = current_settings.get("stream", False) # プロンプト拡張では通常 False

    # 2. メインチャットの場合のみ、リクエストボディの値で上書き
    if request.purpose == "main_chat":
        print("Checking for overrides from request body (main_chat only)...")
        if request.model_name:
            model_name = request.model_name
            print(f"  - Overriding model_name: {model_name}")
        if request.temperature is not None:
            temperature = request.temperature
            print(f"  - Overriding temperature: {temperature}")
        if request.max_completion_tokens:
            max_tokens = request.max_completion_tokens
            print(f"  - Overriding max_completion_tokens: {max_tokens}")
    # --- ▲▲▲ パラメータの決定 (purpose によって上書きロジックを変更) ▲▲▲ ---

    print(f"System Prompt: '{system_prompt_content[:100]}...'")
    print(f"Using Model: {model_name}")

    try:
        messages_for_api = []
        # --- ▼▼▼ システムプロンプトの追加 ▼▼▼ ---
        if system_prompt_content:
            messages_for_api.append({"role": "system", "content": system_prompt_content})
            print("Added system prompt.")

        print("Processing messages:")
        # --- ▼▼▼ メッセージリストの構築 (purpose によって挙動を変える) ▼▼▼ ---
        if request.purpose == "expand_prompt":
            # プロンプト拡張の場合、最後のユーザーメッセージのみを使用
            last_user_message = next((msg for msg in reversed(request.messages) if msg.role == 'user'), None)
            if last_user_message and isinstance(last_user_message.content, str):
                messages_for_api.append({"role": "user", "content": last_user_message.content})
                print(f"  - Using last user message for expansion: '{last_user_message.content[:100]}...'")
            else:
                print("エラー: プロンプト拡張のためのユーザーメッセージが見つかりません。")
                raise HTTPException(status_code=400, detail="プロンプト拡張のためのユーザーメッセージが必要です。")
        else: # メインチャットの場合、すべてのメッセージを使用
            for msg in request.messages:
                if isinstance(msg.content, str):
                    messages_for_api.append({"role": msg.role, "content": msg.content})
                    print(f"  - Role: {msg.role}, Content (first 100 chars): '{msg.content[:100]}...'")
                else:
                    print(f"  - Warning: Received non-string content (type: {type(msg.content)}). Skipping. Role: {msg.role}")
        # --- ▲▲▲ メッセージリストの構築 (purpose によって挙動を変える) ▲▲▲ ---

        api_params = {
            "messages": messages_for_api,
            "model": model_name,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            "stream": stream, # プロンプト拡張では False になる想定
        }
        print(f"API Parameters (excluding messages): { {k: v for k, v in api_params.items() if k != 'messages'} }")

        # Reasoning Format の設定 (メインチャットでのみ意味を持つ可能性が高い)
        # プロンプト拡張では不要かもしれないが、互換性のため残す
        if model_name in REASONING_SUPPORTED_MODELS and settings_key == "main_chat": # main_chat の設定を参照
            reasoning_format_value = config.get("main_chat", {}).get("reasoning_format", "parsed")
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

        # --- ▼▼▼ レスポンス形式を統一 ▼▼▼ ---
        # プロンプト拡張の場合でも、フロントエンドが期待する ChatResponse 形式で返す
        response_data = ChatResponse(
            content=response_message.content or "",
            # プロンプト拡張では reasoning や tool_calls は通常ないが、念のため取得
            reasoning=reasoning_content if reasoning_content else None, # "（Reasoningなし）" は不要かも
            tool_calls=[ToolCall.model_validate(tc.model_dump()) for tc in tool_calls_content] if tool_calls_content else None
        )
        # --- ▲▲▲ レスポンス形式を統一 ▲▲▲ ---

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

# --- /api/exit エンドポイント (変更なし) ---
def shutdown_server():
    """サーバーをシャットダウンする関数 (バックグラウンドで実行)"""
    print("Shutting down server process...")
    time.sleep(0.5)
    sys.exit(0)

@app.post("/api/exit")
async def request_exit(background_tasks: BackgroundTasks):
    """
    フロントエンドからのリクエストを受けてサーバープロセスを終了するエンドポイント
    応答を返した後にバックグラウンドでシャットダウンを実行する
    """
    print("Received exit request from frontend. Scheduling shutdown...")
    background_tasks.add_task(shutdown_server)
    return {"message": "Shutdown initiated"}

# --- Root Endpoint (変更なし) ---
@app.get("/")
async def root():
    """ Health check endpoint """
    return {"message": "FastAPI backend for Groq Chat is running."}

# --- Server Execution (変更なし) ---
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"バックエンドサーバーを http://localhost:{port} で起動します...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
