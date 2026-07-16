import { handleAuth } from "./oauth-auth.js";
import { handleCallback } from "./oauth-callback.js";

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === "/api/auth") {
            return handleAuth(request, env);
        }
        if (url.pathname === "/api/callback") {
            return handleCallback(request, env);
        }

        // Todo lo demás (index.html, css/, js/, admin/, assets/, data/products.json)
        // lo sirve el sitio estático de catalogo/
        return env.ASSETS.fetch(request);
    },
};
