// Cloudflare Pages Function: GET /api/callback
// Segundo paso del login: GitHub vuelve acá con un "code". Lo cambiamos por un
// access_token y se lo devolvemos a la ventana de Decap CMS que abrió el popup,
// usando el protocolo de postMessage que Decap CMS espera del backend "github".

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/oauth_state=([^;]+)/);
    const expectedState = match ? match[1] : null;

    if (!code || !state || !expectedState || state !== expectedState) {
        return htmlResponse(
            renderPostMessagePage("error", {
                message: "Estado OAuth inválido o faltante. Intentá iniciar sesión de nuevo.",
            }),
            400
        );
    }

    const clientId = env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return htmlResponse(
            renderPostMessagePage("error", {
                message:
                    "Falta configurar GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET en Cloudflare Pages.",
            }),
            500
        );
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: `${url.origin}/api/callback`,
        }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
        const message =
            (tokenData && (tokenData.error_description || tokenData.error)) ||
            "No se pudo obtener el token de acceso de GitHub.";
        return htmlResponse(renderPostMessagePage("error", { message }), 400);
    }

    const headers = new Headers({ "Content-Type": "text/html" });
    // Limpiar la cookie de state, ya cumplió su función
    headers.append("Set-Cookie", "oauth_state=; Path=/; Max-Age=0");

    return new Response(
        renderPostMessagePage("success", {
            token: tokenData.access_token,
            provider: "github",
        }),
        { status: 200, headers }
    );
}

function htmlResponse(body, status) {
    return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}

// Boilerplate estándar que Decap CMS espera recibir del popup de OAuth:
// el popup escucha un primer mensaje del opener y responde con el token (o error).
function renderPostMessagePage(status, payload) {
    const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
    return `<!DOCTYPE html>
<html>
<body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      ${JSON.stringify(message)},
      e.origin
    );
    window.removeEventListener("message", receiveMessage, false);
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>
</body>
</html>`;
}
