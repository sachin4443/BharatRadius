namespace RadiusSoftware.API.Services.SubscriberLiveSpeed;

public interface ISubscriberLiveSpeedService
{
    Task<SubscriberLiveSpeedResult?> GetLiveSpeedAsync(Guid subscriberId);
}