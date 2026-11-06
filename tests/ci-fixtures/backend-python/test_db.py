import os
import psycopg

def test_postgres_service():
    with psycopg.connect(os.environ["DATABASE_URL"]) as c:
        assert c.execute("select 2 * 21").fetchone()[0] == 42
