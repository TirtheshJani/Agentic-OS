"""
Decode ~/.claude/projects/ directory names back to filesystem paths.

Encoding rules:
  - Path starts with '/' → stored with leading '-'
  - '/' separators → '-'
  - Literal '-' in a path component → '--'

Examples:
  '-home-username--claude'                 → '/home/username/.claude'
  '-home-username-Documents-Code-My-App'   → '/home/username/Documents/Code/My-App'
"""


def decode_project_dir(dirname: str) -> str:
    """Convert an encoded project directory name to its original filesystem path."""
    if not dirname.startswith("-"):
        return dirname

    result: list[str] = ["/"]
    i = 1  # skip leading '-'
    while i < len(dirname):
        ch = dirname[i]
        if ch == "-":
            if i + 1 < len(dirname) and dirname[i + 1] == "-":
                # '--' → literal '-'
                result.append("-")
                i += 2
            else:
                # single '-' → '/'
                result.append("/")
                i += 1
        else:
            result.append(ch)
            i += 1

    return "".join(result)


def display_name(dirname: str) -> str:
    """Return the last path component of the decoded project path."""
    decoded = decode_project_dir(dirname)
    parts = [p for p in decoded.split("/") if p]
    return parts[-1] if parts else dirname


def encode_project_dir(path: str) -> str:
    """Convert a filesystem path to its encoded project directory name (inverse of decode)."""
    if not path.startswith("/"):
        return path
    # Strip leading '/'
    remainder = path[1:]
    # Replace literal '-' with '--', then '/' with '-'
    encoded = remainder.replace("-", "--").replace("/", "-")
    return "-" + encoded
