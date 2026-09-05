import { getApp } from "./app-instance";

const ROOT_FEED_PATTERN = /^\/(rss\.xml|atom\.xml|rss\.json|feed\.json|feed\.xml)$/;
const APP_PUBLIC_ROUTE_PATTERN = /^\/(favicon|favicon\.ico)(?:\/|$)/;

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

function rewriteApiRequest(request: Request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
}

function isRootFeedRequest(pathname: string) {
  return ROOT_FEED_PATTERN.test(pathname);
}

function isAppPublicRoute(pathname: string) {
  return APP_PUBLIC_ROUTE_PATTERN.test(pathname);
}

function isStaticAssetRequest(pathname: string) {
  return /\.\w+$/.test(pathname);
}

async function tryServeAsset(request: Request, env: Env) {
  if (!env.ASSETS) {
    return null;
  }

  try {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 200 || (asset.status >= 300 && asset.status < 400)) {
      return asset;
    }
  } catch {}

  return null;
}

async function serveSpaEntry(request: Request, env: Env) {
  if (!env.ASSETS) {
    return null;
  }

  try {
    const url = new URL(request.url);
    let currentPath = "/index.html";
    let response = await env.ASSETS.fetch(new Request(new URL(currentPath, url.origin), request));

    for (let i = 0; i < 3; i++) {
      if (response.status === 200) {
        return response;
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (!location) break;
        currentPath = location;
        response = await env.ASSETS.fetch(new Request(new URL(currentPath, url.origin), request));
      } else {
        break;
      }
    }
  } catch {}

  return null;
}

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isRootFeedRequest(pathname)) {
    return getApp().fetch(request, env);
  }

  if (isApiRequest(pathname)) {
    return getApp().fetch(rewriteApiRequest(request), env);
  }

  if (isAppPublicRoute(pathname)) {
    return getApp().fetch(request, env);
  }

  if (isStaticAssetRequest(pathname)) {
    const asset = await tryServeAsset(request, env);
    if (asset) {
      return asset;
    }
  }

  const indexResponse = await serveSpaEntry(request, env);
  if (indexResponse) {
    return indexResponse;
  }

  return new Response("Hi", { status: 200 });
}
