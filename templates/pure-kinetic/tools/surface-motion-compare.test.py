"""Source identity guards; no codecs, renders or production artifacts needed."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("surface-motion-compare.py")
SPEC = importlib.util.spec_from_file_location("surface_motion_compare", SCRIPT)
COMPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPARE)


class SourceIdentityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.originals = [self.root / f"{version}-{tag}.mp4"
                          for tag in ("9x16", "1x1", "16x9") for version in ("before", "after")]
        for path in self.originals:
            path.write_bytes(f"render bytes for {path.name}".encode())
        self.receipt = self.root / "render-source.json"
        self.data = {
            "sourceHashes": {"before": "a" * 64, "after": "b" * 64},
            "beforeRevision": "previous-release", "afterRevision": "new-render-snapshot",
            "files": {path.name: {"sha256": COMPARE.sha256(path)} for path in self.originals},
        }
        self.receipt.write_text(json.dumps(self.data))

    def test_cli_requires_explicit_receipt_before_any_media_work(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--media-dir", str(self.root)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn("--source-receipt", result.stderr)
        self.assertFalse((self.root / "media-integrity.json").exists())

    def test_old_receipt_rejects_a_replaced_render(self):
        self.originals[1].write_bytes(b"new render, same filename")
        with self.assertRaisesRegex(ValueError, "after-9x16.mp4: source receipt media hash mismatch"):
            COMPARE.load_source_identity(self.receipt, self.originals)

    def test_unbound_media_cannot_inherit_source_identity(self):
        del self.data["files"]["after-16x9.mp4"]
        self.receipt.write_text(json.dumps(self.data))
        with self.assertRaisesRegex(ValueError, "missing SHA256 binding for after-16x9.mp4"):
            COMPARE.load_source_identity(self.receipt, self.originals)

    def test_matching_new_receipt_preserves_new_sources_and_revisions(self):
        identity = COMPARE.load_source_identity(self.receipt, self.originals)
        self.assertEqual(identity["sourceHashes"], self.data["sourceHashes"])
        self.assertEqual(identity["sourceRevisions"], {"before": "previous-release", "after": "new-render-snapshot"})
        self.assertEqual(identity["sourceReceiptSha256"], COMPARE.sha256(self.receipt))
        self.assertTrue(identity["originalMediaHashesVerified"])


if __name__ == "__main__":
    unittest.main()
