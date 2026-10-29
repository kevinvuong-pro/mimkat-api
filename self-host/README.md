# Mimkat API self-hosting

This directory is intentionally independent from the local development Compose
configuration in the repository root.

## Deploy with Docker and Traefik

1. Create the shared Traefik network once on the VPS:

   ```bash
   docker network create proxy
   ```

2. Copy the environment template and replace every placeholder:

   ```bash
   cp self-host/.env.example self-host/.env.production
   ```

3. Start the API, PostgreSQL, and Redis:

   ```bash
   docker compose --env-file self-host/.env.production \
     -f self-host/compose.yml up -d --build
   ```

The API is exposed only through Traefik at `https://$API_HOST`; PostgreSQL and
Redis are not published to the VPS. Configure the Cloudflare DNS record for
`API_HOST` to the VPS and choose `Full (strict)` TLS mode.

`TRAEFIK_CERTRESOLVER` must exactly match a certificate resolver configured in
Traefik. The default assumes an ACME resolver named `letsencrypt`. If the VPS
uses a Cloudflare Origin Certificate instead, install that certificate and key
in Traefik's static/dynamic configuration and remove the `tls.certresolver`
label from this Compose file (and the equivalent label in the frontend
Compose files); `tls=true` must remain enabled.

## Coolify

Create a separate Compose-based resource for this repository, set the Compose
file to `self-host/compose.yml`, and add the variables from `.env.example` as
Coolify environment variables/secrets. The Compose file passes those values
directly through `environment`, so Coolify does not need a
`self-host/.env.production` file. The external `proxy` network and the Traefik
labels assume that Coolify's Traefik is attached to that network. Do not reuse
the development database credentials.

The container runs `prisma migrate deploy` before starting the API. A failed
migration fails the container startup instead of serving an inconsistent schema.
