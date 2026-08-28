import { useState, useEffect, useRef } from 'react';
import Giscus from '@giscus/react';
import { init } from '@waline/client';
import '@waline/client/style';
import './Comments.css';

function WalineComments() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const instance = init({
      el: containerRef.current,
      serverURL: 'https://comments.luri.cc.cd',
      lang: 'zh-CN',
      dark: 'auto',
      avatar: 'wavatar',
      emoji: false,
      search: false,
      imageUploader: false,
      copyright: false,
    });
    return () => {
      instance?.destroy();
    };
  }, []);

  return <div id="waline-container" ref={containerRef} />;
}

export default function Comments() {
  const [tab, setTab] = useState('waline');

  return (
    <div className="comments">
      <div className="comments__tabs">
        <button
          className={`comments__tab ${tab === 'waline' ? 'is-active' : ''}`}
          onClick={() => setTab('waline')}
        >
          匿名留言
        </button>
        <button
          className={`comments__tab ${tab === 'giscus' ? 'is-active' : ''}`}
          onClick={() => setTab('giscus')}
        >
          GitHub 讨论
        </button>
      </div>

      <div className="comments__body">
        {tab === 'waline' && <WalineComments />}
        {tab === 'giscus' && (
          <Giscus
            repo="mobaiit/ycweb"
            repoId="R_kgDOUFu-Og"
            category="Ideas"
            categoryId="DIC_kwDOUFu-Os4DEWNw"
            mapping="pathname"
            strict="0"
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="top"
            theme="preferred_color_scheme"
            lang="zh-CN"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}
