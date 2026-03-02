import argparse
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote


GROUP_MAP = {
    "123 gifs de calistenia": "Calistenia",
    "67 gifs de crossfit": "Crossfit",
    "alongamentos e mobilidade": "Mobilidade",
    "abdominal": "Abdominais",
    "antebraco": "Antebraco",
    "biceps": "Biceps",
    "cardio": "Cardio",
    "costas": "Costas",
    "eretores da espinha": "Lombar",
    "gluteos": "Gluteos",
    "membros inferiores 53": "Membros Inferiores",
    "ombros": "Ombros",
    "panturrilhas": "Panturrilhas",
    "peitoral": "Peitoral",
    "pernas": "Pernas",
    "trapezio": "Trapezio",
    "triceps": "Triceps",
}

BEGINNER_GROUPS = {"Cardio", "Mobilidade", "Abdominais", "Panturrilhas"}


def normalize(text: str) -> str:
    txt = unicodedata.normalize("NFKD", text)
    txt = "".join(ch for ch in txt if not unicodedata.combining(ch))
    txt = re.sub(r"[^a-zA-Z0-9 ]+", " ", txt).strip().lower()
    return re.sub(r"\s+", " ", txt)


def clean_name(stem: str) -> str:
    name = stem.replace("_", " ").strip()
    name = re.sub(r"\s+\d+$", "", name)
    name = re.sub(r"\s+", " ", name)
    return name


def to_web_path(file_path: Path) -> str:
    rel = file_path.relative_to("frontend/public").as_posix()
    return "/" + quote(rel, safe="/-_.()")


def build_data(root: Path, source_name: str):
    entries = {}

    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".gif", ".png"}:
            continue
        if len(p.parts) < 2:
            continue

        raw_group = p.parts[-2]
        mapped_group = GROUP_MAP.get(normalize(raw_group), raw_group)
        difficulty = "Iniciante" if mapped_group in BEGINNER_GROUPS else "Intermediario"

        name = clean_name(p.stem)
        if re.fullmatch(r"\d+", name):
            name = f"{mapped_group} {name}"

        key = f"{normalize(name)}|{normalize(mapped_group)}"
        gif_path = to_web_path(p)

        if key not in entries:
            entries[key] = {
                "name": name,
                "group": mapped_group,
                "difficulty": difficulty,
                "instructions": [],
                "tips": [],
                "gifs": [gif_path],
                "source": source_name,
            }
        elif gif_path not in entries[key]["gifs"]:
            entries[key]["gifs"].append(gif_path)

    return sorted(entries.values(), key=lambda x: (x["group"], x["name"]))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default="frontend/public/exercicios/gifs-pack-1000-lite",
        help="Directory containing gif files grouped in folders.",
    )
    parser.add_argument(
        "--out",
        default="frontend/src/data/exercisePack1000.js",
        help="Output JS file path.",
    )
    parser.add_argument(
        "--var-name",
        default="exercisePack1000",
        help="JavaScript variable name.",
    )
    parser.add_argument(
        "--source",
        default="pack1000",
        help="Value for the source field.",
    )
    args = parser.parse_args()

    root = Path(args.root)
    out_file = Path(args.out)
    data = build_data(root, args.source)
    content = f"const {args.var_name} = " + json.dumps(data, ensure_ascii=True, indent=2) + f";\n\nexport default {args.var_name};\n"
    out_file.write_text(content, encoding="utf-8")
    print(f"generated={len(data)}")


if __name__ == "__main__":
    main()

