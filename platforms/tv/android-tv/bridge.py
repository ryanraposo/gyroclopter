"""Experimental Android TV Remote v2 bridge. PIN pairing is interactive; serving uses a pinned certificate."""
import argparse
import asyncio
import getpass
import ipaddress
import json
import os
from pathlib import Path
import ssl
import sys

from androidtvremote2 import AndroidTVRemote, InvalidAuth

ALLOWED = frozenset(("DPAD_UP", "DPAD_DOWN", "DPAD_LEFT", "DPAD_RIGHT", "DPAD_CENTER",
    "BACK", "HOME", "MEDIA_PLAY_PAUSE", "MEDIA_PLAY", "MEDIA_PAUSE", "MEDIA_STOP",
    "MEDIA_NEXT", "MEDIA_PREVIOUS", "VOLUME_UP", "VOLUME_DOWN", "VOLUME_MUTE"))
NETWORKS = tuple(ipaddress.ip_network(x) for x in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"))

def emit(event):
    print(json.dumps({"event": event}), flush=True)

def peer(transport):
    cert = transport.get_extra_info("ssl_object").getpeercert(binary_form=True)
    if not cert:
        raise InvalidAuth("Missing device certificate")
    return cert

class PinnedRemote(AndroidTVRemote):
    def __init__(self, host, directory):
        self.pin = directory / "tv.pem"
        self.cert = directory / "client.pem"
        self.key = directory / "key.pem"
        super().__init__("Gyroclopter", str(self.cert), str(self.key), host, enable_ime=False)
    async def _create_ssl_context(self):
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        # Hostnames on TV certificates are not IP SANs; only the PIN-verified
        # device certificate is trusted, and its exact DER is checked below.
        context.check_hostname = False
        context.verify_mode = ssl.CERT_REQUIRED
        context.load_verify_locations(cafile=str(self.pin))
        if hasattr(ssl, "VERIFY_X509_PARTIAL_CHAIN"):
            context.verify_flags |= ssl.VERIFY_X509_PARTIAL_CHAIN
        context.load_cert_chain(str(self.cert), str(self.key))
        return context
    async def async_connect(self):
        await super().async_connect()
        if peer(self._transport) != ssl.PEM_cert_to_DER_cert(self.pin.read_text()):
            self.disconnect()
            raise InvalidAuth("Device certificate changed")

async def pair(host, directory):
    if (directory / "tv.pem").exists():
        raise RuntimeError("Already paired; choose a new state directory for explicit re-pairing")
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != "nt":
        if directory.stat().st_uid != os.getuid():
            raise PermissionError("State directory must be owned by the user")
        directory.chmod(0o700)
    remote = AndroidTVRemote("Gyroclopter", str(directory / "client.pem"), str(directory / "key.pem"), host, enable_ime=False)
    try:
        await remote.async_generate_cert_if_missing()
        await asyncio.wait_for(remote.async_start_pairing(), 20)
        cert = peer(remote._pairing_message_protocol.transport)
        code = await asyncio.to_thread(getpass.getpass, "Code displayed on your TV: ")
        await asyncio.wait_for(remote.async_finish_pairing(code.strip()), 20)
        tmp = directory / "tv.pem.tmp"
        tmp.write_text(ssl.DER_cert_to_PEM_cert(cert))
        if os.name != "nt":
            tmp.chmod(0o600)
        tmp.replace(directory / "tv.pem")
        print("Paired. TV certificate pinned.", flush=True)
    finally:
        remote.disconnect()

async def serve(host, directory):
    if os.name != "nt" and (directory.stat().st_uid != os.getuid() or directory.stat().st_mode & 0o077):
        raise PermissionError("State directory must be private")
    remote = PinnedRemote(host, directory)
    ready = False
    def availability(value):
        nonlocal ready
        ready = bool(value)
        emit("ready" if ready else "unavailable")
    try:
        await asyncio.wait_for(remote.async_connect(), 20)
        availability(True)
        remote.add_is_available_updated_callback(availability)
        remote.keep_reconnecting(lambda: availability(False))
        while True:
            line = await asyncio.to_thread(sys.stdin.readline, 4096)
            if not line:
                break
            if not ready:
                continue
            try:
                key = json.loads(line).get("key")
                if key in ALLOWED:
                    remote.send_key_command(key)
            except (ValueError, AttributeError, TypeError):
                continue
            except Exception:
                availability(False)
    finally:
        remote.disconnect()

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("pair", "serve"))
    parser.add_argument("--host", required=True)
    parser.add_argument("--state", required=True, type=Path)
    args = parser.parse_args()
    ip = ipaddress.ip_address(args.host)
    if ip.version != 4 or not any(ip in net for net in NETWORKS):
        parser.error("Expected explicit private LAN IPv4 address")
    if not args.state.is_absolute():
        parser.error("State path must be absolute")
    if args.mode == "pair":
        asyncio.run(pair(args.host, args.state))
    else:
        try:
            asyncio.run(serve(args.host, args.state))
        except Exception:
            emit("error")
            raise SystemExit(1)

if __name__ == "__main__":
    main()
