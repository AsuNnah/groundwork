"""Hidden checks for the stats case. FIXTURE points at the project the agent worked on."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.environ["FIXTURE"]


def run(args):
    return subprocess.run([sys.executable, os.path.join(ROOT, "stats.py"), *args], capture_output=True, text=True, timeout=60)


class Hidden(unittest.TestCase):
    def csv(self, text):
        f = tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False)
        f.write(text)
        f.close()
        self.addCleanup(os.unlink, f.name)
        return f.name

    def test_even_median_text(self):
        out = run([self.csv("v\n4\n1\n3\n2\n"), "--column", "v"])
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn("median: 2.50\n", out.stdout)

    def test_odd_median_unchanged(self):
        self.assertIn("median: 2.00\n", run([self.csv("v\n3\n1\n2\n"), "--column", "v"]).stdout)

    def test_text_output_unchanged(self):
        out = run([self.csv("name,price\na,1\nb,2\nc,6\n"), "--column", "price"])
        self.assertEqual(out.stdout, "count: 3\nmean: 3.00\nmedian: 2.00\nmin: 1.00\nmax: 6.00\n")

    def test_json(self):
        out = run([self.csv("v\n4\n1\n3\n2\n"), "--column", "v", "--json"])
        self.assertEqual(out.returncode, 0, out.stderr)
        data = json.loads(out.stdout)
        for key, want in {"count": 4, "mean": 2.5, "median": 2.5, "min": 1, "max": 4}.items():
            self.assertAlmostEqual(data[key], want, places=9, msg=key)

    def test_json_unrounded_and_skips_bad_cells(self):
        data = json.loads(run([self.csv("v\n1\n\nabc\n2\n2\n"), "--column", "v", "--json"]).stdout)
        self.assertEqual(data["count"], 3)
        self.assertAlmostEqual(data["mean"], 5 / 3, places=9)
        self.assertAlmostEqual(data["median"], 2, places=9)

    def test_json_errors_unchanged(self):
        out = run([self.csv("v\n1\n"), "--column", "w", "--json"])
        self.assertEqual(out.returncode, 1)
        self.assertIn("no column named", out.stderr)
        missing = run([os.path.join(ROOT, "no-such-file.csv"), "--column", "v", "--json"])
        self.assertEqual(missing.returncode, 1)
        self.assertIn("no such file", missing.stderr)


if __name__ == "__main__":
    unittest.main()
