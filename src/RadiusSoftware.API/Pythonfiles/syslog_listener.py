import socket
import os
import re
import json
import time
from datetime import datetime
import psycopg2  # pip install psycopg2-binary


# =========================================================
# CONFIGURATION
# =========================================================

PORT = 514

# Logs direct F: drive par save honge
BASE_LOG_DIR = r"F:\bharatradiussyslog"


# PostgreSQL Database
# Connection details are read from the API's appsettings.json
# (ConnectionStrings:DefaultConnection), so the DB name/password is kept
# in ONE place. Environment variables override it if set:
#   BR_DB_NAME, BR_DB_USER, BR_DB_PASSWORD, BR_DB_HOST, BR_DB_PORT


def _load_db_config():
    config = {
        "dbname": "UatDatabase",
        "user": "postgres",
        "password": "",
        "host": "localhost",
        "port": "5432",
    }

    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (
        os.path.join(here, "..", "appsettings.json"),
        os.path.join(here, "appsettings.json"),
    ):
        try:
            with open(candidate, encoding="utf-8-sig") as fh:
                conn_str = json.load(fh)["ConnectionStrings"]["DefaultConnection"]
            parts = dict(
                p.split("=", 1) for p in conn_str.split(";") if "=" in p
            )
            parts = {k.strip().lower(): v.strip() for k, v in parts.items()}
            config["host"] = parts.get("host", config["host"])
            config["port"] = parts.get("port", config["port"])
            config["dbname"] = parts.get("database", config["dbname"])
            config["user"] = parts.get("username", config["user"])
            config["password"] = parts.get("password", config["password"])
            break
        except Exception:
            continue

    config["dbname"] = os.environ.get("BR_DB_NAME", config["dbname"])
    config["user"] = os.environ.get("BR_DB_USER", config["user"])
    config["password"] = os.environ.get("BR_DB_PASSWORD", config["password"])
    config["host"] = os.environ.get("BR_DB_HOST", config["host"])
    config["port"] = os.environ.get("BR_DB_PORT", config["port"])
    return config


DB_CONFIG = _load_db_config()

# Cache entries expire so that a subscriber moved to another site
# is picked up without restarting the listener.
CACHE_TTL_SECONDS = 600


# In-memory cache
subscriber_cache = {}


# =========================================================
# CREATE & OPEN LOG FOLDER
# =========================================================

def initialize_log_folder():

    try:
        # Folder create karo
        os.makedirs(BASE_LOG_DIR, exist_ok=True)

        print("")
        print("=" * 70)
        print("SYSLOG LOG FOLDER")
        print("=" * 70)
        print(f"Folder Path : {BASE_LOG_DIR}")
        print(f"Folder Exists : {os.path.exists(BASE_LOG_DIR)}")
        print("=" * 70)
        print("")

        # Windows Explorer me folder open karo
        os.startfile(BASE_LOG_DIR)

    except Exception as e:
        print(f"Error creating/opening log folder: {e}")


# =========================================================
# SANITIZE FOLDER NAME
# =========================================================

def sanitize_folder_name(name):

    if not name:
        return "Unknown"

    return re.sub(
        r'[<>:"/\\|?*]',
        '_',
        str(name)
    ).strip()


# =========================================================
# GET SITE & SUBSCRIBER
# =========================================================

def get_site_and_subscriber(pppoe_username):

    # Cache check
    cached = subscriber_cache.get(pppoe_username)
    if cached and time.time() - cached[2] < CACHE_TTL_SECONDS:
        return cached[0], cached[1]

    site_name = "Unassigned_Site"
    subscriber_name = pppoe_username

    conn = None
    cursor = None

    try:

        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        query = """
            SELECT
                s."FullName",
                st."SiteName",
                st."CompanyName"
            FROM "Subscribers" s
            LEFT JOIN "Sites" st
                ON s."SiteId" = st."Id"
            WHERE s."PPPoEUsername" = %s
            LIMIT 1;
        """

        cursor.execute(
            query,
            (pppoe_username,)
        )

        result = cursor.fetchone()

        if result:

            subscriber_name = sanitize_folder_name(
                result[0] or pppoe_username
            )

            site_name = sanitize_folder_name(
                result[1] or result[2] or "Site"
            )

    except Exception as e:

        print(
            f"Database query error for "
            f"{pppoe_username}: {e}"
        )

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()

    # Cache
    subscriber_cache[pppoe_username] = (
        site_name,
        subscriber_name,
        time.time()
    )

    return site_name, subscriber_name


# =========================================================
# SAVE SYSLOG
# =========================================================

def save_log(router_ip, raw_log):

    try:

        site_name = "Router_System_Logs"
        subscriber_name = router_ip

        # -------------------------------------------------
        # PPPoE username extract
        # Example:
        # <pppoe-username>
        # -------------------------------------------------

        match = re.search(
            r'<pppoe-([^>]+)>',
            raw_log
        )

        if match:

            pppoe_username = match.group(1).strip()

            site_name, subscriber_name = (
                get_site_and_subscriber(
                    pppoe_username
                )
            )

        # -------------------------------------------------
        # Folder structure
        #
        # F:\bharatradiussyslog
        #       └── SiteName
        #             └── SubscriberName
        #                   └── 2026-09-09.txt
        # -------------------------------------------------

        folder_path = os.path.join(
            BASE_LOG_DIR,
            site_name,
            subscriber_name
        )

        os.makedirs(
            folder_path,
            exist_ok=True
        )

        # -------------------------------------------------
        # Daily log file
        # -------------------------------------------------

        file_name = (
            f"{datetime.now().strftime('%Y-%m-%d')}.txt"
        )

        file_path = os.path.join(
            folder_path,
            file_name
        )

        # -------------------------------------------------
        # Log entry
        # -------------------------------------------------

        log_entry = (
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
            f"[Router IP: {router_ip}] "
            f"{raw_log}\n"
        )

        # Append log
        with open(
            file_path,
            "a",
            encoding="utf-8"
        ) as f:

            f.write(log_entry)

        # Console me exact file path dikhao
        print(
            f"[LOG SAVED] {file_path}"
        )

    except Exception as e:

        print(
            f"Error saving log: {e}"
        )


# =========================================================
# START SYSLOG SERVER
# =========================================================

def start_syslog_server():

    # -----------------------------------------------------
    # Sabse pehle log folder create + open
    # -----------------------------------------------------

    initialize_log_folder()

    # -----------------------------------------------------
    # UDP Socket
    # -----------------------------------------------------

    sock = socket.socket(
        socket.AF_INET,
        socket.SOCK_DGRAM
    )

    try:

        sock.bind(
            ("0.0.0.0", PORT)
        )

    except Exception as e:

        print("")
        print("=" * 70)
        print("ERROR STARTING SYSLOG SERVER")
        print("=" * 70)
        print(f"UDP Port : {PORT}")
        print(f"Error    : {e}")
        print("=" * 70)
        print("")

        return

    # -----------------------------------------------------
    # Server Started
    # -----------------------------------------------------

    print("")
    print("=" * 70)
    print("PYTHON SYSLOG LISTENER STARTED")
    print("=" * 70)
    print(f"UDP Port       : {PORT}")
    print(f"Listening On   : 0.0.0.0:{PORT}")
    print(f"Logs Directory : {BASE_LOG_DIR}")
    print("=" * 70)
    print("")
    print("Waiting for MikroTik Syslog messages...")
    print("Press CTRL+C to stop.")
    print("")

    # -----------------------------------------------------
    # Receive logs
    # -----------------------------------------------------

    while True:

        try:

            data, addr = sock.recvfrom(65535)

            message = data.decode(
                "utf-8",
                errors="ignore"
            ).strip()

            router_ip = addr[0]

            if message:

                save_log(
                    router_ip,
                    message
                )

        except KeyboardInterrupt:

            print("")
            print("Syslog Listener stopped.")
            break

        except Exception as e:

            print(
                f"Socket error: {e}"
            )

    sock.close()


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":

    start_syslog_server()