"""
A static sanity check over the migrations, for when there is no PostgreSQL to
execute them against.

It does NOT validate SQL. It checks the things most likely to be wrong in a
hand-written migration and hardest to spot by eye:

  - every VALUES tuple has as many items as its column list
  - dollar-quoted function bodies balance
  - each file has exactly one begin/commit pair

This exists because the machine this was written on has neither Docker nor psql,
so `supabase db push` is the first thing that will ever parse these files. A
column-count error found here costs nothing; found there it costs a failed
migration against the hosted project.
"""
import glob
import re
import sys


def strip_noise(sql: str) -> str:
    """Remove plpgsql bodies and line comments, so neither is scanned for tuples."""
    sql = re.sub(r"\$\$.*?\$\$", "$$BODY$$", sql, flags=re.S)
    return re.sub(r"--[^\n]*", "", sql)


def split_tuples(values_blob: str) -> list[str]:
    """Top-level parenthesised groups of a VALUES list."""
    out, depth, cur = [], 0, ""
    for ch in values_blob:
        if ch == "(":
            depth += 1
            if depth == 1:
                cur = ""
                continue
        elif ch == ")":
            depth -= 1
            if depth == 0:
                out.append(cur)
                continue
        if depth >= 1:
            cur += ch
    return out


def split_items(tup: str) -> list[str]:
    """Comma-separated items, ignoring commas inside quotes or nested calls."""
    out, depth, cur, quoted = [], 0, "", False
    for ch in tup:
        if ch == "'":
            quoted = not quoted
        if not quoted:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == "," and depth == 0:
                out.append(cur.strip())
                cur = ""
                continue
        cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def check(path: str) -> list[str]:
    raw = open(path).read()
    problems: list[str] = []

    if raw.count("$$") % 2 != 0:
        problems.append(f"odd number of $$ delimiters ({raw.count('$$')})")

    begins = len(re.findall(r"^begin;", raw, flags=re.M))
    commits = len(re.findall(r"^commit;", raw, flags=re.M))
    if begins != 1 or commits != 1:
        problems.append(f"expected one begin;/commit; pair, found {begins}/{commits}")

    sql = strip_noise(raw)
    for match in re.finditer(
        r"insert into\s+([\w.]+)\s*\(([^)]*?)\)\s*values\s*(.*?);", sql, flags=re.S | re.I
    ):
        table, colblob, valblob = match.group(1), match.group(2), match.group(3)
        # The VALUES list ends at ON CONFLICT; its (column) groups are not tuples.
        valblob = re.split(r"\bon\s+conflict\b", valblob, flags=re.I)[0]
        cols = split_items(colblob)
        tuples = split_tuples(valblob)
        if not tuples:
            continue
        for index, tup in enumerate(tuples, start=1):
            items = split_items(tup)
            if len(items) != len(cols):
                problems.append(
                    f"{table}: tuple {index} has {len(items)} values, column list has {len(cols)}"
                )
        print(f"    {table:38} {len(cols)} cols x {len(tuples)} rows")

    return problems


def main() -> int:
    files = sorted(glob.glob("supabase/migrations/*.sql"))
    if not files:
        print("no migrations found")
        return 1

    failed = False
    for path in files:
        print(f"\n  {path.split('/')[-1]}")
        problems = check(path)
        if problems:
            failed = True
            for problem in problems:
                print(f"    PROBLEM: {problem}")

    print("\n  static checks failed\n" if failed else "\n  static checks passed\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
