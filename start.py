"""
VELYRION — One-Click Startup
Starts backend, frontend, and real AI agents with a single command.

Usage:
    python start.py              # Start everything
    python start.py --no-agents  # Start without AI agents (no Ollama needed)
"""

import subprocess
import signal
import sys
import os
import time
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

processes = []


def start_process(name, cmd, cwd, env=None):
    """Start a subprocess and track it."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        env=full_env,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    processes.append((name, p))
    return p


def stream_output(name, process):
    """Read and print output from a process."""
    try:
        for line in process.stdout:
            line = line.rstrip()
            if line:
                print(f"  [{name}] {line}")
    except Exception:
        pass


def cleanup(*args):
    """Kill all child processes."""
    print("\n\n🛑 Shutting down VELYRION...")
    for name, p in processes:
        try:
            p.terminate()
            print(f"   ✓ Stopped {name}")
        except Exception:
            pass
    # Wait briefly for graceful shutdown
    time.sleep(1)
    for _, p in processes:
        try:
            p.kill()
        except Exception:
            pass
    print("   All services stopped. Goodbye! 👋\n")
    sys.exit(0)


def check_port(port):
    """Check if a port is already in use."""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(("127.0.0.1", port))
    sock.close()
    return result == 0


def wait_for_port(port, timeout=30):
    """Wait until a port is accepting connections."""
    start = time.time()
    while time.time() - start < timeout:
        if check_port(port):
            return True
        time.sleep(0.5)
    return False


def main():
    no_agents = "--no-agents" in sys.argv

    print()
    print("=" * 60)
    print("  ⚡ VELYRION — Starting All Services")
    print("=" * 60)
    print()

    # Register signal handlers for clean shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # ── Check prerequisites ──
    print("📋 Checking prerequisites...")

    if not os.path.exists(os.path.join(BACKEND_DIR, "main.py")):
        print("   ❌ Backend not found. Run this from the project root.")
        return

    if not os.path.exists(os.path.join(FRONTEND_DIR, "package.json")):
        print("   ❌ Frontend not found. Run this from the project root.")
        return

    db_path = os.path.join(BACKEND_DIR, "velyrion.db")
    if not os.path.exists(db_path):
        print("   ⚠️  Database not found. Seeding...")
        subprocess.run(
            [sys.executable, "seed.py"],
            cwd=BACKEND_DIR,
            capture_output=True,
        )
        print("   ✅ Database seeded")

    print("   ✅ All prerequisites met")
    print()

    # ── Kill any existing processes on our ports ──
    for port in [8000, 3000]:
        if check_port(port):
            print(f"   ⚠️  Port {port} in use — attempting to free it...")
            if sys.platform == "win32":
                os.system(f'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :{port}\') do taskkill /F /PID %a >nul 2>&1')
            time.sleep(1)

    # ── Start Backend ──
    print("🚀 Starting Backend (FastAPI on port 8000)...")
    backend = start_process(
        "BACKEND",
        f'{sys.executable} -m uvicorn main:app --host 0.0.0.0 --port 8000',
        BACKEND_DIR,
        env={"VELYRION_API_KEY": ""},
    )

    if wait_for_port(8000, timeout=15):
        print("   ✅ Backend ready → http://localhost:8000")
        print("   📚 API Docs    → http://localhost:8000/docs")
    else:
        print("   ⚠️  Backend may still be starting...")

    print()

    # ── Start Frontend ──
    print("🚀 Starting Frontend (Next.js on port 3000)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend = start_process(
        "FRONTEND",
        f"{npm_cmd} run dev -- -p 3000",
        FRONTEND_DIR,
    )

    if wait_for_port(3000, timeout=20):
        print("   ✅ Frontend ready → http://localhost:3000")
        print("   📊 Dashboard   → http://localhost:3000/dashboard")
    else:
        print("   ⚠️  Frontend may still be starting...")

    print()

    # ── Start Agents ──
    if not no_agents:
        # Check if Ollama is available
        ollama_available = check_port(11434)

        if ollama_available:
            print("🤖 Starting Real AI Agents (Ollama)...")
            agents = start_process(
                "AGENTS",
                f'{sys.executable} backend/agents.py',
                ROOT,
                env={"VELYRION_API_KEY": ""},
            )
            print("   ✅ 8 agents running — sending events every 10-30s")
        else:
            print("🤖 Ollama not running — starting Simulator instead...")
            print("   (Run 'ollama serve' separately to use real AI agents)")
            agents = start_process(
                "SIMULATOR",
                f'{sys.executable} backend/simulate.py',
                ROOT,
                env={"VELYRION_API_KEY": ""},
            )
            print("   ✅ Simulator running — sending fake events")
    else:
        print("⏭️  Skipping agents (--no-agents flag)")

    print()
    print("=" * 60)
    print("  ✅ VELYRION is running!")
    print()
    print("  🌐 Landing Page:  http://localhost:3000")
    print("  📊 Dashboard:     http://localhost:3000/dashboard")
    print("  📚 API Docs:      http://localhost:8000/docs")
    print()
    print("  Press Ctrl+C to stop all services")
    print("=" * 60)
    print()

    # ── Stream all output ──
    import threading
    for name, proc in processes:
        t = threading.Thread(target=stream_output, args=(name, proc), daemon=True)
        t.start()

    # Wait forever (until Ctrl+C)
    try:
        while True:
            # Check if any process died
            for name, p in processes:
                if p.poll() is not None:
                    print(f"\n   ⚠️  {name} stopped (exit code {p.returncode})")
            time.sleep(2)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
