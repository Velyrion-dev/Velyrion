"""VELYRION CLI — Command-line interface for the Velyrion SDK."""

import sys
import json
import os

def main():
    args = sys.argv[1:]
    if not args or args[0] in ("--help", "-h"):
        print_help()
        return
    
    api_url = os.getenv("VELYRION_API_URL", "http://localhost:8000")
    api_key = os.getenv("VELYRION_API_KEY", "")
    
    cmd = args[0]
    
    if cmd == "version":
        from velyrion import __version__
        print(f"Velyrion SDK v{__version__}")
    
    elif cmd == "health":
        from velyrion import Velyrion
        v = Velyrion(api_url=api_url, api_key=api_key)
        result = v.health()
        print(json.dumps(result, indent=2))
    
    elif cmd == "agents":
        import requests
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["x-api-key"] = api_key
        try:
            r = requests.get(f"{api_url}/api/agents", headers=headers, timeout=10)
            agents = r.json()
            if isinstance(agents, list):
                print(f"\n{'ID':<20} {'Name':<25} {'Status':<12} {'Risk'}")
                print("─" * 65)
                for a in agents:
                    print(f"{a.get('agent_id','?'):<20} {a.get('agent_name','?'):<25} {a.get('status','?'):<12} {a.get('risk_level','?')}")
                print(f"\n{len(agents)} agents registered")
            else:
                print(json.dumps(agents, indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    elif cmd == "status":
        if len(args) < 2:
            print("Usage: velyrion status <agent-id>")
            return
        import requests
        agent_id = args[1]
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["x-api-key"] = api_key
        try:
            r = requests.get(f"{api_url}/api/agents/{agent_id}", headers=headers, timeout=10)
            print(json.dumps(r.json(), indent=2))
        except Exception as e:
            print(f"Error: {e}")
    
    else:
        print(f"Unknown command: {cmd}")
        print_help()

def print_help():
    print("""
╔══════════════════════════════════════════════════╗
║         VELYRION — AI Agent Governance           ║
╚══════════════════════════════════════════════════╝

Usage: velyrion <command> [options]

Commands:
  health              Check API connection status
  agents              List all registered agents
  status <agent-id>   Show details for a specific agent
  version             Show SDK version

Environment Variables:
  VELYRION_API_URL    API endpoint (default: http://localhost:8000)
  VELYRION_API_KEY    API authentication key

Examples:
  velyrion health
  velyrion agents
  velyrion status agent-001
""")

if __name__ == "__main__":
    main()
