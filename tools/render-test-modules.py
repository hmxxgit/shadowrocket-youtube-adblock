"""Render controlled A-E Shadowrocket modules from the checked-in release module."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "youtube-adblock.module"

TESTS = {
    "A": (
        "youtube-test-a-baseline.module",
        "YT Test A - Baseline",
        "Controlled experiment A; exact active production behavior.",
    ),
    "B": (
        "youtube-test-b-no-feed.module",
        "YT Test B - No Feed Script",
        "Controlled experiment B; browse/search response script excluded.",
    ),
    "C": (
        "youtube-test-c-no-udp.module",
        "YT Test C - No UDP Block",
        "Controlled experiment C; module UDP rejection rules removed.",
    ),
    "D": (
        "youtube-test-d-no-rewrite.module",
        "YT Test D - No Rewrite",
        "Controlled experiment D; URL Rewrite section removed.",
    ),
    "E": (
        "youtube-test-e-no-script.module",
        "YT Test E - No Response Script",
        "Controlled experiment E; YouTube response script disabled.",
    ),
}

UDP_RULES = (
    "AND,((DOMAIN-SUFFIX,googlevideo.com), (PROTOCOL,UDP)),REJECT",
    "AND,((DOMAIN,youtubei.googleapis.com), (PROTOCOL,UDP)),REJECT",
)
FULL_ENDPOINTS = r"(browse|next|player|search|reel\/reel_watch_sequence|guide|account\/get_setting|get_watch)"
NO_FEED_ENDPOINTS = r"(next|player|reel\/reel_watch_sequence|guide|account\/get_setting|get_watch)"


def replace_once(text: str, old: str, new: str, description: str) -> str:
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Expected one {description}, found {count}")
    return text.replace(old, new, 1)


def metadata(text: str, name: str, description: str) -> str:
    text, name_count = re.subn(r"(?m)^#!name=.*$", "#!name=" + name, text, count=1)
    text, desc_count = re.subn(r"(?m)^#!desc=.*$", "#!desc=" + description, text, count=1)
    if name_count != 1 or desc_count != 1:
        raise ValueError("Production module is missing a name or description header")
    return text


def normalize_metadata(text: str, production: str) -> str:
    name = re.search(r"(?m)^#!name=(.*)$", production)
    description = re.search(r"(?m)^#!desc=(.*)$", production)
    if not name or not description:
        raise ValueError("Production module is missing a name or description header")
    return metadata(text, name.group(1), description.group(1))


def remove_udp_rules(text: str) -> str:
    for rule in UDP_RULES:
        text = replace_once(text, rule + "\n", "", "UDP rule")
    return text


def remove_section(text: str, section: str, next_section: str) -> str:
    pattern = rf"(?ms)^\[{re.escape(section)}\]\n.*?(?=^\[{re.escape(next_section)}\]\n)"
    updated, count = re.subn(pattern, "", text, count=1)
    if count != 1:
        raise ValueError(f"Could not remove [{section}] section")
    return updated


def make_variants(production: str) -> dict[str, str]:
    variants = {}
    for key, (_, name, description) in TESTS.items():
        variants[key] = metadata(production, name, description)

    variants["B"] = replace_once(
        variants["B"],
        "pattern=^https:\\/\\/youtubei\\.googleapis\\.com\\/youtubei\\/v1\\/" + FULL_ENDPOINTS + ",requires-body=1",
        "pattern=^https:\\/\\/youtubei\\.googleapis\\.com\\/youtubei\\/v1\\/" + NO_FEED_ENDPOINTS + ",requires-body=1",
        "browse/search response script endpoint branch",
    )
    variants["C"] = remove_udp_rules(variants["C"])
    variants["D"] = remove_section(variants["D"], "URL Rewrite", "Script")
    variants["E"] = remove_section(variants["E"], "Script", "MITM")
    return variants


def validate(production: str, variants: dict[str, str]) -> None:
    normalized_a = normalize_metadata(variants["A"], production)
    for key, (_, name, description) in TESTS.items():
        normalized = normalize_metadata(variants[key], production)
        if key == "A":
            if normalized != production:
                raise ValueError("A changes production content beyond name/description")
        elif key == "B":
            expected = replace_once(normalized_a, FULL_ENDPOINTS, NO_FEED_ENDPOINTS, "baseline endpoint branch")
            if normalized != expected:
                raise ValueError("B changes content beyond browse/search response script matching")
        elif key == "C":
            if remove_udp_rules(normalized_a) != normalized:
                raise ValueError("C changes content beyond the two UDP rules")
        elif key == "D":
            if remove_section(normalized_a, "URL Rewrite", "Script") != normalized:
                raise ValueError("D changes content beyond URL Rewrite")
        elif key == "E":
            if remove_section(normalized_a, "Script", "MITM") != normalized:
                raise ValueError("E changes content beyond the response Script section")
        if not name or not description:
            raise ValueError(f"Missing test metadata for {key}")


def main() -> None:
    production = SOURCE.read_text()
    variants = make_variants(production)
    validate(production, variants)
    for key, (filename, _, _) in TESTS.items():
        (ROOT / filename).write_text(variants[key])
        print(f"Generated {filename}")


if __name__ == "__main__":
    main()
