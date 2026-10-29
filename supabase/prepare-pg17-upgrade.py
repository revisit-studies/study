#!/usr/bin/env python3
"""Prepare the pinned upstream upgrade script for this deployment's saved overrides."""
import argparse
from pathlib import Path


VOLUME_SELECTION = '''db_config_vol=$(docker volume ls --filter "name=db-config" --format '{{.Name}}' \\
        | grep -E '^db-config$|_db-config$' | head -n 1)'''
CONTAINER_VOLUME = '''db_config_vol=$(docker inspect "$DB_CONTAINER" --format \\
        '{{range .Mounts}}{{if eq .Destination "/etc/postgresql-custom"}}{{.Name}}{{end}}{{end}}')'''
STARTUP = 'docker compose -f docker-compose.yml -f docker-compose.pg17.yml up -d'
FAILED_MIGRATION = '|| warn "  $m failed (non-fatal)"'


def prepare(source, target):
    if source.resolve() == target.resolve():
        raise ValueError("Keep the original upstream script unchanged")
    text = source.read_text()
    # Fail before writing if a different upstream release changes any assumption.
    for old, new in ((f"    {VOLUME_SELECTION}\n", f"    {CONTAINER_VOLUME}\n"),
                     (f"    {STARTUP}\n", "    docker compose up -d\n"),
                     (FAILED_MIGRATION, '|| die "Required migration $m failed; keep writes blocked"')):
        if text.count(old) != 1:
            raise ValueError("Unexpected upstream upgrade script; review this release before upgrading")
        text = text.replace(old, new)
    target.write_text(text)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    prepare(args.source, args.target)
