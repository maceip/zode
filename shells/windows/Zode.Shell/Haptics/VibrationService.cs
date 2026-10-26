// Haptics/VibrationService.cs — the coarse, secondary haptic path.
//
// Windows desktops expose no rich haptic engine; the only thing available is
// the vibration device, which can only produce a coarse pulse (contract §7).
// We still fire it, mapped to the peak intensity of the program, so that
// devices which do have a rumble motor (some tablets, Surface devices) react
// to the same programs as the synthesised audio waveform.
//
// Only the *public* Windows.Devices.Haptics API is used: the `VibrationDevice`
// class, its `SimpleHapticsController` and the `FeedbackKind` enum.  The
// `IVibrationDevice` / `IVibrationSimpleHapticsController` interfaces and the
// `HapticFeedback` struct are internal to the platform and cannot be
// referenced from an app.

using Windows.Devices.Haptics;
using Zode.Shell.Diagnostics;

namespace Zode.Shell.Haptics;

internal sealed class VibrationService
{
    private VibrationDevice? _device;
    private SimpleHapticsController? _controller;
    private bool _initialized;

    public bool IsAvailable => _controller is not null;

    /// <summary>Kicks off the (asynchronous) device lookup exactly once.</summary>
    public void EnsureInitialized()
    {
        if (_initialized)
        {
            return;
        }

        _initialized = true;
        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            // The platform asks for permission before a device may be used.
            VibrationAccessStatus access = await VibrationDevice.RequestAccessAsync();
            if (access != VibrationAccessStatus.Allowed)
            {
                Log.Info("haptics", $"vibration access was not granted ({access}); expected on desktops");
                return;
            }

            _device = await VibrationDevice.GetDefaultAsync();
            _controller = _device?.SimpleHapticsController;

            Log.Info("haptics", _controller is null
                ? "no vibration device available (expected on desktops)"
                : "vibration device available; coarse pulses are enabled");
        }
        catch (Exception ex)
        {
            Log.Warn("haptics", $"vibration device lookup failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Fires a coarse pulse that matches the peak intensity of the program.
    /// Silently does nothing when no vibration device exists.
    /// </summary>
    public void Pulse(double peakIntensity, int durationMs)
    {
        SimpleHapticsController? controller = _controller;
        if (controller is null)
        {
            return;
        }

        try
        {
            double intensity = Math.Clamp(peakIntensity, 0, 1);

            // The coarse API is a waveform, not a duration: the platform
            // decides how long the pulse lasts.  The duration of the program
            // is therefore not reproduced exactly — the contract allows that
            // on platforms without a rich haptic engine.
            controller.SendHapticFeedback(FeedbackKind.Click, intensity, 0.5);
        }
        catch (Exception ex)
        {
            Log.Warn("haptics", $"vibration pulse failed: {ex.Message}");
        }
    }

    /// <summary>Stops a pulse that is still running.</summary>
    public void Stop()
    {
        try
        {
            _controller?.StopHapticFeedback();
        }
        catch (Exception ex)
        {
            Log.Warn("haptics", $"stopping the vibration failed: {ex.Message}");
        }
    }
}
