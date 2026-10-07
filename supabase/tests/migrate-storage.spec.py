import hashlib
import json
import os
from io import BytesIO
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch


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
        attributes.assert_any_call(result, "user.supabase.content-type", b"application/json")
        attributes.assert_any_call(result, "user.supabase.cache-control", b"max-age=3600")

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
