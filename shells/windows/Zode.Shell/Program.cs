// Program.cs — entry point of the Zode Windows shell.

using Zode.Shell.Diagnostics;
using Zode.Shell.Native;
using Zode.Shell.Platform;

namespace Zode.Shell;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        // OLE has to be initialised for the drag & drop registration.
        Ole32.OleInitialize(IntPtr.Zero);
        try
        {
            using var guard = new SingleInstanceGuard();
            if (!guard.TryAcquire())
            {
                // Another instance is already running: hand the deep link over
                // and exit.
                guard.ForwardCommandLine(args);
                return 0;
            }

            if (args.Any(a => string.Equals(a, "--register-protocol", StringComparison.OrdinalIgnoreCase)))
            {
                ProtocolActivation.RegisterProtocol();
            }

            using var application = new ShellApplication(args, guard);
            application.Run();
            return 0;
        }
        catch (Exception ex)
        {
            Log.Error("startup", ex);
            return 1;
        }
        finally
        {
            Ole32.OleUninitialize();
        }
    }
}
