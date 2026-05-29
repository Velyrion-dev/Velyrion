#!/usr/bin/env bash
# Render build script for the backend
set -e

pip install -r requirements.txt

# Run database seed on first deploy
python -c "
import asyncio
from database import init_db
from seed import seed

async def setup():
    await init_db()
    await seed()

asyncio.run(setup())
"

echo "Build complete!"
