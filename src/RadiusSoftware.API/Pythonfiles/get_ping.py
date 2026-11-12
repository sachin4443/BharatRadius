import sys
import json
from librouteros import connect

host = sys.argv[1]
username = sys.argv[2]
password = sys.argv[3]
port = int(sys.argv[4])
target = sys.argv[5]

try:

    api = connect(
        host=host,
        username=username,
        password=password,
        port=port
    )

    result = list(api(
        "/ping",
        address=target,
        count="3"
    ))

    latency = 0
    minimum = 0
    average = 0
    maximum = 0
    packetLoss = 0

    if result:

        last = result[-1]

        latency = float(
            str(last.get("time","0ms")).replace("ms","")
        )

        minimum = float(
            str(last.get("min-rtt","0ms")).replace("ms","")
        )

        average = float(
            str(last.get("avg-rtt","0ms")).replace("ms","")
        )

        maximum = float(
            str(last.get("max-rtt","0ms")).replace("ms","")
        )

        packetLoss = float(
            last.get("packet-loss",0)
        )

    print(json.dumps({
        "success":True,
        "latency":latency,
        "min":minimum,
        "avg":average,
        "max":maximum,
        "packetLoss":packetLoss
    }))

except Exception as e:

    print(json.dumps({
        "success":False,
        "message":str(e)
    }))