module.exports = function config(req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
  const convexUrl = process.env.CONVEX_URL || "";
  let parsedConvexUrl;

  try {
    parsedConvexUrl = new URL(convexUrl);
  } catch {
    res.statusCode = 503;
    return res.end("throw new Error('Production Convex configuration is missing.');");
  }

  if (!publishableKey.startsWith("pk_live_") || parsedConvexUrl.protocol !== "https:" || !/^[a-z0-9-]+\.convex\.cloud$/i.test(parsedConvexUrl.hostname)) {
    res.statusCode = 503;
    return res.end("throw new Error('Production Clerk or Convex configuration is invalid.');");
  }

  res.statusCode = 200;
  res.end([
    `window.PNC_CLERK_PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};`,
    `window.__PNC_CONVEX_URL__ = ${JSON.stringify(parsedConvexUrl.origin)};`,
  ].join("\n"));
};
