// ZAQORI - Main JavaScript
(function() {
    'use strict';

    // Theme management
    function initTheme() {
        const saved = localStorage.getItem('zaqori-theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon(saved);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('zaqori-theme', next);
        updateThemeIcon(next);
    }

    function updateThemeIcon(theme) {
        const icons = document.querySelectorAll('.theme-icon');
        icons.forEach(icon => {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        });
    }

    // Mobile menu
    function initMobileMenu() {
        const toggle = document.querySelector('.menu-toggle');
        const menu = document.querySelector('.nav-menu');
        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                menu.classList.toggle('open');
            });
        }
    }

    // Theme toggle binding
    function initThemeToggle() {
        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(btn => {
            btn.addEventListener('click', toggleTheme);
        });
    }

    // Search
    function initSearch() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        searchInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = searchInput.value.trim().toLowerCase();
                if (q) {
                    window.location.href = 'index.html#search=' + encodeURIComponent(q);
                }
            }
        });
    }

    // Share results
    window.shareResults = function(title, text) {
        if (navigator.share) {
            navigator.share({ title, text, url: window.location.href });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(() => {
                alert('Link copied to clipboard!');
            });
        } else {
            prompt('Copy this link:', window.location.href);
        }
    };

    // Smooth scroll for hash links
    document.addEventListener('click', e => {
        const link = e.target.closest('a[href^="#"]');
        if (link) {
            const id = link.getAttribute('href');
            if (id === '#' || id.length < 2) return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            initMobileMenu();
            initThemeToggle();
            initSearch();
        });
    } else {
        initTheme();
        initMobileMenu();
        initThemeToggle();
        initSearch();
    }
})();
