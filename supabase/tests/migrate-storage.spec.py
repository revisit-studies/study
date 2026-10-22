import hashlib
import json
import os
from io import BytesIO
from pathlib import Path
import runpy
import shutil
import tempfile
import unittest
from unittest.mock import Mock, patch


migration = runpy.run_path(str(Path(__file__).parents[1] / "migrate-storage.py"))


class StorageMigrationTests(unittest.TestCase):
    def setUp(self):
        attributes = patch("os.setxattr", create=True)
        attributes.start()
        self.addCleanup(attributes.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.export = Path(self.temp.name) / "export"
        self.export.mkdir()
        self.target = Path(self.temp.name) / "storage"
        data = b"existing participant data"
        (self.export / "00000000.bin").write_bytes(data)
        self.obj = {"bucket_id": "revisit", "name": "study/participant data.json",
                    "version": "existing-version", "file": "00000000.bin",
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "content_type": "application/json", "cache_control": "max-age=3600"}

    def manifest(self, objects):
        (self.export / "manifest.json").write_text(json.dumps(objects))

    def test_export_and_verify_query_the_selected_database(self):
        directory = self.export / "empty"
        with patch("subprocess.run") as query:
            query.return_value.stdout = "[]"
            for operation in ("export", "verify"):
                with patch("sys.argv", ["migrate-storage.py", operation, str(directory),
                                        "--database", "study_database"]):
                    migration["main"]()
                command = query.call_args.args[0]
                self.assertEqual(command[command.index("-d") + 1], "study_database")

    def test_preserves_versioned_layout_and_http_metadata(self):
        self.manifest([self.obj])
        with patch("os.setxattr", create=True) as attributes:
            migration["install"](self.export, self.target, "stub", "stub")
        result = self.target / "stub/stub/revisit/study/participant data.json/existing-version"
        self.assertEqual(result.read_bytes(), b"existing participant data")
        self.assertEqual({call.args[1]: call.args[2] for call in attributes.call_args_list}, {
            "user.supabase.content-type": b"application/json",
            "user.supabase.cache-control": b"max-age=3600",
        })

    def test_interrupted_copy_preserves_destination_and_can_be_retried(self):
        self.manifest([self.obj])

        def interrupted_copy(source, target):
            Path(target).write_bytes(b"partial copy")
            raise OSError("copy interrupted")

        for existing in (False, True):
            with self.subTest(existing=existing):
                root = self.target / str(existing)
                target = migration["destination"](root, "stub", "stub", self.obj)
                if existing:
                    target.parent.mkdir(parents=True)
                    shutil.copyfile(self.export / self.obj["file"], target)
                with patch("shutil.copyfile", side_effect=interrupted_copy):
                    with self.assertRaisesRegex(OSError, "copy interrupted"):
                        migration["install"](self.export, root, "stub", "stub")
                if existing:
                    self.assertEqual(target.read_bytes(), b"existing participant data")
                else:
                    self.assertFalse(target.exists())
                migration["install"](self.export, root, "stub", "stub")
                self.assertEqual(target.read_bytes(), b"existing participant data")

    def test_installed_files_are_readable_by_imgproxy_with_private_backup_umask(self):
        self.manifest([self.obj])
        self.target.mkdir(mode=0o700)
        previous = os.umask(0o077)
        try:
            migration["install"](self.export, self.target, "stub", "stub")
        finally:
            os.umask(previous)
        result = migration["destination"](self.target, "stub", "stub", self.obj)
        self.assertEqual(result.stat().st_mode & 0o777, 0o644)
        for directory in result.parents:
            if directory.is_relative_to(self.target):
                self.assertEqual(directory.stat().st_mode & 0o777, 0o755)

    def test_empty_export_prepares_readable_storage_root(self):
        self.manifest([])
        self.target.mkdir(mode=0o700)
        previous = os.umask(0o077)
        try:
            migration["install"](self.export, self.target, "stub", "stub")
        finally:
            os.umask(previous)
        self.assertEqual(self.target.stat().st_mode & 0o777, 0o755)

    def test_corruption_is_rejected_before_installing_any_object(self):
        self.manifest([self.obj, {**self.obj, "file": "00000001.bin"}])
        (self.export / "00000001.bin").write_bytes(b"corrupted")
        with self.assertRaisesRegex(ValueError, "checksum"):
            migration["install"](self.export, self.target, "stub", "stub")
        self.assertFalse(self.target.exists())

    def test_verify_ignores_row_order_but_rejects_changed_metadata(self):
        objects = [{**self.obj, "id": "first"},
                   {**self.obj, "id": "second", "name": "another object"}]
        self.manifest(objects)

        def download(url, obj):
            response = BytesIO(b"existing participant data")
            response.headers = {"Content-Type": obj["content_type"],
                                "Cache-Control": obj["cache_control"]}
            return response

        with patch.dict(migration["verify"].__globals__,
                        objects=lambda database: list(reversed(objects)), download=download):
            migration["verify"]("http://example.test", self.export)
        changed = [{**objects[0], "version": "changed"}, objects[1]]
        with patch.dict(migration["verify"].__globals__, objects=lambda database: changed):
            with self.assertRaisesRegex(ValueError, "metadata changed"):
                migration["verify"]("http://example.test", self.export)

    def test_file_directory_collisions_fail_before_installing_any_payload(self):
        second = {**self.obj, "file": "00000001.bin",
                  "name": "study/participant data.json/existing-version/child"}
        (self.export / second["file"]).write_bytes(b"existing participant data")
        self.manifest([self.obj, second])
        with self.assertRaisesRegex(ValueError, "conflict as files"):
            migration["install"](self.export, self.target, "stub", "stub")
        self.assertFalse(self.target.exists())
        with self.assertRaisesRegex(ValueError, "conflict as files"):
            migration["check"](self.export, "stub", "stub")

    def test_duplicate_paths_and_missing_exports_fail_before_install(self):
        for second in ({**self.obj, "file": "00000001.bin"},
                       {**self.obj, "file": "00000001.bin", "name": "different"}):
            with self.subTest(name=second["name"]):
                self.manifest([self.obj, second])
                if second["name"] == self.obj["name"]:
                    (self.export / second["file"]).write_bytes(b"existing participant data")
                    with self.assertRaisesRegex(ValueError, "same file path"):
                        migration["install"](self.export, self.target, "stub", "stub")
                    (self.export / second["file"]).unlink()
                else:
                    with self.assertRaises(FileNotFoundError):
                        migration["install"](self.export, self.target, "stub", "stub")
                self.assertFalse(self.target.exists())

    def test_symlink_escape_is_rejected_without_writing_outside_storage(self):
        self.manifest([self.obj])
        self.target.mkdir()
        outside = Path(self.temp.name) / "outside"
        outside.mkdir()
        (self.target / "stub").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "escapes destination"):
            migration["install"](self.export, self.target, "stub", "stub")
        self.assertEqual(list(outside.iterdir()), [])

    def test_metadata_failure_keeps_payload_unpublished_and_allows_retry(self):
        self.manifest([self.obj])
        with patch("os.setxattr", side_effect=OSError("extended attributes unavailable")):
            with self.assertRaisesRegex(OSError, "extended attributes"):
                migration["install"](self.export, self.target, "stub", "stub")
        target = migration["destination"](self.target, "stub", "stub", self.obj)
        self.assertFalse(target.exists())
        self.assertFalse(list(self.target.rglob(".revisit-migration-*")))
        migration["install"](self.export, self.target, "stub", "stub")
        self.assertEqual(target.read_bytes(), b"existing participant data")

    def test_concurrent_writes_and_interrupted_export_never_publish_a_manifest(self):
        def response(url, obj):
            stream = BytesIO(b"existing participant data")
            stream.headers = {"Content-Type": "application/json", "Cache-Control": "max-age=3600"}
            return stream

        original = [{"id": "original", "bucket_id": "revisit", "name": "recording",
                     "metadata": {"size": len(b"existing participant data")}}]
        directory = self.export / "incomplete"
        with patch.dict(migration["export"].__globals__, download=response,
                        objects=Mock(side_effect=[original, [{**original[0], "version": "new"}]])):
            with self.assertRaisesRegex(ValueError, "metadata changed during export"):
                migration["export"]("http://example.test", directory)
        self.assertFalse((directory / "manifest.json").exists())
        with self.assertRaises(FileExistsError):
            migration["export"]("http://example.test", directory)
        for failure in (OSError("connection interrupted"), ValueError("size differs")):
            directory = directory.with_name(directory.name + "-retry")
            with patch.dict(migration["export"].__globals__, objects=lambda database: original,
                            download=Mock(side_effect=failure)):
                with self.assertRaises(type(failure)):
                    migration["export"]("http://example.test", directory)
            self.assertFalse((directory / "manifest.json").exists())

    def test_truncated_http_response_without_database_size_never_completes_export(self):
        stream = BytesIO(b"partial")
        stream.headers = {"Content-Length": "100"}
        directory = self.export / "truncated"
        obj = {"id": "legacy", "bucket_id": "revisit", "name": "legacy", "metadata": None}
        with patch.dict(migration["export"].__globals__, objects=lambda database: [obj],
                        download=lambda url, item: stream):
            with self.assertRaisesRegex(ValueError, "Content-Length"):
                migration["export"]("http://example.test", directory)
        self.assertFalse((directory / "manifest.json").exists())

    def test_verify_rejects_wrong_bytes_headers_and_added_objects(self):
        obj = {**self.obj, "id": "existing"}
        self.manifest([obj])
        for body, content_type, cache in ((b"corrupted", obj["content_type"], obj["cache_control"]),
                                          (b"existing participant data", "text/plain", obj["cache_control"]),
                                          (b"existing participant data", obj["content_type"], "no-cache")):
            stream = BytesIO(body)
            stream.headers = {"Content-Type": content_type, "Cache-Control": cache}
            with patch.dict(migration["verify"].__globals__, objects=lambda database: [obj],
                            download=lambda url, item: stream):
                with self.assertRaises(ValueError):
                    migration["verify"]("http://example.test", self.export)
        with patch.dict(migration["verify"].__globals__,
                        objects=lambda database: [obj, {**obj, "id": "new"}]):
            with self.assertRaisesRegex(ValueError, "metadata changed"):
                migration["verify"]("http://example.test", self.export)

    def test_rejects_traversal_and_conflicting_destination(self):
        self.manifest([{**self.obj, "name": "../outside"}])
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            migration["install"](self.export, self.target, "stub", "stub")
        self.manifest([self.obj])
        result = migration["destination"](self.target, "stub", "stub", self.obj)
        result.parent.mkdir(parents=True)
        result.write_bytes(b"other data")
        with self.assertRaisesRegex(ValueError, "different data"):
            migration["install"](self.export, self.target, "stub", "stub")
        self.assertEqual(result.read_bytes(), b"other data")


if __name__ == "__main__":
    unittest.main()
