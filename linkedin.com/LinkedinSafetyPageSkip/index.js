(function () {
    'use strict';

    const fullSafetyUrl = window.location.href;
    const urlObj = new URL(fullSafetyUrl);
    const paramUrl = urlObj.searchParams.get("url");
    let redirectUrl = null;

    if (paramUrl) {
        redirectUrl = decodeURIComponent(paramUrl).trim();
        if (redirectUrl) {
            console.log("[LSPS] Redirect to ", redirectUrl);
            redirectToUrl(redirectUrl);
            return;
        }
    }

    function findAndRedirect() {
        const externalUrl = document.querySelector('a[data-tracking-control-name="external_url_click"]');
        if (externalUrl?.href) {
            const href = externalUrl.href.trim();
            if (href) {
                console.log("[LSPS] Redirect to ", href);
                redirectToUrl(href);
                return true;
            }
        }
        return false;
    }

    if (document.readyState !== 'loading') {
        if (findAndRedirect()) return;
    }

    const observer = new MutationObserver(() => {
        if (findAndRedirect()) {
            observer.disconnect();
        }
    });

    if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.documentElement, { childList: true, subtree: true });
        });
    }

    function redirectToUrl(url) {
        if (url === window.location.href) {
            console.warn("[LSPS] Same URLs, no redirection.");
            return;
        }
        window.location.href = url;
    }

})();
