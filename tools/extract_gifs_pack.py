import re
import zipfile
from pathlib import Path


ZIP_PATH = Path(r"D:\Gymie\1000_GIFS_DE_TREINO.zip")
OUT_DIR = Path("frontend/public/exercicios/gifs-pack-1000")
ROOT_PREFIX = "+1000 GIFS DE TREINO/"
INVALID_CHARS = re.compile(r'[<>:"/\\|?*]')


def sanitize_part(part: str) -> str:
    safe = INVALID_CHARS.sub("_", part).strip().rstrip(".")
    return safe or "item"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    seen = set()
    extracted = 0

    with zipfile.ZipFile(ZIP_PATH) as zf:
        for info in zf.infolist():
            name = info.filename
            if not name.startswith(ROOT_PREFIX) or name.endswith("/"):
                continue

            rel = name[len(ROOT_PREFIX):]
            raw_parts = [p for p in rel.split("/") if p]
            parts = [sanitize_part(p) for p in raw_parts]
            if not parts:
                continue

            target_dir = OUT_DIR
            for p in parts[:-1]:
                target_dir = target_dir / p
            target_dir.mkdir(parents=True, exist_ok=True)

            filename = parts[-1]
            dot = filename.rfind(".")
            if dot > 0:
                stem = filename[:dot]
                ext = filename[dot:]
            else:
                stem = filename
                ext = ""

            target = target_dir / filename
            idx = 1
            while str(target).lower() in seen or target.exists():
                target = target_dir / f"{stem}_{idx}{ext}"
                idx += 1

            with zf.open(info) as src, target.open("wb") as dst:
                dst.write(src.read())

            seen.add(str(target).lower())
            extracted += 1

    print(f"extracted={extracted}")


if __name__ == "__main__":
    main()

