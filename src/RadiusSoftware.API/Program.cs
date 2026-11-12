using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using RadiusSoftware.API.Hubs;
using RadiusSoftware.API.Services;
using RadiusSoftware.API.Services.MikroTik;
using RadiusSoftware.API.Services.SubscriberLiveSpeed;
using RadiusSoftware.Infrastructure.Data;
using Serilog;
using System.Diagnostics;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT token."
    });

    options.AddSecurityRequirement(document =>
        new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", document)] = []
        });
});
// 1. Serilog Setup (Logs ko File aur Console me save karne ke liye)
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("Logs/radius-log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// 2. Add SignalR
builder.Services.AddSignalR();

// Register PostgreSQL DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
    b => b.MigrationsAssembly("RadiusSoftware.Infrastructure")));

// Register JWT Authentication Configuration
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
        ValidAudience = builder.Configuration["JwtSettings:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"]!))
    };

    // SignalR (WebSockets) cannot send an Authorization header, so the
    // browser passes the JWT as ?access_token=... for the hub only.
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) &&
                context.HttpContext.Request.Path.StartsWithSegments("/radiusLogHub"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

// 🚀 FIXED CORS Policy for SignalR & REST APIs
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy
           .WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:3000",
                "https://localhost:7045",
                "https://bharatradius.com",
                "https://www.bharatradius.com"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Register your RADIUS Background Service
if (!builder.Environment.IsDevelopment())
{
    builder.Services.AddHostedService<RadiusServerService>();
}
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<RadiusSoftware.API.Security.ISiteAccessService, RadiusSoftware.API.Security.SiteAccessService>();
builder.Services.AddScoped<RadiusSoftware.API.Services.Query.ISubscriberQueryService, RadiusSoftware.API.Services.Query.SubscriberQueryService>();
builder.Services.AddScoped<IMikroTikService, MikroTikService>();
builder.Services.AddScoped<ISubscriberConnectionService, SubscriberConnectionService>();
builder.Services.AddScoped<
    ISubscriberLiveSpeedService,
    SubscriberLiveSpeedService>();
builder.Services.AddHostedService<ExpiredSubscriberService>();
builder.Services.AddMemoryCache();
builder.Services.AddHostedService<AutoConfigureNasService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddHttpClient("sms", c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddScoped<RadiusSoftware.API.Services.Sms.ISmsService, RadiusSoftware.API.Services.Sms.SmsService>();
builder.Services.AddHostedService<RadiusSoftware.API.Services.Sms.SmsReminderService>();
var app = builder.Build();

// Program.cs me (DbContext ya Controllers register hone se pehle)
PdfSharp.Fonts.GlobalFontSettings.FontResolver = new FallbackFontResolver();
// Auto seed data on startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        await DbInitializer.SeedAsync(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while seeding the database.");
    }
}

// CORS middleware must be before Routing / Authentication
app.UseCors("AllowAll");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Authentication MUST be before Authorization
app.UseAuthentication();
app.UseAuthorization();

// Customer KYC documents and CAF PDFs must never be served as public static
// files. They are only available through the authorized /api/CAF endpoints.
app.Use(async (context, next) =>
{
    var path = context.Request.Path;
    if (path.StartsWithSegments("/caf-forms", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWithSegments("/caf-documents", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }
    await next();
});

app.UseStaticFiles();

app.MapControllers();

// 4. Map SignalR Hub
app.MapHub<RadiusLogHub>("/radiusLogHub");

app.Run();