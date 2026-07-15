// Cloudflare Pages Function: GET /api/auth
// Primer paso del login de Decap CMS: redirige a GitHub para que el usuario autorice la app OAuth.

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const clientId = env.GITHUB_OAUTH_CLIENT_ID;

    if (!clientId) {
        return new Response(
            "Falta configurar la variable de entorno GITHUB_OAUTH_CLIENT_ID en Cloudflare Pages.",
            { status: 500 }
        );
    }

    const state = crypto.randomUUID();
    const redirectUri = `${url.origin}/api/callback`;

    const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
    githubAuthUrl.searchParams.set("client_id", clientId);
    githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
    githubAuthUrl.searchParams.set("scope", "repo,user");
    githubAuthUrl.searchParams.set("state", state);

    const headers = new Headers();
    headers.set("Location", githubAuthUrl.toString());
    // Cookie de corta duración solo para verificar el "state" al volver en /api/callback (protección CSRF)
    headers.append(
        "Set-Cookie",
        `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    return new Response(null, { status: 302, headers });
}
