// vivia reads post.photos (Hexo standard, array) to render the cover image
// on home/list pages (the right-side panel) and the post header gallery.
// Our existing posts use the Fluid-era `index_img:` single-string frontmatter.
// Mirror it into `photos` at load time so we don't have to edit 63 files.

hexo.extend.filter.register('before_post_render', function (data) {
  if (data.index_img && (!Array.isArray(data.photos) || data.photos.length === 0)) {
    data.photos = [data.index_img];
  }
  return data;
});
