# 日本語チャットボットアプリケーション

このアプリケーションは、Groq API の `compound-beta-mini` モデルを使用したチャットボットです。高速な応答と、Web検索やコード実行といった Agentic Tooling 機能を活用できます。

## 技術スタック
- React 18
- Tailwind CSS (カスタム設定あり)
- Lucide React アイコン
- React Markdown
- react-textarea-autosize

## 開発環境要件

### 必須環境
- OS: Windows 11 (推奨)
- Node.js: 20.17.0 以上
- npm: 11.3.0 以上
- Python: 3.11.9 以上

### バックエンド依存関係
```bash
fastapi==0.115.12
groq==0.22.0
pydantic==2.11.3
uvicorn==0.34.1
```

### 環境セットアップ
1. Python仮想環境作成:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt
```

2. Node.jsパッケージインストール:
```bash
npm install
```

3. バックエンドサーバー起動:
```bash
python backend/main.py
```

4. フロントエンド起動:
```bash
cd frontend && npm start
```

## 主要機能
- 日本語自然な会話インターフェース
- Agentic Tooling (Web検索やコード実行による応答生成)
- レスポンシブデザイン
- エラーハンドリング

## Available Scripts
### `npm start`
開発モードでアプリを起動 [http://localhost:3000](http://localhost:3000)

### `npm test`
テストランナーを起動

### `npm run build`
本番用ビルドを生成

### `npm run eject`
設定ファイルを展開 (注意: 元に戻せません)

## デプロイ
```bash
npm run build
```
ビルド後、`build`ディレクトリをデプロイ

## 参考資料
- [Create React App ドキュメント](https://facebook.github.io/create-react-app/docs/getting-started)
- [React ドキュメント](https://reactjs.org/)
