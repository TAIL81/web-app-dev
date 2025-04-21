# プロジェクト引き継ぎ資料: React/Tailwind チャット UI

## 1. はじめに

この資料は、React と Tailwind CSS を用いて開発中のチャットボット UI プロジェクトに関する情報をまとめたものです。プロジェクトの概要、開発環境、構成、現在の状況と課題について記載しており、スムーズな引き継ぎを目的としています。

## 2. プロジェクト概要

*   **目的:** React と Tailwind CSS を使用して、Groq AI (推定) をバックエンドとするチャットボットのユーザーインターフェースを開発・改善する。
*   **主な技術スタック:**
    *   **フロントエンド:**
        *   言語: TypeScript, JavaScript (JSX/TSX)
        *   UI ライブラリ: React (v19.1.0)
        *   CSS フレームワーク: Tailwind CSS (v3.4.1)
        *   Markdown 表示: `react-markdown` (v10.1.0)
        *   Tailwind Typography: `@tailwindcss/typography` (v0.5.16)
        *   ビルド/設定: Create React App (CRA), Craco (v7.1.0), PostCSS
        *   パッケージ管理: npm (v11.3.0)
    *   **バックエンド (推定):**
        *   言語: Python (v3.11.9)
        *   フレームワーク: FastAPI (v0.115.12)
        *   AI 連携: Groq クライアント (groq v0.22.0)
        *   サーバー: Uvicorn (v0.34.1)
    *   **開発環境 OS:** Windows 11
    *   **Node.js:** v20.17.0

## 3. 開発環境詳細 (`environment.md` より)

*   **OS:** Windows 11
*   **Node.js:** 20.17.0
*   **npm:** 11.3.0
*   **Python:** 3.11.9
*   **Backend Libraries:**
    *   fastapi==0.115.12
    *   groq==0.22.0
    *   pydantic==2.11.3
    *   uvicorn==0.34.1
*   **Frontend Libraries (主要抜粋):**
    *   `@craco/craco`: "^7.1.0"
    *   `@tailwindcss/typography`: "^0.5.16"
    *   `react`: "^19.1.0"
    *   `react-dom`: "^19.1.0"
    *   `react-markdown`: "^10.1.0"
    *   `react-scripts`: "^5.0.1"
    *   `tailwindcss`: "^3.4.1"
    *   `typescript`: "^4.9.5"
    *   `lucide-react`: (バージョン情報が必要な場合は `package.json` を参照)
    *   *(その他のライブラリは `frontend/package.json` を参照)*

## 4. プロジェクト構成 (`frontend/` ディレクトリ)

*   **`frontend/`**: フロントエンドのソースコードが格納されているディレクトリ。
    *   **`public/`**: 静的ファイル (HTML, 画像など) が格納されている。
    *   **`src/`**: ソースコードが格納されている。
        *   **`assets/`**: 画像やフォントなどのアセットが格納されている。
        *   **`components/`**: React コンポーネントが格納されている。
        *   **`hooks/`**: カスタムフックが格納されている。
        *   **`pages/`**: ページコンポーネントが格納されている。
        *   **`styles/`**: グローバルスタイルや Tailwind CSS の設定が格納されている。
        *   **`utils/`**: ユーティリティ関数が格納されている。
        *   **`App.tsx`**: アプリケーションのエントリーポイントとなるコンポーネント。
        *   **`index.tsx`**: アプリケーションのエントリーポイントとなるファイル。ReactDOM を使用してアプリケーションをレンダリングする。

*   **主要ファイル/フォルダの役割:**
    *   `package.json`: 依存ライブラリと `npm start`, `npm run build` などのスクリプトを確認。
    *   `tailwind.config.js`: Tailwind の設定（特に `content` と `plugins`）。
    *   `craco.config.js`: CRA のカスタマイズ内容を確認。
    *   `src/index.tsx`: アプリケーションの起点。
    *   `src/App.jsx`: メインのコンポーネント。UI 構造の中心。
    *   `src/index.css`: グローバルスタイルと Tailwind の `@tailwind` ディレクティブ。
    *   `見え方.json`: **重要:** 現在発生している UI の問題点を具体的に記述したファイル。理想形ではなく、**現状の不具合がある表示状態**を示している。

## 5. 現在の状況と課題 (作業日報より)

現在、以下の課題に取り組んでいます。

*   **課題 1: `@tailwindcss/typography` (`prose` クラス) のスタイルが適用されない**
    *   **現象:** `react-markdown` でレンダリングされた HTML 要素 (見出し、リストなど) に、期待される `prose` のスタイルが適用されていない。
    *   **試したこと:**
        *   `tailwind.config.js` への `@tailwindcss/typography` プラグイン追加。
        *   `prose` クラスを適用する要素の確認。
        *   開発者ツールでの CSS 確認 (基本的な確認)。
        *   `index.css` への `@tailwind base; @tailwind components; @tailwind utilities;` の記述確認。
    *   **考えられる原因:**
        *   `tailwind.config.js` の `content` 設定漏れ。
        *   Tailwind CSS のビルドプロセス不具合。
        *   他の CSS ルールによる上書き (詳細度、`index.css` など)。
        *   Craco 設定の影響。
*   **課題 2: チャットログのレイアウト崩れ**
    *   **現象:** ユーザー/ボットのアイコンとメッセージ本文の横並びレイアウトが、CodePen で作成した理想形と異なり、意図通りに表示されていない。(`flex` を使用中)
    *   **試したこと:**
        *   `flex` を使用したレイアウト実装。
        *   CodePen との比較 (基本的な確認)。
    *   **考えられる原因:**
        *   HTML 構造の違い (CodePen との差分)。
        *   適用している Tailwind クラスの間違いや不足 (`items-center`, `justify-*`, `flex-grow` など)。
        *   親要素/子要素の幅やスタイルの影響。

*   **現状の UI 詳細:**
    *   `見え方.json` ファイルは、上記の問題が発生している**現在のブラウザ上の表示状態**を詳細に記述したものです。これを参照することで、具体的な問題箇所を把握できます。

*   **次回の方針:**
    1.  `tailwind.config.js` の `content` 設定を再確認し、開発サーバーを再起動する。
    2.  ブラウザの開発者ツールを使い、`prose` スタイルが生成/適用されているか、どの CSS が競合しているかを詳細に調査する。
    3.  `index.css` や `App.css` など、他の CSS ファイルによるスタイルの上書きがないか確認する。
    4.  CodePen の実装と現在のコードを詳細に比較し、`flex` レイアウトの問題点を特定・修正する。
    5.  (必要であれば) 問題を最小限のコンポーネントで再現し、切り分けを行う。

## 6. 補足

*   プロジェクトのセットアップは、`frontend` ディレクトリで `npm install` を実行後、`npm start` で開発サーバーを起動します。
*   バックエンド API (FastAPI) の起動も必要になる可能性があります (手順は別途確認)。
*   `.jsx` と `.tsx` ファイルが混在しているため、TypeScript の適用範囲に注意してください。

---

この資料が、プロジェクトの理解と引き継ぎの一助となれば幸いです。
