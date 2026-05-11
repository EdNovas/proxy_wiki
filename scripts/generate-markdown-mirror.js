// Emit a raw-markdown twin for every post at posts/<slug>/index.md
// so agents requesting the markdown alternate get the source verbatim
// (frontmatter included — gives them title/date/tags/excerpt for free).

hexo.extend.generator.register('post_markdown_mirror', function (locals) {
  return locals.posts.map(function (post) {
    return {
      path: post.path.replace(/\/?$/, '/') + 'index.md',
      data: post.raw
    };
  });
});
