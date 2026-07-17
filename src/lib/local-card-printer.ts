import { execFile } from "child_process";
import path from "path";

export type PrintCardResult = {
  printerName: string | null;
};

type PrintMode = "FitPage" | "RollWidth4" | "DoubleStrip4x6";

type PrintOptions = {
  jobName?: string;
  mode?: PrintMode;
  rollWidthInches?: number;
};

const printTimeoutMs = 60000;

function getPrintScriptPath() {
  return path.join(process.cwd(), "scripts", "print-card.ps1");
}

function getPowerShellPath() {
  return process.env.SystemRoot
    ? path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
}

export async function printLocalCardPng(
  imagePath: string,
  options: PrintOptions | string = {},
): Promise<PrintCardResult> {
  if (process.platform !== "win32") {
    throw new Error("Silent kiosk printing is configured for Windows only.");
  }

  const printOptions =
    typeof options === "string" ? { jobName: options } : options;
  const jobName = printOptions.jobName ?? "CardifyBooth card";
  const mode = printOptions.mode ?? "FitPage";
  const printerName = process.env.CARDIFYBOOTH_PRINTER_NAME?.trim() || null;
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    getPrintScriptPath(),
    "-ImagePath",
    imagePath,
    "-JobName",
    jobName,
    "-Mode",
    mode,
  ];

  if (printOptions.rollWidthInches) {
    args.push("-RollWidthInches", String(printOptions.rollWidthInches));
  }

  const horizontalOffset = process.env.CARDIFYBOOTH_COLLAGE_OFFSET_X?.trim() || null;
  const verticalOffset = process.env.CARDIFYBOOTH_COLLAGE_OFFSET_Y?.trim() || null;

  if (horizontalOffset) {
    args.push("-HorizontalOffset", horizontalOffset);
  }
  if (verticalOffset) {
    args.push("-VerticalOffset", verticalOffset);
  }

  if (printerName) {
    args.push("-PrinterName", printerName);
  }

  await new Promise<void>((resolve, reject) => {
    execFile(getPowerShellPath(), args, { timeout: printTimeoutMs }, (error, stdout, stderr) => {
      if (stdout) console.log("Printer script output:\n", stdout);
      if (stderr) console.error("Printer script error output:\n", stderr);
      if (error) {
        const detail = stderr.trim() || stdout.trim() || error.message;
        reject(new Error(detail));
        return;
      }

      resolve();
    });
  });

  return { printerName };
}
