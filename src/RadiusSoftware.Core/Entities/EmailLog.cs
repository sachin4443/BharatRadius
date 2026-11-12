using System;

public class EmailLog
{
    public Guid Id { get; set; }
    public Guid SubscriberId { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = "Success"; // Success / Failed
    public string ErrorMessage { get; set; } = string.Empty;
    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}