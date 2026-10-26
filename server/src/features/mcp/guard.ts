import {
    hostHeaderValidationResponse,
    localhostAllowedHostnames,
    originValidationResponse,
} from "@modelcontextprotocol/server";

export type McpAllowedHostRules = {
    exactHosts: string[];
    wildcardSuffixes: string[];
    allowAnyHost: boolean;
};

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

function hostnameFromAuthority(value: string | undefined | null): string | null {
    if (!value) {
        return null;
    }
    try {
        return new URL(`http://${value}`).hostname.toLowerCase();
    } catch {
        return null;
    }
}

export function normalizeAllowedHostname(entry: string): string | null {
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed) {
        return null;
    }

    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

    try {
        const hostname = new URL(withScheme).hostname.toLowerCase();
        return hostname.length > 0 ? hostname : null;
    } catch {
        return null;
    }
}

function extraAllowedHostEntries(env: Env): string[] {
    if (!env.MCP_ALLOWED_HOSTS) {
        return [];
    }
    return env.MCP_ALLOWED_HOSTS.split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

export function resolveMcpAllowedHostRules(env: Env, request: Request): McpAllowedHostRules {
    const exactHosts = new Set<string>(localhostAllowedHostnames());
    const wildcardSuffixes = new Set<string>();
    let allowAnyHost = false;

    const configuredHost = hostnameOf(env.FRONTEND_URL);
    if (configuredHost) {
        exactHosts.add(configuredHost);
    }

    for (const entry of extraAllowedHostEntries(env)) {
        if (entry === "*") {
            allowAnyHost = true;
            continue;
        }

        const hostname = normalizeAllowedHostname(entry);
        if (!hostname) {
            continue;
        }

        if (hostname.startsWith("*.")) {
            wildcardSuffixes.add(hostname.slice(1));
            continue;
        }

        exactHosts.add(hostname);
    }

    const requestHost = hostnameOf(request.url);
    if (requestHost && requestHost.endsWith(".workers.dev")) {
        exactHosts.add(requestHost);
    }

    return {
        exactHosts: Array.from(exactHosts),
        wildcardSuffixes: Array.from(wildcardSuffixes),
        allowAnyHost,
    };
}

export function resolveMcpAllowedHosts(env: Env, request: Request): string[] {
    return resolveMcpAllowedHostRules(env, request).exactHosts;
}

function matchesWildcardSuffix(hostname: string, wildcardSuffixes: string[]): boolean {
    return wildcardSuffixes.some(
        (suffix) => hostname.endsWith(suffix) && hostname.length > suffix.length,
    );
}

function invalidHostResponse(hostname: string): Response {
    return Response.json({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: `Invalid Host: ${hostname}`,
            data: {
                hint: "Add the domain to MCP_ALLOWED_HOSTS (or FRONTEND_URL) and redeploy the worker.",
            },
        },
        id: null,
    }, {
        status: 403,
        headers: { "Content-Type": "application/json" },
    });
}

export function guardMcpRequest(request: Request, env: Env): Response | null {
    const rules = resolveMcpAllowedHostRules(env, request);
    const hostHeader = request.headers.get("host");
    const hostname = hostnameFromAuthority(hostHeader) ?? hostnameOf(request.url);

    if (!rules.allowAnyHost) {
        if (hostHeader) {
            const rejected = hostHeaderValidationResponse(request, rules.exactHosts);
            if (rejected && !(hostname && matchesWildcardSuffix(hostname, rules.wildcardSuffixes))) {
                return invalidHostResponse(hostname ?? hostHeader);
            }
        } else if (!hostname || !rules.exactHosts.includes(hostname)) {
            return invalidHostResponse(hostname ?? "");
        }

        const originRejected = originValidationResponse(request, rules.exactHosts);
        if (originRejected) {
            const originHostname = hostnameOf(request.headers.get("origin"));
            if (!(originHostname && matchesWildcardSuffix(originHostname, rules.wildcardSuffixes))) {
                return originRejected;
            }
        }
    }

    return null;
}
