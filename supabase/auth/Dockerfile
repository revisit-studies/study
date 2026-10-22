# Keep the Auth binary and migrations at v2.171.0 while refreshing TLS trust.
FROM supabase/gotrue:v2.171.0@sha256:884f1a203a6a999251492d3d7092a4077b714ef210650a85f338a84385093ea4

USER root
# Older CA packages still trust chains affected by the eMudhra compromise.
RUN apk add --no-cache --upgrade \
    'ca-certificates>=20261020-r0' \
    'ca-certificates-bundle>=20261020-r0'
USER supabase
