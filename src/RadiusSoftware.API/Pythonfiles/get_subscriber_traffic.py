import sys
import json
import time
from librouteros import connect

host = sys.argv[1]
username = sys.argv[2]
password = sys.argv[3]
port = int(sys.argv[4])
interface = sys.argv[5]

try:
    api = connect(
        host=host,
        username=username,
        password=password,
        port=port
    )

    def read_bytes():
        for item in api.path("interface"):
            if item["name"] == interface:
                return (
                    int(item["rx-byte"]),
                    int(item["tx-byte"])
                )
        return (0, 0)

    rx1, tx1 = read_bytes()
    time.sleep(1)
    rx2, tx2 = read_bytes()

    rx_bps = (rx2 - rx1) * 8
    tx_bps = (tx2 - tx1) * 8

    print(json.dumps({
        "success": True,
        "interface": interface,
        "rxBytes": rx2,
        "txBytes": tx2,
        "rx": rx_bps,
        "tx": tx_bps,
        "uploadBps": rx_bps,
        "downloadBps": tx_bps,
        "uploadMbps": rx_bps / 1_000_000,
        "downloadMbps": tx_bps / 1_000_000,
        "uploadKbps": rx_bps / 1_000,
        "downloadKbps": tx_bps / 1_000,
        "sampleSeconds": 1
    }))

except Exception as e:
    print(json.dumps({
        "success": False,
        "message": str(e)
    }))