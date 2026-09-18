import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import posts from 'virtual:posts';
import './Blog.css';

/* ===========================
   工具函数
   =========================== */
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function groupByYear(postList) {
  const map = new Map();
  for (const post of postList) {
    const year = post.date.slice(0, 4);
    if (!map.has(year)) map.set(year, []);
    map.get(year).push(post);
  }
  return [...map.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, list]) => ({
      year,
      posts: list.sort((a, b) => (a.date < b.date ? 1 : -1)),
    }));
}

function getAllTags(postList) {
  const map = new Map();
  for (const post of postList) {
    for (const tag of post.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

function useTimelineReveal(deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.tl-observe'));
    if (!items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/* ===========================
   标签筛选栏
   =========================== */
function TagFilter({ tags, activeTag, setActiveTag, totalCount }) {
  if (!tags.length) return null;

  return (
    <div className="tag-filter" role="group" aria-label="按标签筛选">
      <button
        className={`tag-filter__btn${!activeTag ? ' is-active' : ''}`}
        onClick={() => setActiveTag(null)}
      >
        <span className="tag-filter__name">全部</span>
        <span className="tag-filter__count">{totalCount}</span>
      </button>
      {tags.map(({ name, count }) => (
        <button
          key={name}
          className={`tag-filter__btn${activeTag === name ? ' is-active' : ''}`}
          onClick={() => setActiveTag(activeTag === name ? null : name)}
          aria-pressed={activeTag === name}
        >
          <span className="tag-filter__name">{name}</span>
          <span className="tag-filter__count">{count}</span>
        </button>
      ))}
    </div>
  );
}

/* ===========================
   主组件
   =========================== */
export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFromUrl = searchParams.get('tag');
  const [activeTag, setActiveTag] = useState(tagFromUrl);

  // URL 参数变化时同步状态
  useEffect(() => {
    setActiveTag(tagFromUrl);
  }, [tagFromUrl]);

  // 更新标签时同步 URL
  const handleTagChange = (tag) => {
    setActiveTag(tag);
    if (tag) {
      setSearchParams({ tag });
    } else {
      setSearchParams({});
    }
  };

  const tags = getAllTags(posts);

  const filtered = activeTag
    ? posts.filter((p) => p.tags?.includes(activeTag))
    : posts;

  const groups = groupByYear(filtered);
  const timelineRef = useTimelineReveal([activeTag]);

  return (
    <main className="blog-page">
      <div className="container">

        <header className="blog-page__header">
          <p className="blog-page__eyebrow">BLOG</p>
          <span className="divider" />
          <p className="blog-page__desc">
            代码、架构、思考。凌晨两点的清醒记录。
          </p>
        </header>

        <div className="blog-layout">
          <div className="blog-main">
            {filtered.length === 0 ? (
              <p className="timeline__empty">没有找到标签为「{activeTag}」的文章。</p>
            ) : (
              <div className="timeline" ref={timelineRef}>
                {groups.map(({ year, posts: yearPosts }) => (
                  <div key={year} className="timeline__year">
                    <div className="timeline__year-label tl-observe">{year}</div>

                    {yearPosts.map((post, idx) => (
                      <Link
                        key={post.slug}
                        to={`/blog/${post.slug}`}
                        className="timeline__item tl-observe"
                        style={{ transitionDelay: `${idx * 0.06}s` }}
                      >
                        <div className="timeline__item-title">{post.title}</div>

                        <div className="timeline__item-meta">
                          <span className="timeline__item-date">{formatDate(post.date)}</span>
                          {post.tags?.length > 0 && (
                            <div className="timeline__item-tags">
                              {post.tags.map((t) => (
                                <Link 
                                  key={t} 
                                  to={`/blog?tag=${encodeURIComponent(t)}`}
                                  className="tag"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>

                        {post.excerpt && (
                          <p className="timeline__item-excerpt">{post.excerpt}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <aside className="blog-sidebar">
              <TagFilter tags={tags} activeTag={activeTag} setActiveTag={handleTagChange} totalCount={posts.length} />
            </aside>
          )}
        </div>

      </div>
    </main>
  );
}
