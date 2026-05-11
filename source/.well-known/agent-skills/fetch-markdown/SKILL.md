---
name: fetch-markdown
version: 1.0.0
description: Retrieve any blog post in raw Markdown (with YAML frontmatter) instead of HTML.
---

# Fetch Markdown

Every post on this site is mirrored as a raw Markdown file at a predictable URL.

## How to use

Given a post HTML URL of the form:

```
https://blog.e.show/posts/{slug}/
```

The Markdown twin lives at:

```
https://blog.e.show/posts/{slug}/index.md
```

Each HTML page also advertises this via:

```html
<link rel="alternate" type="text/markdown" href="/posts/{slug}/index.md">
```

## Response shape

`Content-Type: text/markdown; charset=utf-8`

The body is the original Hexo source: YAML frontmatter (title, date, categories, tags, excerpt, index_img) followed by the post body in Markdown.

## Example

`GET https://blog.e.show/posts/self-hosting-guide/index.md`

```markdown
---
title: "自建代理节点完整指南"
date: 2026-04-12
categories:
  - 运营与架构
tags:
  - 自建
  - VPS
---

# 自建代理节点完整指南
...
```
