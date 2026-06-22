using System;
using System.Diagnostics;
using System.IO;
using System.Collections.Generic;

class Program
{
    static int Main(string[] args)
    {
        string exeDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
        string realExe = Path.Combine(exeDir, "7za-real.exe");

        var newArgs = new List<string>();
        foreach (string arg in args)
        {
            if (string.Equals(arg, "-snld", StringComparison.OrdinalIgnoreCase))
                continue;
            newArgs.Add(arg);
        }

        var psi = new ProcessStartInfo
        {
            FileName = realExe,
            Arguments = string.Join(" ", newArgs),
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = false,
            CreateNoWindow = true
        };

        try
        {
            using (var proc = Process.Start(psi))
            {
                proc.OutputDataReceived += (s, e) => { if (e.Data != null) Console.Out.WriteLine(e.Data); };
                proc.ErrorDataReceived += (s, e) => { if (e.Data != null) Console.Error.WriteLine(e.Data); };
                proc.BeginOutputReadLine();
                proc.BeginErrorReadLine();
                proc.WaitForExit();
                return proc.ExitCode;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("7za-wrapper error: " + ex.Message);
            return 1;
        }
    }
}
