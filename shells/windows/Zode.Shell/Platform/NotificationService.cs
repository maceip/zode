// Platform/NotificationService.cs — toasts via Windows.AppNotifications.
//
// Contract §9.  Unpackaged apps need an AppUserModelID and a Start Menu
// shortcut (see AppIdentity) or the toast silently fails.

using System.Text;
using Windows.AppNotifications;
using Zode.Shell.Bridge;
using Zode.Shell.Diagnostics;

namespace Zode.Shell.Platform;

internal sealed class NotificationService : IDisposable
{
    private bool _registered;
    private bool _hooked;

    /// <summary>Raised when the user activates a toast (id, action).</summary>
    public event Action<string, string>? NotificationAction;

    public bool IsSupported { get; private set; }

    public NotificationService()
    {
        try
        {
            IsSupported = AppNotificationManager.IsSupported();
        }
        catch (Exception ex)
        {
            Log.Warn("notify", $"AppNotificationManager.IsSupported failed: {ex.Message}");
            IsSupported = false;
        }

        if (!IsSupported)
        {
            Log.Warn("notify", "toast notifications are not supported on this system.");
            return;
        }

        try
        {
            AppNotificationManager.Register();
            _registered = true;
        }
        catch (Exception ex)
        {
            Log.Warn("notify", $"AppNotificationManager.Register failed: {ex.Message}");
        }

        try
        {
            AppNotificationManager.NotificationInvoked += OnNotificationInvoked;
            _hooked = true;
        }
        catch (Exception ex)
        {
            Log.Warn("notify", $"could not subscribe to NotificationInvoked: {ex.Message}");
        }
    }

    /// <summary>Shows a toast.  Urgency "critical" degrades to a normal toast for unpackaged apps.</summary>
    public void Post(string title, string body, string? id, string urgency)
    {
        if (!IsSupported)
        {
            throw new BridgeException(ErrorCodes.Unsupported, "Toast notifications are not available on this system.");
        }

        string xml = BuildToastXml(title, body, urgency);

        try
        {
            var notification = new AppNotification(xml);
            if (!string.IsNullOrEmpty(id))
            {
                notification.Tag = id;
            }

            AppNotificationManager.Default.Show(notification);
        }
        catch (Exception ex)
        {
            Log.Error("notify", ex);
            throw new BridgeException(ErrorCodes.Internal, $"The notification could not be shown: {ex.Message}");
        }
    }

    private static string BuildToastXml(string title, string body, string urgency)
    {
        var sb = new StringBuilder();
        sb.Append("<toast");
        if (string.Equals(urgency, "critical", StringComparison.OrdinalIgnoreCase))
        {
            sb.Append(" scenario=\"urgent\"");
        }

        sb.Append("><visual><binding template=\"ToastGeneric\">");
        sb.Append("<text>").Append(Escape(title)).Append("</text>");
        sb.Append("<text>").Append(Escape(body)).Append("</text>");
        sb.Append("</binding></visual></toast>");
        return sb.ToString();
    }

    private static string Escape(string value) =>
        value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

    private void OnNotificationInvoked(AppNotificationManager sender, AppNotificationActivatedEventArgs args)
    {
        try
        {
            string id = args?.Tag ?? string.Empty;
            string action = args?.Arguments ?? string.Empty;
            NotificationAction?.Invoke(id, action);
        }
        catch (Exception ex)
        {
            Log.Error("notify", ex);
        }
    }

    public void Dispose()
    {
        if (_hooked)
        {
            try
            {
                AppNotificationManager.NotificationInvoked -= OnNotificationInvoked;
            }
            catch (Exception)
            {
                // ignored
            }

            _hooked = false;
        }

        if (_registered)
        {
            try
            {
                AppNotificationManager.Unregister();
            }
            catch (Exception)
            {
                // ignored
            }

            _registered = false;
        }
    }
}
