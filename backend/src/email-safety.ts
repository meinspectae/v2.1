import sanitizeHtml from 'sanitize-html';

/** Parse HTML instead of attempting to remove executable markup with regexes. */
export function sanitizeReportHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'html', 'head', 'body', 'meta'],
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'title', 'dir', 'lang', 'align', 'valign', 'width', 'height', 'bgcolor'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'border'],
      table: ['width', 'height', 'border', 'cellpadding', 'cellspacing', 'role'],
      td: ['colspan', 'rowspan', 'width', 'height'],
      th: ['colspan', 'rowspan', 'scope', 'width', 'height'],
      meta: ['charset'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cid'],
    allowedSchemesByTag: { img: ['http', 'https', 'cid', 'data'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        // Keep normal email presentation, but never executable CSS or CSS URLs.
        ...Object.fromEntries([
          'color', 'background', 'background-color', 'background-image',
          'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
          'text-align', 'text-decoration', 'text-transform', 'letter-spacing', 'white-space',
          'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
          'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
          'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
          'border-color', 'border-style', 'border-width', 'border-radius', 'border-collapse', 'border-spacing',
          'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
          'display', 'vertical-align', 'box-sizing', 'box-shadow', 'overflow', 'opacity',
          'list-style', 'list-style-type', 'table-layout', 'word-break', 'overflow-wrap',
          'flex', 'flex-direction', 'align-items', 'justify-content', 'gap',
        ].map(property => [property, [/^(?!.*(?:expression|url\s*\(|javascript|vbscript|behavior|binding|@import|\\)).*$/i]])),
      },
    },
    nonTextTags: ['script', 'style', 'textarea', 'option', 'iframe', 'object', 'embed', 'svg', 'math'],
    transformTags: {
      img: (tagName, attribs) => {
        if (attribs.src?.toLowerCase().startsWith('data:')
          && !/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(attribs.src)) {
          delete attribs.src;
        }
        return { tagName, attribs };
      },
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } }),
    },
  });
}
