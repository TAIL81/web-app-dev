import os
import json
import time # RateLimitError の待機用にインポート
from groq import (
    Groq,
    GroqError,
    AuthenticationError,
    RateLimitError,
    APIConnectionError,
    BadRequestError
)

CONFIG_FILE = "Chatbot-Grok/config.json"

def load_config():
    """設定ファイル config.json を読み込みます。"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        print(f"エラー: 設定ファイル '{CONFIG_FILE}' が見つかりません。")
        return None
    except json.JSONDecodeError:
        print(f"エラー: 設定ファイル '{CONFIG_FILE}' の形式が正しくありません。")
        return None
    except Exception as e:
        print(f"設定ファイルの読み込み中にエラーが発生しました: {e}")
        return None

def main():
    """Groq APIを使用して設定ファイルに基づきチャットボットを実行します。"""
    config = load_config()
    if not config:
        return

    try:
        # APIキーの取得 (環境変数を優先)
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            api_key = config.get("api_key")
            if not api_key or api_key == "YOUR_GROQ_API_KEY_HERE_OR_LEAVE_BLANK_TO_USE_ENV_VAR":
                print("エラー: 環境変数 'GROQ_API_KEY' が設定されていない、かつ")
                print(f"設定ファイル '{CONFIG_FILE}' に有効な 'api_key' が指定されていません。")
                print("どちらかの方法でAPIキーを設定してください。")
                return
            else:
                print(f"設定ファイル '{CONFIG_FILE}' からAPIキーを使用します。")
        else:
            print("環境変数 'GROQ_API_KEY' からAPIキーを使用します。")


        client = Groq(api_key=api_key)
        model_name = config.get("model_name", "qwen-qwq-32b") # デフォルト値
        print(f"'{model_name}' モデルを使用したチャットボットを開始します。")
        print("終了するには 'quit' または 'exit' と入力してください。")

        # 会話履歴を保持するリスト (初期指示を追加)
        message_history = [
            {"role": "system", "content": "Respond in fluent Japanese"}
        ]

        while True:
            user_input = input("\nあなた: ")
            if user_input.lower() in ["quit", "exit"]:
                print("チャットボットを終了します。")
                break

            # ユーザーのメッセージを履歴に追加
            message_history.append({"role": "user", "content": user_input})

            try:
                print(f"\n{model_name} が応答中...")
                chat_completion = client.chat.completions.create(
                    messages=message_history,
                    model=model_name,
                    temperature=config.get("temperature", 0.6),
                    max_completion_tokens=config.get("max_completion_tokens", 8192),
                    top_p=config.get("top_p", 0.95),
                    reasoning_format=config.get("reasoning_format", "parsed"),
                    stream=config.get("stream", False),
                )

                # 応答を取得 (変更なし)
                response_message = chat_completion.choices[0].message
                response_content = response_message.content
                response_reasoning = response_message.reasoning # parsedの場合

                print("\n思考プロセス:")
                print(response_reasoning if response_reasoning else "（Reasoningなし）")
                print("\n応答:")
                print(response_content)

                # アシスタントの応答を履歴に追加 (思考内容は含めない)
                message_history.append({
                    "role": "assistant",
                    "content": response_content
                })

                # 必要に応じて履歴を制限する (例: 直近10ターンなど)
                # if len(message_history) > 20:
                #     message_history = message_history[-20:]

            except AuthenticationError as e:
                print(f"\nGroq API認証エラー: {e}")
                print("APIキーが正しいか、または有効期限が切れていないか確認してください。")
                print("設定ファイルまたは環境変数を確認してください。")
                break # 認証エラーの場合はループを抜ける
            except RateLimitError as e:
                print(f"\nGroq APIレート制限エラー: {e}")
                print("リクエストが多すぎます。少し待ってから再試行します...")
                # 簡単な待機処理 (必要に応じて調整)
                time.sleep(5)
                # ユーザー入力を削除して再試行を促すか、そのまま続けるか選択
                if message_history and message_history[-1]["role"] == "user":
                    message_history.pop()
                print("もう一度入力してください。")
            except APIConnectionError as e:
                print(f"\nGroq API接続エラー: {e}")
                print("APIサーバーへの接続に失敗しました。ネットワーク接続を確認してください。")
                # 接続エラーの場合、少し待ってから再試行するか、終了するか
                time.sleep(5)
                if message_history and message_history[-1]["role"] == "user":
                    message_history.pop()
                print("接続を再試行します。もう一度入力してください。")
            except BadRequestError as e:
                print(f"\nGroq APIリクエストエラー: {e}")
                print("リクエストの内容に問題がある可能性があります（例: モデル名が不正、パラメータが不適切など）。")
                print("設定ファイルやコードを確認してください。")
                if message_history and message_history[-1]["role"] == "user":
                    message_history.pop() # 不正なリクエストにつながった入力を削除
            except GroqError as e: # その他の Groq API エラー
                print(f"\n予期せぬGroq APIエラーが発生しました: {e}")
                if message_history and message_history[-1]["role"] == "user":
                    message_history.pop()
            except Exception as e: # その他の一般的なエラー
                print(f"\n予期せぬエラーが発生しました: {e}")
                if message_history and message_history[-1]["role"] == "user":
                    message_history.pop()


    except Exception as e: # main関数レベルのエラー
        print(f"スクリプトの実行中にエラーが発生しました: {e}")

if __name__ == "__main__":
    main()
