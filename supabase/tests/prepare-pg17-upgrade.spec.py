import runpy
from pathlib import Path
import tempfile
import unittest


helper = runpy.run_path(str(Path(__file__).parents[1] / "prepare-pg17-upgrade.py"))


class PrepareUpgradeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "upstream.sh"
        self.target = Path(self.temp.name) / "prepared.sh"
        self.original = (f"    {helper['VOLUME_SELECTION']}\n"
                         f"    {helper['STARTUP']}\n"
                         f"    psql -f migration.sql {helper['FAILED_MIGRATION']}\n")
        self.source.write_text(self.original)

    def test_preserves_source_selects_actual_volume_and_applies_saved_overrides(self):
        helper["prepare"](self.source, self.target)
        self.assertEqual(self.source.read_text(), self.original)
        prepared = self.target.read_text()
        self.assertIn(helper["CONTAINER_VOLUME"], prepared)
        self.assertIn("    docker compose up -d\n", prepared)
        self.assertNotIn('|| warn', prepared)
        self.assertIn('|| die "Required migration $m failed; keep writes blocked"', prepared)

    def test_unknown_or_duplicated_upstream_commands_do_not_write_output(self):
        for changed in (self.original.replace(helper["STARTUP"], "different command"),
                        self.original + f"    {helper['VOLUME_SELECTION']}\n"):
            with self.subTest(changed=changed):
                self.source.write_text(changed)
                with self.assertRaisesRegex(ValueError, "Unexpected upstream"):
                    helper["prepare"](self.source, self.target)
                self.assertFalse(self.target.exists())

    def test_rejects_overwriting_upstream_source(self):
        with self.assertRaisesRegex(ValueError, "original upstream"):
            helper["prepare"](self.source, self.source)
        self.assertEqual(self.source.read_text(), self.original)


if __name__ == "__main__":
    unittest.main()
