// Haptics/VibrationService.cs — the coarse, secondary haptic path.
//
// Windows desktops expose no rich haptic engine; the only thing available is
// IVibrationDevice, which can only produce an on/off pulse (contract §7).  We
// still fire it, mapped to the peak intensity of the program, so that devices
// which do have a rumble motor (some tablets, Surface devices) react to the
// same programs as the synthesised audio waveform.

using Windows.Devices.Haptics;
using Zode.Shell.Diagnostics;

namespace Zode.Shell.Haptics;

internal sealed class VibrationService
{
    private IVibrationDevice? _device;
    private bool _initialized;

    public bool IsAvailable => _device is not null;

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
            _device = await VibrationDevice.GetDefaultAsync();
            Log.Info("haptics", _device is null
                ? "no IVibrationDevice available (expected on desktops)"
                : "IVibrationDevice available; coarse pulses are enabled");
        }
        catch (Exception ex)
        {
            Log.Warn("haptics", $"IVibrationDevice lookup failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Fires a coarse pulse that matches the peak intensity of the program.
    /// Silently does nothing when no vibration device exists.
    /// </summary>
    public void Pulse(double peakIntensity, int durationMs)
    {
        IVibrationDevice? device = _device;
        if (device is null)
        {
            return;
        }

        try
        {
            double intensity = Math.Clamp(peakIntensity, 0, 1);
            int duration = Math.Clamp(durationMs, 10, 2000);

            IVibrationSimpleHapticsController? controller = device.SimpleHapticsController;
            if (controller is not null)
            {
                controller.SendHapticFeedback(new HapticFeedback
                {
                    Intensity = intensity,
                    Duration = TimeSpan.FromMilliseconds(duration),
                });
                return;
            }

            // Legacy coarse API: on/off only, so the duration is shortened.
            device.Vibrate(TimeSpan.FromMilliseconds(Math.Min(duration, 250)));
        }
        catch (Exception ex)
        {
            Log.Warn("haptics", $"vibration pulse failed: {ex.Message}");
        }
    }
}
