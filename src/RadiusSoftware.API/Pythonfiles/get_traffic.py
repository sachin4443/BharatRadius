import sys
import json
import time

from librouteros import connect

host=sys.argv[1]
username=sys.argv[2]
password=sys.argv[3]
port=int(sys.argv[4])
interface=sys.argv[5]

api=connect(
    host=host,
    username=username,
    password=password,
    port=port
)

def read_bytes():

    for item in api.path("interface"):

        if item["name"]==interface:

            return (
                int(item["rx-byte"]),
                int(item["tx-byte"])
            )

    return (0,0)

rx1,tx1=read_bytes()

time.sleep(1)

rx2,tx2=read_bytes()

rxbps=((rx2-rx1)*8)

txbps=((tx2-tx1)*8)

print(json.dumps({
    "success":True,
    "rx":rxbps,
    "tx":txbps
}))
