using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RadiusSoftware.API.Services.SubscriberLiveSpeed;

namespace RadiusSoftware.API.Controllers;

[Authorize]
[ApiController]
[Route("api/subscriber-live-speed")]
public class SubscriberLiveSpeedController : ControllerBase
{
    private readonly ISubscriberLiveSpeedService _service;
    private readonly ILogger<SubscriberLiveSpeedController> _logger;

    public SubscriberLiveSpeedController(
        ISubscriberLiveSpeedService service,
        ILogger<SubscriberLiveSpeedController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpGet("{subscriberId:guid}")]
    public async Task<IActionResult> GetLiveSpeed(Guid subscriberId)
    {
        try
        {
            var result = await _service.GetLiveSpeedAsync(subscriberId);

            if (result == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "Subscriber not found."
                });
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Live speed error for {SubscriberId}",
                subscriberId);

            return StatusCode(500, new
            {
                success = false,
                message = "Unable to retrieve live subscriber speed."
            });
        }
    }
}