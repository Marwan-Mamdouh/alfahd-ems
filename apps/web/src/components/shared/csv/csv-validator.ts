export const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (matches NestJS Multer limit)
export const MAX_CSV_ROWS = 5_000; // 5,000 nonblank rows limit

export interface ValidateCsvOptions {
  requiredHeaders?: string[];
  maxSizeBytes?: number;
  maxRows?: number;
}

export interface CsvValidationResult {
  isValid: boolean;
  error?: string;
  headers?: string[];
  estimatedRowCount?: number;
}

/**
 * Format bytes into human-readable string (KB / MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Parse a raw CSV header line into trimmed header tokens, stripping UTF-8 BOM if present.
 */
export function parseCsvHeader(headerLine: string): string[] {
  // Strip UTF-8 Byte Order Mark (\uFEFF) if present at file start
  const cleanLine = headerLine.replace(/^\uFEFF/, "");

  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < cleanLine.length; i++) {
    const char = cleanLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result.map((h) => h.replace(/^["']|["']$/g, "").trim());
}

/**
 * Perform client-side pre-validation of a CSV file before uploading.
 * Validates extension, file size (5MB), UTF-8/BOM, row count (max 5,000), required headers,
 * and warns about unsupported quoted commas/newlines.
 */
export async function validateCsvFile(
  file: File,
  options?: ValidateCsvOptions
): Promise<CsvValidationResult> {
  const maxSizeBytes = options?.maxSizeBytes ?? MAX_CSV_FILE_SIZE;
  const maxRows = options?.maxRows ?? MAX_CSV_ROWS;

  // 1. File extension validation
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".csv")) {
    return {
      isValid: false,
      error: "Only CSV files are supported (.csv)",
    };
  }

  // 2. File size validation
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds the maximum allowed limit of ${formatFileSize(maxSizeBytes)}`,
    };
  }

  if (file.size === 0) {
    return {
      isValid: false,
      error: "The selected CSV file is empty",
    };
  }

  // 3. Header inspection & content check
  try {
    const text = await file.text();
    // Strip BOM
    const cleanText = text.replace(/^\uFEFF/, "");

    const lines = cleanText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return {
        isValid: false,
        error: "The CSV file contains no content",
      };
    }

    const headers = parseCsvHeader(lines[0]);
    if (headers.length === 0 || headers.every((h) => h.length === 0)) {
      return {
        isValid: false,
        error: "CSV header row is invalid or missing",
      };
    }

    const dataRowCount = lines.length - 1;

    if (dataRowCount < 1) {
      return {
        isValid: false,
        error: "CSV file contains a header but no data rows",
      };
    }

    // 4. Maximum rows validation (5,000 nonblank rows)
    if (dataRowCount > maxRows) {
      return {
        isValid: false,
        error: `CSV file contains ${dataRowCount.toLocaleString()} rows, exceeding the maximum allowed limit of ${maxRows.toLocaleString()} nonblank rows`,
      };
    }

    // 5. Parser limitation check: warn if any row has unmatched quotes (embedded newlines/commas)
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const quoteCount = (lines[i].match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        return {
          isValid: false,
          error: `Line ${i + 1} has unclosed quotes. The server parser does not support embedded multi-line newlines within quotes.`,
        };
      }
    }

    // 6. Required headers validation
    if (options?.requiredHeaders && options.requiredHeaders.length > 0) {
      const normalizedFoundHeaders = headers.map((h) => h.toLowerCase());
      const missing = options.requiredHeaders.filter(
        (req) => !normalizedFoundHeaders.includes(req.toLowerCase().trim())
      );

      if (missing.length > 0) {
        return {
          isValid: false,
          error: `Missing required column(s): ${missing.join(", ")}`,
          headers,
        };
      }
    }

    return {
      isValid: true,
      headers,
      estimatedRowCount: dataRowCount,
    };
  } catch {
    return {
      isValid: false,
      error: "Unable to read the CSV file. Please ensure it is a valid UTF-8 text file.",
    };
  }
}
