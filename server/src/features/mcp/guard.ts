import {
    hostHeaderValidationResponse,
    localhostAllowedHostnames,
    originValidationResponse,
} from "@modelcontextprotocol/server";

function hostnameOf(value: string | undefined | null): string | null {
    if (!value) {
        return null;
    }
    try {
        return new URL(value).hostname.toLowerCase();
    } catch {
        return null;
    }
}

function extraAllowedHosts(env: Env): string[] {
    if (!env.MCP_ALLOWED_HOSTS) {
        return [];
    }
    return env.MCP_ALLOWED_HOSTS
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0);
}

export function resolveMcpAllowedHosts(env: Env, request: Request): string[] {
    const hosts = new Set<string>(localhostAllowedHostnames());

    const configuredHost = hostnameOf(env.FRONTEND_URL);
    if (configuredHost) {
        hosts.add(configuredHost);
    }

    for (const host of extraAllowedHosts(env)) {
        hosts.add(host);
    }

    const requestHost = hostnameOf(request.url);
    if (requestHost && requestHost.endsWith(".workers.dev")) {
        hosts.add(requestHost);
    }

    return Array.from(hosts);
}

function invalidHostResponse(hostname: string): Response {
    return Response.json({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: `Invalid Host: ${hostname}`,
        },
        id: null,
    }, {
        status: 403,
        headers: { "Content-Type": "application/json" },
    });
}

export function guardMcpRequest(request: Request, env: Env): Response | null {
    const allowedHosts = resolveMcpAllowedHosts(env, request);
    const hostHeader = request.headers.get("host");

    if (hostHeader) {
        const rejected = hostHeaderValidationResponse(request, allowedHosts);
        if (rejected) {
            return rejected;
        }
    } else {
        const urlHost = hostnameOf(request.url);
        if (!urlHost || !allowedHosts.includes(urlHost)) {
            return invalidHostResponse(urlHost ?? "");
        }
    }

    return originValidationResponse(request, allowedHosts) ?? null;
}
