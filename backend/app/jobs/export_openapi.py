"""Write the API description (OpenAPI JSON) that the web app's TypeScript types are generated from.

python -m app.jobs.export_openapi ../web/openapi.json
"""

import json
import sys
from pathlib import Path

from app.main import app


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    Path(sys.argv[1]).write_text(json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {sys.argv[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
