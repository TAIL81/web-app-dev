import React, { useEffect, useRef } from 'react';

const AnalogClock = ({ isDarkMode, toggleDarkMode, "aria-hidden": ariaHidden }) => {
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const secRef = useRef(null);
  const containerRef = useRef(null);

  const setClock = () => {
    const day = new Date();
    const hh = day.getHours() * 30;
    const mm = day.getMinutes() * 6; // deg = 6
    const ss = day.getSeconds() * 6; // deg = 6

    if (hourRef.current) {
      hourRef.current.style.transform = `rotateZ(${hh + mm / 12}deg)`;
    }
    if (minRef.current) {
      minRef.current.style.transform = `rotateZ(${mm}deg)`;
    }
    if (secRef.current) {
      secRef.current.style.transform = `rotateZ(${ss}deg)`;
    }
  };

  useEffect(() => {
    setClock(); // 初期描画
    const intervalId = setInterval(setClock, 1000); // 1秒ごとに更新

    return () => clearInterval(intervalId); // クリーンアップ
  }, []);

  // isDarkMode の変更を監視する useEffect は、CSSファイルが削除されるため不要になります。
  // テーマに応じたスタイル変更はTailwindのダークモード修飾子(dark:)で行います。

  return (
    <div 
      className="flex flex-col justify-center items-center text-base relative p-4" 
      ref={containerRef}
      aria-hidden={ariaHidden} // App.jsx から渡された aria-hidden を適用
    >
      <div 
        className="min-h-[12em] min-w-[12em] flex justify-center items-center bg-[url('https://imvpn22.github.io/analog-clock/clock.png')] bg-center bg-cover rounded-full relative text-gray-800 dark:text-gray-200"
        style={{ 
          boxShadow: '0 -10px 10px rgba(255, 255, 255, 0.05), inset 0 -10px 10px rgba(255, 255, 255, 0.05), 0 10px 10px rgba(0, 0, 0, 0.3), inset 0 10px 10px rgba(0, 0, 0, 0.3)' 
        }}
      >
        {/* Clock center dot */}
        <div className="content-[''] h-[0.6rem] w-[0.6rem] bg-current border-2 border-transparent absolute rounded-full z-10"></div>
        
        {/* Hour hand */}
        <div 
          className="absolute flex justify-center rounded-full h-[7em] w-[7em]" 
          ref={hourRef}
        >
          <div className="content-[''] absolute h-1/2 w-[5px] bg-current rounded-[5px]"></div>
        </div>
        
        {/* Minute hand */}
        <div 
          className="absolute flex justify-center rounded-full h-[9em] w-[9em]" 
          ref={minRef}
        >
          <div className="content-[''] absolute h-1/2 w-[3px] bg-current rounded-[3px]"></div>
        </div>

        {/* Second hand */}
        <div 
          className="absolute flex justify-center rounded-full h-[10em] w-[10em]" 
          ref={secRef}
        >
          <div className="content-[''] absolute h-3/5 w-[2px] bg-red-500 rounded-[2px]"></div>
        </div>
      </div>
    </div>
  );
}

export default AnalogClock;
