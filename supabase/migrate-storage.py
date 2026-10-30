#!/usr/bin/env python3
"""Offline MinIO/pgsty -> Supabase v1.81.0 file-backend migration. No database writes.

Export runs with the old stack online and application writes stopped. Install
runs on Linux with the new Storage service stopped. See MIGRATION.md.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request


def objects(database):
    sql = "SELECT coalesce(json_agg(o ORDER BY bucket_id, name), '[]'::json) FROM storage.objects o"
    result = subprocess.run(
        ["docker", "exec", "supabase-db", "psql", "-U", "supabase_admin",
         "-d", database, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def download(url, obj):
    key = urllib.parse.quote(f"{obj['bucket_id']}/{obj['name']}", safe="/")
    token = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    request = urllib.request.Request(
        f"{url.rstrip('/')}/storage/v1/object/authenticated/{key}",
        headers={"apikey": token, "Authorization": f"Bearer {token}"},
    )
    return urllib.request.urlopen(request, timeout=120)


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def export(url, directory, database="postgres"):
    directory.mkdir(parents=True, exist_ok=False)
    original = objects(database)
    manifest = [dict(obj) for obj in original]
    for index, obj in enumerate(manifest):
        obj["file"] = f"{index:08d}.bin"
        target = directory / obj["file"]
        with download(url, obj) as response, target.open("wb") as output:
            content_length = response.headers.get("Content-Length")
            obj["content_type"] = response.headers.get("Content-Type", "application/octet-stream")
            obj["cache_control"] = response.headers.get("Cache-Control", "no-cache")
            shutil.copyfileobj(response, output)
        if content_length is not None and target.stat().st_size != int(content_length):
            raise ValueError("Downloaded object size differs from HTTP Content-Length")
        obj["sha256"] = digest(target)
        size = (obj.get("metadata") or {}).get("size")
        if size is not None and target.stat().st_size != int(size):
            raise ValueError("Downloaded object size differs from database metadata")
    if objects(database) != original:
        raise ValueError("Storage metadata changed during export; keep writes paused and export again")
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Exported {len(manifest)} objects")


def destination(root, bucket, tenant, obj):
    # These match v1.81.0's default location and withOptionalVersion helpers.
    parts = [bucket, tenant, obj["bucket_id"], *obj["name"].split("/")]
    if obj.get("version"):
        parts.append(obj["version"])
    if any(not part or part in (".", "..") or "/" in part or "\\" in part for part in parts):
        raise ValueError("Unsafe storage object path")
    target = root.joinpath(*parts)
    if not target.resolve().is_relative_to(root.resolve()):
        raise ValueError("Storage path escapes destination")
    return target


def validate_export(directory, root, bucket, tenant):
    manifest = json.loads((directory / "manifest.json").read_text())
    targets = set()
    # Validate the entire export before changing the destination.
    for index, obj in enumerate(manifest):
        if obj["file"] != f"{index:08d}.bin" or digest(directory / obj["file"]) != obj["sha256"]:
            raise ValueError("Export checksum mismatch")
        target = destination(root, bucket, tenant, obj)
        if target in targets:
            raise ValueError("Storage objects map to the same file path")
        targets.add(target)
        if target.exists() and digest(target) != obj["sha256"]:
            raise ValueError("Destination already contains different data")
    if any(parent in targets for target in targets for parent in target.parents):
        raise ValueError("Storage object paths conflict as files and directories; retain S3 storage")
    return manifest


def check(directory, bucket, tenant):
    with tempfile.TemporaryDirectory() as temporary:
        manifest = validate_export(directory, Path(temporary) / "storage", bucket, tenant)
    print(f"Checked {len(manifest)} objects for file-backend compatibility")


def install(directory, root, bucket, tenant):
    if not hasattr(os, "setxattr"):
        raise RuntimeError("Install requires Linux extended attributes; see MIGRATION.md")
    manifest = validate_export(directory, root, bucket, tenant)
    root.mkdir(parents=True, exist_ok=True)
    root.chmod(0o755)
    for obj in manifest:
        target = destination(root, bucket, tenant, obj)
        target.parent.mkdir(parents=True, exist_ok=True)
        # imgproxy runs as a different user; private backup umasks must not
        # prevent it from traversing the installed tree or reading payloads.
        for directory_path in [target.parent, *target.parent.parents]:
            if directory_path.is_relative_to(root):
                directory_path.chmod(0o755)
        # Publish only complete bytes and metadata; failed copies remain retryable.
        with tempfile.TemporaryDirectory(dir=target.parent, prefix=".revisit-migration-") as staging:
            payload = Path(staging) / "payload"
            shutil.copyfile(directory / obj["file"], payload)
            payload.chmod(0o644)
            # Storage reads HTTP metadata from Linux extended attributes.
            os.setxattr(payload, "user.supabase.content-type", obj["content_type"].encode())
            os.setxattr(payload, "user.supabase.cache-control", obj["cache_control"].encode())
            os.replace(payload, target)
    print(f"Installed {len(manifest)} objects; database metadata unchanged")


def verify(url, directory, database="postgres"):
    manifest = json.loads((directory / "manifest.json").read_text())
    current = objects(database)
    exported_columns = set(manifest[0]) - {"file", "sha256", "content_type", "cache_control"} if manifest else set()
    original = {obj["id"]: {key: obj[key] for key in exported_columns} for obj in manifest}
    retained = {obj["id"]: {key: obj.get(key) for key in exported_columns} for obj in current}
    if retained != original or len(current) != len(manifest):
        raise ValueError("Database object metadata changed; verify before reopening writes")
    for obj in manifest:
        hasher = hashlib.sha256()
        with download(url, obj) as response:
            if response.headers.get("Content-Type") != obj["content_type"]:
                raise ValueError("Object content type changed")
            if response.headers.get("Cache-Control") != obj["cache_control"]:
                raise ValueError("Object cache control changed")
            while chunk := response.read(1024 * 1024):
                hasher.update(chunk)
        if hasher.hexdigest() != obj["sha256"]:
            raise ValueError("Migrated object checksum mismatch")
    print(f"Verified {len(manifest)} objects and unchanged database metadata")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["export", "check", "install", "verify"])
    parser.add_argument("directory", type=Path)
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--database", default="postgres", help="POSTGRES_DB for export and verify")
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--bucket", default="stub", help="GLOBAL_S3_BUCKET, not the application bucket")
    parser.add_argument("--tenant", default="stub", help="STORAGE_TENANT_ID (previously TENANT_ID)")
    args = parser.parse_args()
    if args.operation == "check":
        check(args.directory, args.bucket, args.tenant)
    elif args.operation == "install":
        if args.destination is None:
            parser.error("install requires --destination")
        install(args.directory, args.destination, args.bucket, args.tenant)
    elif args.operation == "export":
        export(args.url, args.directory, args.database)
    else:
        verify(args.url, args.directory, args.database)


if __name__ == "__main__":
    main()
