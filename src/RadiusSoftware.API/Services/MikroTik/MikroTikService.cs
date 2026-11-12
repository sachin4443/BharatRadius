using System.Net.Sockets;
using tik4net;
using System.Security.Cryptography;
using System.Text;

namespace RadiusSoftware.API.Services.MikroTik;

public class MikroTikService : IMikroTikService
{
    private readonly ILogger<MikroTikService> _logger;

    public MikroTikService(
        ILogger<MikroTikService> logger)
    {
        _logger = logger;
    }

    // =========================================================
    // CREATE CONNECTION
    // =========================================================

    private ITikConnection CreateConnection(
        string ip,
        int port,
        string username,
        string password)
    {
        var connection =
            ConnectionFactory.CreateConnection(
                TikConnectionType.Api);

        connection.SendTimeout = 5000;
        connection.ReceiveTimeout = 5000;

        connection.Open(
            ip,
            port,
            username,
            password);

        return connection;
    }

    // =========================================================
    // TEST MIKROTIK API CONNECTION
    // =========================================================

    public async Task<MikroTikConnectionResult> TestConnectionAsync(
        string ip,
        int port,
        string username,
        string password)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection =
                    CreateConnection(
                        ip,
                        port,
                        username,
                        password);

                var identityCommand =
                    connection.CreateCommand(
                        "/system/identity/print");

                var identity =
                    identityCommand.ExecuteScalar(
                        "name")?.ToString();

                var resourceCommand =
                    connection.CreateCommand(
                        "/system/resource/print");

                var resource =
                    resourceCommand.ExecuteSingleRow();

                string version = "N/A";

                if (resource != null &&
                    resource.Words.ContainsKey("version"))
                {
                    version =
                        resource.Words["version"];
                }

                return new MikroTikConnectionResult
                {
                    Success = true,
                    Message =
                        "MikroTik API connection successful.",

                    Identity = identity,

                    Version = version
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "MikroTik connection failed: {Ip}:{Port}",
                ip,
                port);

            string message;

            if (ex is SocketException socketEx)
            {
                message = socketEx.SocketErrorCode switch
                {
                    SocketError.ConnectionRefused =>
                        $"MikroTik API connection refused at {ip}:{port}. " +
                        "Please verify the API service and port on the router.",

                    SocketError.TimedOut =>
                        $"MikroTik API connection timed out at {ip}:{port}. " +
                        "Please verify router connectivity, firewall and API port.",

                    SocketError.HostUnreachable =>
                        $"MikroTik host {ip} is unreachable from the RADIUS server.",

                    SocketError.NetworkUnreachable =>
                        $"Network route to MikroTik {ip} is unreachable from the RADIUS server.",

                    _ =>
                        $"Unable to connect to MikroTik API at {ip}:{port}. " +
                        $"Network error: {socketEx.SocketErrorCode}"
                };
            }
            else if (ex.InnerException is SocketException innerSocketEx)
            {
                message = innerSocketEx.SocketErrorCode switch
                {
                    SocketError.ConnectionRefused =>
                        $"MikroTik API connection refused at {ip}:{port}. " +
                        "Please verify the API service and port on the router.",

                    SocketError.TimedOut =>
                        $"MikroTik API connection timed out at {ip}:{port}. " +
                        "Please verify router connectivity, firewall and API port.",

                    _ =>
                        $"Unable to connect to MikroTik API at {ip}:{port}. " +
                        $"Network error: {innerSocketEx.SocketErrorCode}"
                };
            }
            else
            {
                message =
                    $"MikroTik API connection failed at {ip}:{port}. " +
                    "Please verify IP, API port, username, password and firewall settings.";
            }

            return new MikroTikConnectionResult
            {
                Success = false,
                Message = message
            };
        }
    }

    // =========================================================
    // CONFIGURE RADIUS
    // =========================================================

    public async Task<MikroTikCommandResult> ConfigureRadiusAsync(
        string ip,
        int port,
        string username,
        string password,
        string radiusServerIp,
        int radiusAuthPort,
        int radiusAccountingPort,
        string sharedSecret)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection =
                    CreateConnection(
                        ip,
                        port,
                        username,
                        password);

                // -------------------------------------------------
                // Read existing RADIUS configuration
                // -------------------------------------------------

                var printCommand =
                    connection.CreateCommand(
                        "/radius/print");

                var entries =
                    printCommand.ExecuteList()
                        .ToList();

                // -------------------------------------------------
                // Find existing RADIUS entry for our server
                // -------------------------------------------------

                var existing =
                    entries.FirstOrDefault(x =>
                        x.Words.TryGetValue(
                            "address",
                            out var address) &&
                        string.Equals(
                            address,
                            radiusServerIp,
                            StringComparison.OrdinalIgnoreCase));

                if (existing != null)
                {
                    // Existing entry found.
                    // Update it instead of creating duplicate.

                    if (!existing.Words.TryGetValue(
                            ".id",
                            out var id))
                    {
                        return new MikroTikCommandResult
                        {
                            Success = false,
                            Message =
                                "Existing RADIUS entry found but RouterOS ID was not returned."
                        };
                    }

                    var setCommand =
                        connection.CreateCommand(
                            "/radius/set");

                    setCommand.AddParameter(
                        ".id",
                        id);

                    setCommand.AddParameter(
                        "address",
                        radiusServerIp);

                    setCommand.AddParameter(
                        "service",
                        "ppp");

                    setCommand.AddParameter(
                        "secret",
                        sharedSecret);

                    setCommand.AddParameter(
                        "authentication-port",
                        radiusAuthPort.ToString());

                    setCommand.AddParameter(
                        "accounting-port",
                        radiusAccountingPort.ToString());

                    setCommand.ExecuteNonQuery();

                    _logger.LogInformation(
                        "Existing RADIUS server updated on {Ip}. Radius={RadiusServerIp}",
                        ip,
                        radiusServerIp);

                    return new MikroTikCommandResult
                    {
                        Success = true,
                        Message =
                            "Existing MikroTik RADIUS configuration updated successfully."
                    };
                }

                // -------------------------------------------------
                // No existing entry → create one
                // -------------------------------------------------

                var addCommand =
                    connection.CreateCommand(
                        "/radius/add");

                addCommand.AddParameter(
                    "address",
                    radiusServerIp);

                addCommand.AddParameter(
                    "service",
                    "ppp");

                addCommand.AddParameter(
                    "secret",
                    sharedSecret);

                addCommand.AddParameter(
                    "authentication-port",
                    radiusAuthPort.ToString());

                addCommand.AddParameter(
                    "accounting-port",
                    radiusAccountingPort.ToString());

                addCommand.ExecuteNonQuery();

                _logger.LogInformation(
                    "New RADIUS server added on {Ip}. Radius={RadiusServerIp}",
                    ip,
                    radiusServerIp);

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message =
                        "MikroTik RADIUS server configured successfully."
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "RADIUS configuration failed on MikroTik {Ip}",
                ip);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"RADIUS configuration failed: {ex.Message}"
            };
        }
    }

    // =========================================================
    // CONFIGURE PPP AAA
    // =========================================================

    public async Task<MikroTikCommandResult> ConfigurePppAaaAsync(
        string ip,
        int port,
        string username,
        string password,
        int interimTime)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection =
                    CreateConnection(
                        ip,
                        port,
                        username,
                        password);

                // RouterOS has one /ppp/aaa configuration.
                // We update it rather than creating anything.

                var setCommand =
                    connection.CreateCommand(
                        "/ppp/aaa/set");

                setCommand.AddParameter(
                    "use-radius",
                    "yes");

                setCommand.AddParameter(
                    "accounting",
                    "yes");

                // RouterOS accepts duration values.
                // Example: 300s
                setCommand.AddParameter(
                    "interim-update",
                    $"{interimTime}s");

                setCommand.ExecuteNonQuery();

                _logger.LogInformation(
                    "PPP AAA configured on MikroTik {Ip}. RADIUS authentication and accounting enabled.",
                    ip);

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message =
                        $"PPP AAA configured successfully. RADIUS authentication enabled, accounting enabled, interim update {interimTime}s."
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "PPP AAA configuration failed on MikroTik {Ip}",
                ip);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"PPP AAA configuration failed: {ex.Message}"
            };
        }
    }
    // =========================================================
    // CONFIGURE SYSLOG / FIREWALL LOGGING (UPDATED)
    // =========================================================

    public async Task<MikroTikCommandResult> ConfigureSyslogAsync(
        string ip,
        int port,
        string username,
        string password,
        string radiusServerIp,
        int syslogPort)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection = CreateConnection(ip, port, username, password);

                // 1. Check if 'radiussyslog' action exists (Hyphen removed for RouterOS rule)
                var actionListCommand = connection.CreateCommand("/system/logging/action/print");
                var actions = actionListCommand.ExecuteList();

                bool actionExists = false;
                string existingActionId = string.Empty;

                foreach (var act in actions)
                {
                    if (act.Words.ContainsKey("name") && act.Words["name"] == "radiussyslog")
                    {
                        actionExists = true;
                        existingActionId = act.Words[".id"];
                        break;
                    }
                }

                if (actionExists)
                {
                    var updateActionCmd = connection.CreateCommand("/system/logging/action/set",
                        connection.CreateParameter(".id", existingActionId),
                        connection.CreateParameter("target", "remote"),
                        connection.CreateParameter("remote", radiusServerIp),
                        connection.CreateParameter("remote-port", syslogPort.ToString())
                    );
                    updateActionCmd.ExecuteNonQuery();
                }
                else
                {
                    var addActionCmd = connection.CreateCommand("/system/logging/action/add",
                        connection.CreateParameter("name", "radiussyslog"),
                        connection.CreateParameter("target", "remote"),
                        connection.CreateParameter("remote", radiusServerIp),
                        connection.CreateParameter("remote-port", syslogPort.ToString())
                    );
                    addActionCmd.ExecuteNonQuery();
                }

                // 2. Check if logging rule for firewall,info exists using 'radiussyslog'
                var ruleListCommand = connection.CreateCommand("/system/logging/print");
                var rules = ruleListCommand.ExecuteList();

                bool ruleExists = false;
                foreach (var rule in rules)
                {
                    if (rule.Words.ContainsKey("topics") && rule.Words["topics"].Contains("firewall") &&
                        rule.Words.ContainsKey("action") && rule.Words["action"] == "radiussyslog")
                    {
                        ruleExists = true;
                        break;
                    }
                }

                if (!ruleExists)
                {
                    var addRuleCmd = connection.CreateCommand("/system/logging/add",
                        connection.CreateParameter("topics", "firewall,info"),
                        connection.CreateParameter("action", "radiussyslog")
                    );
                    addRuleCmd.ExecuteNonQuery();
                }

                _logger.LogInformation("Syslog and firewall logging configured on MikroTik {Ip} pointing to {Server}:{Port}", ip, radiusServerIp, syslogPort);

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message = "Syslog and firewall logging configured successfully on MikroTik."
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Syslog configuration failed on MikroTik {Ip}", ip);
            return new MikroTikCommandResult
            {
                Success = false,
                Message = $"Syslog configuration failed: {ex.Message}"
            };
        }
    }
    // =========================================================
    // VERIFY RADIUS CONFIGURATION
    // =========================================================

    public async Task<MikroTikCommandResult> VerifyRadiusConfigurationAsync(
        string ip,
        int port,
        string username,
        string password,
        string radiusServerIp,
        string sharedSecret)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection =
                    CreateConnection(
                        ip,
                        port,
                        username,
                        password);

                var command =
                    connection.CreateCommand(
                        "/radius/print");

                var entries =
                    command.ExecuteList()
                        .ToList();

                var entry =
                    entries.FirstOrDefault(x =>
                        x.Words.TryGetValue(
                            "address",
                            out var address) &&
                        string.Equals(
                            address,
                            radiusServerIp,
                            StringComparison.OrdinalIgnoreCase));

                if (entry == null)
                {
                    return new MikroTikCommandResult
                    {
                        Success = false,
                        Message =
                            $"RADIUS server {radiusServerIp} was not found on MikroTik."
                    };
                }

                // Verify service
                if (entry.Words.TryGetValue(
                        "service",
                        out var service))
                {
                    if (!service
                        .Split(',')
                        .Any(x =>
                            string.Equals(
                                x.Trim(),
                                "ppp",
                                StringComparison.OrdinalIgnoreCase)))
                    {
                        return new MikroTikCommandResult
                        {
                            Success = false,
                            Message =
                                "RADIUS server exists but PPP service is not enabled."
                        };
                    }
                }

                // Verify authentication port
                if (entry.Words.TryGetValue(
                        "authentication-port",
                        out var authPort))
                {
                    if (authPort != "1812")
                    {
                        return new MikroTikCommandResult
                        {
                            Success = false,
                            Message =
                                $"RADIUS authentication port is {authPort}, expected 1812."
                        };
                    }
                }

                // Verify accounting port
                if (entry.Words.TryGetValue(
                        "accounting-port",
                        out var acctPort))
                {
                    if (acctPort != "1813")
                    {
                        return new MikroTikCommandResult
                        {
                            Success = false,
                            Message =
                                $"RADIUS accounting port is {acctPort}, expected 1813."
                        };
                    }
                }

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message =
                        "MikroTik RADIUS configuration verified successfully."
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "RADIUS verification failed on MikroTik {Ip}",
                ip);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"RADIUS verification failed: {ex.Message}"
            };
        }
    }

    // =========================================================
    // VERIFY PPP AAA
    // =========================================================

    public async Task<MikroTikCommandResult> VerifyPppAaaConfigurationAsync(
        string ip,
        int port,
        string username,
        string password)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection =
                    CreateConnection(
                        ip,
                        port,
                        username,
                        password);

                var command =
                    connection.CreateCommand(
                        "/ppp/aaa/print");

                var settings =
                    command.ExecuteSingleRow();

                if (settings == null)
                {
                    return new MikroTikCommandResult
                    {
                        Success = false,
                        Message =
                            "MikroTik PPP AAA configuration could not be read."
                    };
                }

                bool useRadius =
                    settings.Words.TryGetValue(
                        "use-radius",
                        out var radiusValue) &&
                    string.Equals(
                        radiusValue,
                        "true",
                        StringComparison.OrdinalIgnoreCase);

                bool accounting =
                    settings.Words.TryGetValue(
                        "accounting",
                        out var accountingValue) &&
                    string.Equals(
                        accountingValue,
                        "true",
                        StringComparison.OrdinalIgnoreCase);

                if (!useRadius)
                {
                    return new MikroTikCommandResult
                    {
                        Success = false,
                        Message =
                            "PPP AAA is not configured to use RADIUS."
                    };
                }

                if (!accounting)
                {
                    return new MikroTikCommandResult
                    {
                        Success = false,
                        Message =
                            "PPP accounting is not enabled."
                    };
                }

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message =
                        "PPP AAA RADIUS authentication and accounting verified successfully."
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "PPP AAA verification failed on MikroTik {Ip}",
                ip);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"PPP AAA verification failed: {ex.Message}"
            };
        }
    }

    // =========================================================
    // DISCONNECT PPPoE SUBSCRIBER
    // =========================================================

    public async Task<MikroTikCommandResult> DisconnectPppSessionAsync(
        string ip,
        int port,
        string username,
        string password,
        string pppoeUsername)
    {
        try
        {
            return await Task.Run(() =>
            {
                using var connection = CreateConnection(
                    ip,
                    port,
                    username,
                    password);

                // Find active PPPoE session
                var activeCommand =
                    connection.CreateCommand("/ppp/active/print");

                activeCommand.AddParameter(
                    "name",
                    pppoeUsername);

                var sessions =
                    activeCommand
                        .ExecuteList()
                        .ToList();

                var activeSession =
                    sessions.FirstOrDefault();

                // User already offline
                if (activeSession == null)
                {
                    return new MikroTikCommandResult
                    {
                        Success = true,
                        Message =
                            $"Subscriber '{pppoeUsername}' is already offline."
                    };
                }

                // Get RouterOS internal session ID
                if (!activeSession.Words.TryGetValue(
                        ".id",
                        out var sessionId) ||
                    string.IsNullOrWhiteSpace(sessionId))
                {
                    return new MikroTikCommandResult
                    {
                        Success = false,
                        Message =
                            $"Active PPPoE session found for '{pppoeUsername}', but RouterOS session ID could not be read."
                    };
                }

                // Disconnect active session
                var removeCommand =
                    connection.CreateCommand("/ppp/active/remove");

                removeCommand.AddParameter(
                    ".id",
                    sessionId);

                removeCommand.ExecuteNonQuery();

                _logger.LogInformation(
                    "PPPoE subscriber {Subscriber} disconnected from MikroTik {Ip}",
                    pppoeUsername,
                    ip);

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message =
                        $"Subscriber '{pppoeUsername}' disconnected successfully."
                };
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to disconnect PPPoE subscriber {Subscriber} from MikroTik {Ip}",
                pppoeUsername,
                ip);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"Subscriber disconnect failed: {ex.Message}"
            };
        }
    }

    // =========================================================
    // CHANGE ACTIVE PPPoE RATE LIMIT USING RADIUS COA
    // =========================================================

    public async Task<MikroTikCommandResult> ChangePppRateLimitAsync(
        string ip,
        int port,
        string username,
        string password,
        string acctSessionId,
        string rateLimit,
        string sharedSecret)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(acctSessionId))
            {
                return new MikroTikCommandResult
                {
                    Success = false,
                    Message = "RADIUS Acct-Session-Id is required."
                };
            }

            if (string.IsNullOrWhiteSpace(rateLimit))
            {
                return new MikroTikCommandResult
                {
                    Success = false,
                    Message = "Rate-limit is required."
                };
            }

            if (string.IsNullOrWhiteSpace(sharedSecret))
            {
                return new MikroTikCommandResult
                {
                    Success = false,
                    Message = "RADIUS shared secret is required."
                };
            }

            // ---------------------------------------------------------
            // COA packet
            // Code 43 = Change of Authorization
            // ---------------------------------------------------------

            byte identifier =
                (byte)RandomNumberGenerator.GetInt32(0, 256);

            byte[] requestAuthenticator =
                RandomNumberGenerator.GetBytes(16);

            using var packet =
                new MemoryStream();

            // Header
            packet.WriteByte(43); // CoA-Request
            packet.WriteByte(identifier);

            // Length placeholder
            packet.WriteByte(0);
            packet.WriteByte(0);

            // Request Authenticator
            packet.Write(
                requestAuthenticator,
                0,
                requestAuthenticator.Length);

            // ---------------------------------------------------------
            // Add Acct-Session-Id
            // Attribute 44
            // ---------------------------------------------------------

            AddRadiusAttribute(
                packet,
                44,
                Encoding.UTF8.GetBytes(
                    acctSessionId));

            // ---------------------------------------------------------
            // Add Mikrotik-Rate-Limit
            //
            // MikroTik Vendor-Specific Attribute:
            // Vendor-ID = 14988
            // Attribute = 8
            // ---------------------------------------------------------

            byte[] rateBytes =
                Encoding.UTF8.GetBytes(rateLimit);

            using var vendor =
                new MemoryStream();

            // Vendor ID = MikroTik 14988
            vendor.WriteByte(0);
            vendor.WriteByte(0);
            vendor.WriteByte(0x3A);
            vendor.WriteByte(0x6C);

            // Vendor attribute
            vendor.WriteByte(8);

            // Vendor attribute length
            vendor.WriteByte(
                (byte)(2 + rateBytes.Length));

            vendor.Write(
                rateBytes,
                0,
                rateBytes.Length);

            AddRadiusAttribute(
                packet,
                26,
                vendor.ToArray());

            // ---------------------------------------------------------
            // Message-Authenticator
            // Attribute 80
            // ---------------------------------------------------------

            byte[] messageAuthenticator =
                new byte[16];

            AddRadiusAttribute(
                packet,
                80,
                messageAuthenticator);

            // ---------------------------------------------------------
            // Fix packet length
            // ---------------------------------------------------------

            byte[] packetBytes =
                packet.ToArray();

            ushort packetLength =
                (ushort)packetBytes.Length;

            packetBytes[2] =
                (byte)(packetLength >> 8);

            packetBytes[3] =
                (byte)(packetLength & 0xFF);

            // ---------------------------------------------------------
            // Calculate Message-Authenticator
            // ---------------------------------------------------------

            int messageAuthenticatorOffset =
                FindMessageAuthenticatorValueOffset(
                    packetBytes);

            if (messageAuthenticatorOffset >= 0)
            {
                using var hmac =
                    new HMACMD5(
                        Encoding.ASCII.GetBytes(
                            sharedSecret));

                byte[] hmacHash =
                    hmac.ComputeHash(
                        packetBytes);

                Array.Copy(
                    hmacHash,
                    0,
                    packetBytes,
                    messageAuthenticatorOffset,
                    16);
            }

            // ---------------------------------------------------------
            // Send COA to MikroTik
            // ---------------------------------------------------------

            using var udp =
                new UdpClient();

            udp.Client.ReceiveTimeout = 5000;

            await udp.SendAsync(
                packetBytes,
                packetBytes.Length,
                ip,
                3799);

            _logger.LogInformation(
                "RADIUS CoA sent to MikroTik {Ip}:3799 for session {SessionId}. Rate={RateLimit}",
                ip,
                acctSessionId,
                rateLimit);

            // ---------------------------------------------------------
            // Wait for CoA response
            // ---------------------------------------------------------

            var receiveTask =
                udp.ReceiveAsync();

            var completed =
                await Task.WhenAny(
                    receiveTask,
                    Task.Delay(5000));

            if (completed != receiveTask)
            {
                return new MikroTikCommandResult
                {
                    Success = false,
                    Message =
                        $"CoA request timed out. MikroTik did not respond on {ip}:3799."
                };
            }

            var response =
                await receiveTask;

            if (response.Buffer.Length < 20)
            {
                return new MikroTikCommandResult
                {
                    Success = false,
                    Message =
                        "Invalid RADIUS CoA response received from MikroTik."
                };
            }

            byte responseCode =
                response.Buffer[0];

            // 44 = CoA-ACK
            if (responseCode == 44)
            {
                _logger.LogInformation(
                    "MikroTik accepted CoA for session {SessionId}. New Rate={RateLimit}",
                    acctSessionId,
                    rateLimit);

                return new MikroTikCommandResult
                {
                    Success = true,
                    Message =
                        $"Live PPPoE session updated successfully. New rate-limit: {rateLimit}"
                };
            }

            // 45 = CoA-NAK
            if (responseCode == 45)
            {
                _logger.LogWarning(
                    "MikroTik rejected CoA for session {SessionId}.",
                    acctSessionId);

                return new MikroTikCommandResult
                {
                    Success = false,
                    Message =
                        "MikroTik rejected the CoA request. Active session was not changed."
                };
            }

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"Unexpected RADIUS CoA response code: {responseCode}"
            };
        }
        catch (SocketException ex)
        {
            _logger.LogError(
                ex,
                "RADIUS CoA network error for MikroTik {Ip}",
                ip);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"Unable to send CoA to MikroTik {ip}:3799. Network error: {ex.SocketErrorCode}"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to change PPPoE rate-limit using CoA for session {SessionId}",
                acctSessionId);

            return new MikroTikCommandResult
            {
                Success = false,
                Message =
                    $"Live package update failed: {ex.Message}"
            };
        }
    }

    private static void AddRadiusAttribute(
    MemoryStream stream,
    byte type,
    byte[] value)
    {
        if (value.Length > 253)
        {
            throw new ArgumentException(
                "RADIUS attribute value is too long.");
        }

        stream.WriteByte(type);

        stream.WriteByte(
            (byte)(value.Length + 2));

        stream.Write(
            value,
            0,
            value.Length);
    }

    private static int FindMessageAuthenticatorValueOffset(
        byte[] packet)
    {
        if (packet.Length < 20)
        {
            return -1;
        }

        int offset = 20;

        while (offset + 2 <= packet.Length)
        {
            byte type =
                packet[offset];

            byte length =
                packet[offset + 1];

            if (length < 2 ||
                offset + length > packet.Length)
            {
                break;
            }

            if (type == 80 &&
                length == 18)
            {
                return offset + 2;
            }

            offset += length;
        }

        return -1;
    }
}