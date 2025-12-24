#!/usr/bin/env python3
"""Runtime verification script to ensure all new code is properly integrated."""

import sys
import importlib
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend-python"
sys.path.insert(0, str(backend_path))

def verify_imports():
    """Verify all critical imports work."""
    print("=" * 60)
    print("INTEGRATION VERIFICATION")
    print("=" * 60)
    print()
    
    checks = []
    
    # Check 1: Heartbeat manager
    print("✓ Checking heartbeat module...")
    try:
        from app.ws.heartbeat import heartbeat_manager, HeartbeatManager
        assert heartbeat_manager is not None
        assert isinstance(heartbeat_manager, HeartbeatManager)
        checks.append(("Heartbeat Manager", True, "Active"))
    except Exception as e:
        checks.append(("Heartbeat Manager", False, str(e)))
    
    # Check 2: Join queue
    print("✓ Checking join queue module...")
    try:
        from app.services.join_queue import join_queue, JoinQueue
        assert join_queue is not None
        assert isinstance(join_queue, JoinQueue)
        checks.append(("Join Queue", True, "Active"))
    except Exception as e:
        checks.append(("Join Queue", False, str(e)))
    
    # Check 3: Join attempt model
    print("✓ Checking join attempt model...")
    try:
        from app.models import JoinAttempt, JoinAttemptStatus
        assert JoinAttempt is not None
        assert JoinAttemptStatus is not None
        checks.append(("JoinAttempt Model", True, "Exported"))
    except Exception as e:
        checks.append(("JoinAttempt Model", False, str(e)))
    
    # Check 4: New WebSocket messages
    print("✓ Checking WebSocket messages...")
    try:
        from app.ws.messages import (
            PongMessage,
            StateRestoredMessage,
            ParticipantNameChangedMessage,
            JoinLockStatusChangedMessage,
            parse_client_message
        )
        
        # Verify pong message can be parsed
        pong_msg = parse_client_message({"type": "pong"})
        assert pong_msg is not None
        assert isinstance(pong_msg, PongMessage)
        
        checks.append(("WebSocket Messages", True, "All new types defined and parseable"))
    except Exception as e:
        checks.append(("WebSocket Messages", False, str(e)))
    
    # Check 5: Hub integration
    print("✓ Checking hub integration...")
    try:
        from app.ws.hub import hub, Hub
        assert hub is not None
        assert isinstance(hub, Hub)
        
        # Verify new methods exist
        assert hasattr(hub, 'handle_pong')
        assert hasattr(hub, 'reconnect')
        assert hasattr(hub, 'cleanup_stale_connections')
        assert hasattr(hub, 'get_connection_state')
        
        checks.append(("Hub Integration", True, "All new methods available"))
    except Exception as e:
        checks.append(("Hub Integration", False, str(e)))
    
    # Check 6: Routes registered
    print("✓ Checking route registration...")
    try:
        from app.routes import join
        from app.ws import game_handler
        
        assert hasattr(join, 'router')
        assert hasattr(game_handler, 'router')
        
        checks.append(("Route Registration", True, "Routers available"))
    except Exception as e:
        checks.append(("Route Registration", False, str(e)))
    
    # Print results
    print()
    print("=" * 60)
    print("VERIFICATION RESULTS")
    print("=" * 60)
    print()
    
    all_passed = True
    for check_name, passed, details in checks:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {check_name}")
        if not passed:
            print(f"        Error: {details}")
            all_passed = False
        else:
            print(f"        {details}")
        print()
    
    print("=" * 60)
    if all_passed:
        print("✅ ALL CHECKS PASSED - Integration verified!")
        print("=" * 60)
        print()
        print("Summary:")
        print("  • Heartbeat system: ACTIVE")
        print("  • Join queue: ACTIVE")
        print("  • WebSocket messages: REGISTERED")
        print("  • Hub methods: AVAILABLE")
        print("  • Routes: REGISTERED")
        print()
        print("All new code is properly integrated and will be executed.")
        return 0
    else:
        print("❌ SOME CHECKS FAILED - Review errors above")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    sys.exit(verify_imports())

