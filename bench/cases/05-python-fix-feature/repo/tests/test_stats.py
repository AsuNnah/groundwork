import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import stats  # noqa: E402


def run(args):
    return subprocess.run([sys.executable, os.path.join(ROOT, "stats.py"), *args], capture_output=True, text=True)


class StatsTest(unittest.TestCase):
    def write(self, text):
        f = tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False)
        f.write(text)
        f.close()
        self.addCleanup(os.unlink, f.name)
        return f.name

    def test_summary_of_odd_count(self):
        s = stats.summarize([3.0, 1.0, 2.0])
        self.assertEqual(s["median"], 2.0)
        self.assertEqual(s["count"], 3)

    def test_text_output(self):
        out = run([self.write("name,price\na,1\nb,2\nc,6\n"), "--column", "price"])
        self.assertEqual(out.returncode, 0)
        self.assertEqual(out.stdout, "count: 3\nmean: 3.00\nmedian: 2.00\nmin: 1.00\nmax: 6.00\n")

    def test_skips_empty_and_text_cells(self):
        self.assertEqual(stats.read_column(self.write("price\n1\n\nabc\n5\n"), "price"), [1.0, 5.0])

    def test_unknown_column(self):
        out = run([self.write("price\n1\n"), "--column", "cost"])
        self.assertEqual(out.returncode, 1)
        self.assertIn("no column named", out.stderr)


if __name__ == "__main__":
    unittest.main()
