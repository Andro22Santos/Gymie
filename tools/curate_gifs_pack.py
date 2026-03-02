import argparse
import shutil
from pathlib import Path


def collect_groups(root: Path):
    groups = []
    for group_dir in sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.name.lower()):
        files = [f for f in group_dir.rglob("*.gif") if f.is_file()]
        files.sort(key=lambda p: p.stat().st_size)
        if files:
            groups.append((group_dir, files))
    return groups


def select_files(groups, min_per_group, max_per_group, max_file_bytes):
    selected = {}
    for group_dir, files in groups:
        filtered = [f for f in files if f.stat().st_size <= max_file_bytes]
        if not filtered:
            filtered = files[:1]

        count = min(max_per_group, len(filtered))
        picked = filtered[:count]
        if len(picked) < min_per_group:
            extra_source = [f for f in files if f not in picked]
            need = min_per_group - len(picked)
            picked += extra_source[:need]
        selected[group_dir] = picked
    return selected


def total_bytes(selected):
    return sum(f.stat().st_size for files in selected.values() for f in files)


def trim_to_budget(selected, min_per_group, budget_bytes):
    while total_bytes(selected) > budget_bytes:
        candidates = []
        for group_dir, files in selected.items():
            if len(files) > min_per_group:
                largest = max(files, key=lambda p: p.stat().st_size)
                candidates.append((largest.stat().st_size, group_dir, largest))
        if not candidates:
            break
        candidates.sort(reverse=True, key=lambda x: x[0])
        _, group_dir, largest_file = candidates[0]
        selected[group_dir].remove(largest_file)
    return selected


def copy_selection(selected, src_root: Path, out_root: Path):
    shutil.rmtree(out_root, ignore_errors=True)
    copied = 0
    for group_dir, files in selected.items():
        for file_path in files:
            rel = file_path.relative_to(src_root)
            dst = out_root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, dst)
            copied += 1
    return copied


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", default="frontend/public/exercicios/gifs-pack-1000")
    parser.add_argument("--out", default="frontend/public/exercicios/gifs-pack-1000-lite")
    parser.add_argument("--min-per-group", type=int, default=10)
    parser.add_argument("--max-per-group", type=int, default=18)
    parser.add_argument("--max-file-mb", type=float, default=3.8)
    parser.add_argument("--max-total-mb", type=float, default=420)
    args = parser.parse_args()

    src_root = Path(args.src)
    out_root = Path(args.out)
    groups = collect_groups(src_root)

    selected = select_files(
        groups=groups,
        min_per_group=args.min_per_group,
        max_per_group=args.max_per_group,
        max_file_bytes=int(args.max_file_mb * 1024 * 1024),
    )
    selected = trim_to_budget(
        selected=selected,
        min_per_group=args.min_per_group,
        budget_bytes=int(args.max_total_mb * 1024 * 1024),
    )
    copied = copy_selection(selected, src_root, out_root)

    group_count = len(selected)
    total_mb = total_bytes(selected) / 1024 / 1024
    print(f"groups={group_count}")
    print(f"copied={copied}")
    print(f"total_mb={total_mb:.1f}")


if __name__ == "__main__":
    main()

