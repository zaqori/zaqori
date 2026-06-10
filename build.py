#!/usr/bin/env python3
"""
ZAQORI Build Script
Converts markdown articles in blog/content/ to static HTML pages in blog/,
updates blog/index.html, and refreshes sitemap.xml.

Run after publishing new articles via the Decap CMS admin panel:
    python3 build.py

Or configure Netlify to run this as a build command:
    command = "python3 build.py"
"""
import os
import re
import json
import glob
from datetime import datetime
from pathlib import Path

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

ROOT = Path(__file__).parent.resolve()
BLOG_DIR = ROOT / "blog"
CONTENT_DIR = BLOG_DIR / "content"
BLOG_INDEX = BLOG_DIR / "index.html"
SITEMAP = ROOT / "sitemap.xml"


# ─────────────────────────────────────────────────────────
# Frontmatter parser
# ─────────────────────────────────────────────────────────
def parse_frontmatter(text):
    """Extract YAML frontmatter and body from a markdown file."""
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text, re.DOTALL)
    if not m:
        return {}, text
    fm_text, body = m.group(1), m.group(2)
    if HAS_YAML:
        try:
            meta = yaml.safe_load(fm_text) or {}
            # Remove 'body' from meta if present (it's the markdown body)
            meta.pop('body', None)
            return meta, body
        except yaml.YAMLError:
            pass
    # Fallback: simple line-by-line parser
    meta = {}
    current_list = None
    for line in fm_text.split('\n'):
        if not line.strip():
            continue
        list_m = re.match(r'^\s*-\s+(.*)$', line)
        if list_m and current_list is not None:
            val = list_m.group(1).strip().strip('"').strip("'")
            current_list.append(val)
            continue
        kv_m = re.match(r'^([\w][\w_]*):\s*(.*)$', line)
        if kv_m:
            key, val = kv_m.group(1), kv_m.group(2).strip()
            if val == '':
                current_list = []
                meta[key] = current_list
            elif val.lower() in ('true', 'false'):
                meta[key] = val.lower() == 'true'
            elif re.match(r'^-?\d+\.?\d*$', val):
                meta[key] = float(val) if '.' in val else int(val)
            else:
                meta[key] = val.strip('"').strip("'")
                current_list = None
    return meta, body


# ─────────────────────────────────────────────────────────
# Markdown → HTML (lightweight converter)
# ─────────────────────────────────────────────────────────
def md_to_html(md):
    """Minimal Markdown converter: handles headings, bold, italic, links, lists, blockquotes, images, paragraphs."""
    html = md
    # Code blocks
    html = re.sub(r'```(\w*)\n(.*?)```', r'<pre><code class="language-\1">\2</code></pre>', html, flags=re.DOTALL)
    # Images
    html = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img alt="\1" src="\2" loading="lazy">', html)
    # Links
    html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)
    # Headings
    html = re.sub(r'^######\s+(.+)$', r'<h6>\1</h6>', html, flags=re.MULTILINE)
    html = re.sub(r'^#####\s+(.+)$', r'<h5>\1</h5>', html, flags=re.MULTILINE)
    html = re.sub(r'^####\s+(.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^###\s+(.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^##\s+(.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^#\s+(.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    # Blockquotes
    html = re.sub(r'^>\s+(.+)$', r'<blockquote>\1</blockquote>', html, flags=re.MULTILINE)
    # Bold + italic
    html = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', html)
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
    # Unordered lists
    html = re.sub(r'(?:^- .+(?:\n|$))+', lambda m: '<ul>' + ''.join(f'<li>{line[2:]}</li>' for line in m.group(0).strip().split('\n') if line.startswith('- ')) + '</ul>', html, flags=re.MULTILINE)
    # Paragraphs: split on double newlines, wrap non-tag lines in <p>
    paragraphs = re.split(r'\n\s*\n', html)
    out = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if p.startswith('<h') or p.startswith('<ul') or p.startswith('<ol') or p.startswith('<pre') or p.startswith('<blockquote') or p.startswith('<img') or p.startswith('<figure'):
            out.append(p)
        else:
            # Replace single newlines with <br> inside the paragraph
            p_inner = re.sub(r'\n', '<br>\n', p)
            out.append(f'<p>{p_inner}</p>')
    return '\n\n'.join(out)


# ─────────────────────────────────────────────────────────
# Article HTML template
# ─────────────────────────────────────────────────────────
def article_html(meta, body_html, slug):
    title = meta.get('title', 'Untitled')
    date_raw = meta.get('date', '')
    try:
        dt = datetime.fromisoformat(str(date_raw).replace('Z', ''))
        date_display = dt.strftime('%B %d, %Y')
    except (ValueError, TypeError):
        date_display = str(date_raw)
    category = meta.get('category', 'Uncategorized')
    image = meta.get('image', '')
    author = meta.get('author', 'ZAQORI Team')
    read_time = meta.get('read_time', 5)
    meta_title = meta.get('meta_title', title)
    meta_desc = meta.get('meta_description', '')

    image_block = ''
    if image:
        image_block = f'        <div class="article-hero-image"><img src="{image}" alt="{title}"></div>\n'

    return f'''<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} - ZAQORI</title>
    <meta name="description" content="{meta_desc}">
    <link rel="canonical" href="https://zaqori.com/blog/{slug}.html">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{meta_desc}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://zaqori.com/blog/{slug}.html">
    <meta property="og:image" content="https://zaqori.com{image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{meta_desc}">
    <link rel="stylesheet" href="../css/styles.css">
    <!-- Google AdSense -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8548563022480099"
    crossorigin="anonymous"></script>
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "{title}",
        "description": "{meta_desc}",
        "image": "https://zaqori.com{image}",
        "datePublished": "{date_raw}",
        "author": {{"@type": "Organization", "name": "{author}"}},
        "publisher": {{"@type": "Organization", "name": "ZAQORI"}}
    }}
    </script>
    <style>
        .article-hero-image {{ margin: 20px 0 30px; border-radius: 12px; overflow: hidden; }}
        .article-hero-image img {{ width: 100%; height: auto; display: block; aspect-ratio: 1200/630; object-fit: cover; }}
    </style>
</head>
<body>
    <header class="site-header">
        <div class="header-inner">
            <a href="../index.html" class="brand"><span class="brand-logo">Z</span><span>ZAQORI</span></a>
            <button class="menu-toggle" aria-label="Toggle menu">\u2630</button>
            <ul class="nav-menu">
                <li><a href="../index.html">Home</a></li>
                <li><a href="../index.html#all-simulators">Simulators</a></li>
                <li><a href="../blog/" class="active">Blog</a></li>
                <li><a href="../pages/about.html">About</a></li>
                <li><a href="../pages/contact.html">Contact</a></li>
            </ul>
            <div class="header-actions"><button class="theme-toggle"><span class="theme-icon">\U0001F319</span></button></div>
        </div>
    </header>

    <article class="article">
        <span class="blog-category">{category}</span>
        <h1>{title}</h1>
        <div class="article-meta">
            <span>\U0001F4C5 {date_display}</span>
            <span>\u23F1\uFE0F {read_time} min read</span>
            <span>\u270D\uFE0F {author}</span>
        </div>

{image_block}
        <div class="article-body">
{body_html}
        </div>
    </article>

    <footer class="site-footer">
        <div class="footer-inner">
            <div><a href="../index.html" class="brand"><span class="brand-logo">Z</span><span>ZAQORI</span></a><p class="footer-brand">See where today's choices lead tomorrow.</p></div>
            <div class="footer-col"><h4>Simulators</h4><ul><li><a href="../simulators/future-wealth-simulator.html">Future Wealth</a></li><li><a href="../simulators/fitness-progress-simulator.html">Fitness Progress</a></li><li><a href="../simulators/reading-progress-simulator.html">Reading Progress</a></li><li><a href="../simulators/career-growth-simulator.html">Career Growth</a></li></ul></div>
            <div class="footer-col"><h4>Blog</h4><ul><li><a href="../blog/the-hidden-cost-of-social-media.html">Productivity</a></li><li><a href="../blog/what-happens-if-you-save-10-dollars-every-day.html">Wealth Building</a></li><li><a href="../blog/why-small-habits-create-massive-results.html">Habits</a></li></ul></div>
            <div class="footer-col"><h4>Company</h4><ul><li><a href="../pages/about.html">About</a></li><li><a href="../pages/contact.html">Contact</a></li><li><a href="../pages/privacy.html">Privacy</a></li><li><a href="../pages/terms.html">Terms</a></li></ul></div>
            <div class="footer-col"><h4>Explore</h4><ul><li><a href="../categories/productivity.html">Categories</a></li><li><a href="../sitemap.xml">Sitemap</a></li><li><a href="../pages/disclaimer.html">Disclaimer</a></li></ul></div>
            <div class="footer-col"><h4>Contact</h4><ul><li><a href="mailto:zaqori.official@gmail.com">zaqori.official@gmail.com</a></li><li><a href="mailto:zaqori.support@gmail.com">zaqori.support@gmail.com</a></li><li><a href="../pages/contact.html">Contact Form</a></li></ul></div>
        </div>
        <div class="footer-bottom">
            <p>\u00A9 2026 ZAQORI. All rights reserved. <a href="mailto:zaqori.official@gmail.com" style="color:inherit;text-decoration:underline;">zaqori.official@gmail.com</a></p>
        </div>
    </footer>
    <script src="../js/main.js"></script>
</body>
</html>
'''


# ─────────────────────────────────────────────────────────
# Build process
# ─────────────────────────────────────────────────────────
def build():
    if not CONTENT_DIR.exists():
        print(f"No content directory found at {CONTENT_DIR}")
        print("Create .md files in blog/content/ via the Decap CMS admin panel first.")
        return

    md_files = sorted(CONTENT_DIR.glob("*.md"))
    if not md_files:
        print("No .md files found in blog/content/")
        return

    print(f"Found {len(md_files)} markdown article(s) in blog/content/")
    articles = []

    for md_file in md_files:
        print(f"  Processing {md_file.name}...")
        text = md_file.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        body_html = md_to_html(body)

        # Skip drafts
        if meta.get('draft', False):
            print(f"    Skipping (draft=true)")
            continue

        # Use slug from frontmatter, fall back to filename
        slug = meta.get('slug') or md_file.stem
        # Sanitize slug
        slug = re.sub(r'[^a-z0-9-]', '', str(slug).lower().replace(' ', '-'))

        html = article_html(meta, body_html, slug)
        out_path = BLOG_DIR / f"{slug}.html"
        out_path.write_text(html, encoding="utf-8")
        print(f"    -> {out_path.relative_to(ROOT)}")

        articles.append({
            'title': meta.get('title', slug),
            'slug': slug,
            'date': str(meta.get('date', '')),
            'category': meta.get('category', 'Uncategorized'),
            'image': meta.get('image', ''),
            'meta_description': meta.get('meta_description', ''),
            'read_time': meta.get('read_time', 5),
        })

    print(f"\nGenerated {len(articles)} published article(s)")
    update_blog_index(articles)
    update_sitemap(articles)
    print("\nDone! Next steps:")
    print("  1. git add . && git commit -m 'Add new articles'")
    print("  2. git push  (Netlify will auto-deploy)")
    print("  3. Visit https://zaqori.com/blog/ to see new articles")


def update_blog_index(articles):
    """Insert new articles into blog/index.html (keeps existing ones)."""
    if not BLOG_INDEX.exists():
        print(f"  Warning: {BLOG_INDEX} not found, skipping index update")
        return

    index_text = BLOG_INDEX.read_text(encoding="utf-8")

    # Sort by date descending
    articles.sort(key=lambda a: a['date'], reverse=True)

    # Find the blog-grid container and append new cards
    new_cards = []
    for art in articles:
        date_display = art['date']
        try:
            dt = datetime.fromisoformat(art['date'].replace('Z', ''))
            date_display = dt.strftime('%Y-%m-%d')
        except (ValueError, TypeError):
            pass
        new_cards.append(f'''                <a href="{art['slug']}.html" class="blog-card">
                    <div class="blog-image">\U0001F4D6</div>
                    <div class="blog-content">
                        <span class="blog-category">{art['category']}</span>
                        <h3>{art['title']}</h3>
                        <p>{art['meta_description']}</p>
                        <div class="blog-meta">{date_display} \u00B7 {art['read_time']} min read</div>
                    </div>
                </a>''')

    new_cards_html = '\n'.join(new_cards)

    # Find the blog-grid div and insert cards before its closing </div>
    grid_match = re.search(r'(<div class="blog-grid">)(.*?)(\n            </div>)', index_text, re.DOTALL)
    if grid_match:
        existing_cards = grid_match.group(2)
        updated = grid_match.group(1) + existing_cards.rstrip() + '\n' + new_cards_html + grid_match.group(3)
        index_text = index_text[:grid_match.start()] + updated + index_text[grid_match.end():]
        BLOG_INDEX.write_text(index_text, encoding="utf-8")
        print(f"  Updated {BLOG_INDEX.relative_to(ROOT)} with {len(articles)} new card(s)")

        # Also update the article count in the subtitle
        index_text2 = BLOG_INDEX.read_text(encoding="utf-8")
        existing_count = len(re.findall(r'<a href="[^"]+\.html" class="blog-card">', index_text2))
        index_text2 = re.sub(
            r'<p class="section-subtitle">\d+ articles? in total</p>',
            f'<p class="section-subtitle">{existing_count} articles in total</p>',
            index_text2
        )
        BLOG_INDEX.write_text(index_text2, encoding="utf-8")
    else:
        print(f"  Warning: Could not find blog-grid in {BLOG_INDEX}")


def update_sitemap(articles):
    """Add new articles to sitemap.xml."""
    if not SITEMAP.exists():
        print(f"  Warning: {SITEMAP} not found, skipping sitemap update")
        return

    sitemap_text = SITEMAP.read_text(encoding="utf-8")
    today = datetime.now().strftime('%Y-%m-%d')

    new_urls = []
    for art in articles:
        new_urls.append(f'''  <url>
    <loc>https://zaqori.com/blog/{art['slug']}.html</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>''')

    new_urls_xml = '\n'.join(new_urls)

    # Insert before </urlset>
    sitemap_text = sitemap_text.replace('</urlset>', new_urls_xml + '\n</urlset>')
    SITEMAP.write_text(sitemap_text, encoding="utf-8")
    print(f"  Updated {SITEMAP.relative_to(ROOT)} with {len(articles)} new URL(s)")


if __name__ == "__main__":
    build()
