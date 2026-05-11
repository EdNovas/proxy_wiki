---
name: browse-content
version: 1.0.0
description: Discover and enumerate all posts, categories, and tags on the proxy wiki blog.
---

# Browse Content

This blog publishes machine-readable indexes for full content discovery — no scraping required.

## Endpoints

| Purpose | URL | Content-Type |
|---|---|---|
| Atom feed (20 most recent posts, full content) | `/atom.xml` | `application/atom+xml` |
| XML sitemap (every page, with `lastmod`) | `/sitemap.xml` | `application/xml` |
| Full-text local search index | `/local-search.xml` | `application/xml` |
| Categories landing | `/categories/` | `text/html` |
| Tags landing | `/tags/` | `text/html` |
| Date archives | `/archives/` | `text/html` |

## Recommended workflow

1. `GET /sitemap.xml` — enumerate every post URL.
2. For each post URL `/posts/{slug}/`, fetch `/posts/{slug}/index.md` to get raw Markdown (see the `fetch-markdown` skill).
3. For freshness checks, poll `/atom.xml` — it carries `<updated>` and full post content.

## Topic coverage

Categories include: 协议与原理 (protocol internals), GFW 与审查 (GFW & censorship), DNS 专题, 代理软件 (proxy clients), 流媒体与解锁 (streaming unblock), 排障手册 (troubleshooting), 运营与架构 (deployment & ops), 选择与评估 (evaluation), 入门指南 (getting started), 规则与分流 (rules & routing), 网络知识 (networking fundamentals).
