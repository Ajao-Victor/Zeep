/**
 * Inline <head> script for the landing page: a load or refresh of "/" always opens at the top.
 *
 * - A section link (Services, How it works, FAQ) leaves "/#how" or similar in the address bar, so a
 *   refresh used to jump to that section. The hash is removed before the body is parsed, so the
 *   browser never scrolls to the anchor. In-app section links still scroll there (SiteHeader).
 * - Browsers restore the previous scroll position on refresh; "manual" turns that off for "/".
 *   SiteHeader sets it back to "auto" on other pages.
 */
export const landingScrollScript = `try{if(location.pathname==="/"){history.scrollRestoration="manual";if(location.hash)history.replaceState(history.state,"","/"+location.search)}}catch(e){}`;
