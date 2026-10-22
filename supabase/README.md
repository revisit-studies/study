# Bundled Supabase Auth

Auth is built locally from the pinned upstream v2.171.0 image with updated Alpine
CA packages. This preserves the Auth binary and migrations while removing trust
in certificate chains affected by the [eMudhra compromise](https://emudhra.we-have-a-problem.com/).
Both CA packages require version `20261020-r0` or newer; the build fails if the
configured Alpine repositories cannot provide them.

For an existing deployment, run these commands from `supabase/` after updating
the checkout:

```sh
docker compose build --pull --no-cache auth
docker compose up -d --no-deps --force-recreate auth
```

Rebuilding and recreating Auth is required; restarting the existing container
does not refresh its certificates. Verify GitHub sign-in after recreation.
This change covers the bundled Auth service's outbound TLS trust, including
GitHub OAuth. Other services and custom certificate mounts need separate review.
